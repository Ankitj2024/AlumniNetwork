'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme, type ThemeChoice } from '@/lib/theme';

/**
 * One-click light/dark switch. The icon shows the theme you'd switch TO, which is the common
 * convention (sun in dark mode, moon in light mode). Settings → Appearance also offers "System".
 */
export function ThemeToggle({ className = '', size = 17, withLabel = false }: { className?: string; size?: number; withLabel?: boolean }) {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const next = theme === 'dark' ? 'light' : 'dark';
  const label = `Switch to ${next} theme`;

  return (
    <button type="button" onClick={toggle} className={`btn-ghost overflow-hidden ${withLabel ? 'gap-2' : 'p-2'} ${className}`} aria-label={label} title={label}>
      <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
        {/* Rendered after mount: the server can't know the theme, so this avoids a mismatched icon. */}
        {mounted && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              className="absolute inset-0 flex items-center justify-center"
              initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            >
              {theme === 'dark' ? <Sun size={size} /> : <Moon size={size} />}
            </motion.span>
          </AnimatePresence>
        )}
      </span>
      {withLabel && <span>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>}
    </button>
  );
}

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Light / Dark / System segmented control (Settings → Appearance). */
export function ThemePicker() {
  const { choice, setChoice } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className="inline-flex rounded-xl border border-[color:var(--line-strong)] bg-ink-50 p-1" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setChoice(value)}
            className={`relative flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors ${active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-800'}`}
          >
            {active && <motion.span layoutId="theme-picker" className="absolute inset-0 rounded-lg bg-surface shadow-[0_1px_2px_rgba(21,28,39,.1),0_0_0_1px_var(--line)]" transition={{ type: 'spring', stiffness: 460, damping: 34 }} />}
            <Icon size={14} className="relative" />
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
