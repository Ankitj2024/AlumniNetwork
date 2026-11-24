/**
 * Inline scripts for <head>, run before the first paint. They live in a plain module (no
 * 'use client') so the server layout receives the actual text: a string exported from a client
 * module reaches a server component as a client reference, not as the string.
 */

export const THEME_KEY = 'amn.theme';
export const INTRO_KEY = 'amn.intro';

/** Applies the saved light/dark choice (or the OS setting) before paint. Keep in sync with lib/theme.tsx resolve(). */
export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem('${THEME_KEY}');var d=c==='dark'||((c===null||c==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

/**
 * Marks a first visit (no intro seen yet, no reduced motion) so the intro cover shows from frame one.
 * Skipped on pages people reach from an email link. Failsafe: the script itself removes the flag
 * after 8 s, so the page can never stay covered even if the app fails to load.
 */
export const INTRO_SCRIPT = `(function(){try{var p=location.pathname;if(p==='/reset-password'||p==='/verify-email')return;if(!localStorage.getItem('${INTRO_KEY}')&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){var r=document.documentElement;r.setAttribute('data-intro','');setTimeout(function(){r.removeAttribute('data-intro')},8000)}}catch(e){}})();`;
