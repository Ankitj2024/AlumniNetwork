'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * Light / dark / system theme.
 * - The choice lives in localStorage ("amn.theme"); "system" follows the OS setting live.
 * - THEME_SCRIPT runs in <head> before the page paints, so there is never a flash of the
 *   wrong theme. React then takes over from the class it set.
 */
export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const KEY = 'amn.theme';

/** Inline, dependency-free copy of the resolution logic for <head>. Keep in sync with resolve(). */
export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem('${KEY}');var d=c==='dark'||((c===null||c==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

function readChoice(): ThemeChoice {
  try {
    const c = localStorage.getItem(KEY);
    return c === 'light' || c === 'dark' ? c : 'system';
  } catch {
    return 'system';
  }
}

const systemDark = () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
const resolve = (c: ThemeChoice): ResolvedTheme => (c === 'system' ? (systemDark() ? 'dark' : 'light') : c);

function apply(theme: ResolvedTheme, animate: boolean) {
  const root = document.documentElement;
  if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('theme-switching');
    window.setTimeout(() => root.classList.remove('theme-switching'), 320);
  }
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', theme === 'dark' ? '#0a0f1a' : '#f6f7f9');
}

interface ThemeCtx {
  choice: ThemeChoice;
  theme: ResolvedTheme;
  setChoice: (c: ThemeChoice) => void;
  toggle: () => void;
}
const Ctx = createContext<ThemeCtx>({ choice: 'system', theme: 'light', setChoice: () => {}, toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>('system');
  const [theme, setTheme] = useState<ResolvedTheme>('light');

  // Pick up what the head script already applied.
  useEffect(() => {
    const c = readChoice();
    setChoiceState(c);
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  // Follow the OS while on "system".
  useEffect(() => {
    if (choice !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const t = mq.matches ? 'dark' : 'light';
      apply(t, true);
      setTheme(t);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [choice]);

  // Keep several open tabs in step.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      const c = readChoice();
      const t = resolve(c);
      apply(t, true);
      setChoiceState(c);
      setTheme(t);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setChoice = useCallback((c: ThemeChoice) => {
    try {
      if (c === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, c);
    } catch {
      /* storage blocked: the theme still applies for this visit */
    }
    const t = resolve(c);
    apply(t, true);
    setChoiceState(c);
    setTheme(t);
  }, []);

  const toggle = useCallback(() => setChoice(theme === 'dark' ? 'light' : 'dark'), [theme, setChoice]);

  return <Ctx.Provider value={{ choice, theme, setChoice, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
