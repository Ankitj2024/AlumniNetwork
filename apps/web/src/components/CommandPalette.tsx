'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CornerDownLeft, LogOut, Moon, Search, Sun, UserRound } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { get } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ACCOUNT_NAV, flatNav } from '@/lib/nav';
import { cx } from './ui';

type Cmd = { id: string; label: string; hint?: string; group: string; icon: React.ComponentType<{ size?: number; className?: string }>; run: () => void; keywords?: string };

/** Opens the command palette from anywhere (e.g. the search button in the shell). */
export const openCommandPalette = () => window.dispatchEvent(new Event('open-command-palette'));

/**
 * ⌘K / Ctrl+K command palette: jump to any page, search mentors by name/role/company, sign out.
 * Keyboard-first — ↑↓ to move, Enter to run, Esc to close.
 */
export function CommandPalette() {
  const { me, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [mentors, setMentors] = useState<{ id: string; name: string; headline: string | null }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-command-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-command-palette', onOpen);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Live mentor search (students & staff only; never exposes contact data — same serializer as discovery).
  const canSearchMentors = me && ['student', 'aro', 'admin'].includes(me.user.role);
  useEffect(() => {
    if (!open || !canSearchMentors || q.trim().length < 2) {
      setMentors([]);
      return;
    }
    const t = setTimeout(() => {
      get<{ mentors: { id: string; name: string; headline: string | null }[] }>(`/mentors/search?hasCapacity=false&limit=5&q=${encodeURIComponent(q.trim())}`)
        .then((d) => setMentors(d.mentors))
        .catch(() => setMentors([]));
    }, 180);
    return () => clearTimeout(t);
  }, [q, open, canSearchMentors]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const commands = useMemo<Cmd[]>(() => {
    if (!me) return [];
    const pages: Cmd[] = [...flatNav(me.user.role), ...ACCOUNT_NAV].map((n) => ({ id: n.href, label: n.label, group: 'Go to', icon: n.icon, run: () => go(n.href), keywords: n.keywords }));
    const people: Cmd[] = mentors.map((m) => ({ id: `m-${m.id}`, label: m.name, hint: m.headline ?? undefined, group: 'Mentors', icon: UserRound, run: () => go(`/mentors/${m.id}`) }));
    const actions: Cmd[] = [
      { id: 'theme', label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', group: 'Account', icon: theme === 'dark' ? Sun : Moon, run: () => (setOpen(false), toggleTheme()), keywords: 'theme appearance dark light mode' },
      { id: 'logout', label: 'Sign out', group: 'Account', icon: LogOut, run: () => logout() },
    ];
    const needle = q.trim().toLowerCase();
    const match = (c: Cmd) => !needle || `${c.label} ${c.keywords ?? ''} ${c.hint ?? ''}`.toLowerCase().includes(needle);
    return [...people, ...pages.filter(match), ...actions.filter(match)];
  }, [me, mentors, q, go, logout, theme, toggleTheme]);

  useEffect(() => setActive(0), [q, mentors.length]);

  if (!me) return null;

  const groups = commands.reduce<Record<string, Cmd[]>>((acc, c) => ((acc[c.group] ??= []).push(c), acc), {});
  let i = -1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-start justify-center bg-night/40 px-4 pt-[12vh] dark:bg-black/60 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
          <motion.div
            role="dialog"
            aria-label="Command palette"
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-[color:var(--line-strong)] bg-surface shadow-[0_32px_80px_-20px_rgba(10,15,26,.45)]"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[color:var(--line)] px-4">
              <Search size={17} className="text-ink-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActive((a) => Math.min(commands.length - 1, a + 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActive((a) => Math.max(0, a - 1));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    commands[active]?.run();
                  } else if (e.key === 'Escape') setOpen(false);
                }}
                placeholder={canSearchMentors ? 'Search pages or mentors…' : 'Search pages…'}
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-400"
                aria-label="Search commands"
              />
              <span className="kbd">Esc</span>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {commands.length === 0 && <p className="px-3 py-8 text-center text-sm text-ink-500">No results for “{q}”.</p>}
              {Object.entries(groups).map(([g, cmds]) => (
                <div key={g} className="mb-1">
                  <div className="eyebrow px-3 pb-1 pt-2">{g}</div>
                  {cmds.map((c) => {
                    i++;
                    const idx = i;
                    const Icon = c.icon;
                    return (
                      <button
                        key={c.id}
                        onMouseMove={() => setActive(idx)}
                        onClick={c.run}
                        className={cx('relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors', active === idx ? 'text-ink-900' : 'text-ink-600')}
                      >
                        {active === idx && <motion.span layoutId="cmdk-active" className="absolute inset-0 rounded-xl bg-ink-100/80" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                        <Icon size={16} className="relative shrink-0 text-ink-400" />
                        <span className="relative min-w-0 flex-1 truncate">
                          {c.label}
                          {c.hint && <span className="ml-2 text-ink-400">{c.hint}</span>}
                        </span>
                        {active === idx && <ArrowRight size={14} className="relative text-ink-400" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 border-t border-[color:var(--line)] bg-ink-50/60 px-4 py-2 text-[11px] text-ink-500">
              <span className="flex items-center gap-1">
                <span className="kbd">↑</span>
                <span className="kbd">↓</span> navigate
              </span>
              <span className="flex items-center gap-1">
                <span className="kbd">
                  <CornerDownLeft size={10} />
                </span>{' '}
                open
              </span>
              <span className="ml-auto flex items-center gap-1">
                <span className="kbd">⌘</span>
                <span className="kbd">K</span> toggle
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
