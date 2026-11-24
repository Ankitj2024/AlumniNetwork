'use client';
import { AnimatePresence, motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { INTRO_KEY } from '@/lib/headScripts';
import { MARK_SVG } from './Logo';

/**
 * First-visit intro: the logo forms in liquid glass, then the page fades in. Shown once per browser.
 *
 * INTRO_SCRIPT (lib/headScripts.ts) runs in <head> before the first paint and sets `data-intro` on <html> when this
 * browser hasn't seen the intro (and doesn't ask for reduced motion). globals.css then shows a
 * plain cover from the very first frame, so the page never flashes underneath. The flag is stored
 * as soon as the intro starts, so a reload never replays it.
 *
 * It can never trap the page: click, Escape or Skip ends it, a hard cap ends it after ~6 s, and if
 * storage is blocked the script throws inside its try and the intro simply never starts.
 */
const KEY = INTRO_KEY;
const MAX_MS = 6000;

// The WebGL reveal is only downloaded when the intro actually plays.
const GlassIconReveal = dynamic(() => import('./ui/liquid-glass-logo-reveal'), { ssr: false });

export function IntroSplash() {
  const [state, setState] = useState<'off' | 'playing' | 'done'>('off');
  const [dark, setDark] = useState(false);
  const [wordmark, setWordmark] = useState(false);
  const ended = useRef(false);

  const finish = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    setState('done');
    // Drop the cover underneath; the splash itself fades out over the page.
    document.documentElement.removeAttribute('data-intro');
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (!root.hasAttribute('data-intro')) return;
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* storage blocked mid-visit: it simply plays this once */
    }
    setDark(root.classList.contains('dark'));
    setState('playing');
    const cap = window.setTimeout(finish, MAX_MS);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish();
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(cap);
      window.removeEventListener('keydown', onKey);
    };
  }, [finish]);

  const onComplete = useCallback(() => {
    setWordmark(true);
    window.setTimeout(finish, 900);
  }, [finish]);

  return (
    <AnimatePresence>
      {state === 'playing' && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[101] flex flex-col items-center justify-center"
          style={{ background: dark ? '#000000' : '#f5f5f7' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }}
          onClick={finish}
          role="dialog"
          aria-label="Welcome to Alumni Mentor Network"
        >
          <GlassIconReveal
            logo={MARK_SVG}
            label="Alumni Mentor Network"
            look={dark ? 'dark' : 'light'}
            background={dark ? '#000000' : '#f5f5f7'}
            logoColor={dark ? '#f5f5f7' : '#1d1d1f'}
            plateColor={dark ? '#1c1c1e' : undefined}
            loop={false}
            onComplete={onComplete}
            className="h-[min(70vh,560px)] w-full max-w-[720px]"
          />
          <motion.p
            className={`-mt-6 text-[17px] font-semibold tracking-[-0.02em] ${dark ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]'}`}
            initial={{ opacity: 0, y: 6 }}
            animate={wordmark ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            Alumni Mentor Network
          </motion.p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              finish();
            }}
            className={`absolute right-5 top-5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${dark ? 'bg-white/10 text-white/80 hover:bg-white/15' : 'bg-black/[0.05] text-black/60 hover:bg-black/[0.08]'}`}
          >
            Skip
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
