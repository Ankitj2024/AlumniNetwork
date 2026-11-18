import type { Config } from 'tailwindcss';

/** A colour backed by an "r g b" CSS variable, so opacity modifiers (`/60`) keep working. */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./src/**/*.{ts,tsx}'],
  // `dark` class on <html>, set by lib/theme.tsx before first paint.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /**
         * Neutral scale. In light mode it runs light (50) → dark (950); in dark mode the same names
         * run dark → light, tuned for contrast on dark surfaces (see globals.css). So `text-ink-900`
         * is always "primary text" and `bg-ink-50` always "page / subtle fill", whichever the theme.
         */
        ink: { 50: v('ink-50'), 100: v('ink-100'), 200: v('ink-200'), 300: v('ink-300'), 400: v('ink-400'), 500: v('ink-500'), 600: v('ink-600'), 700: v('ink-700'), 800: v('ink-800'), 900: v('ink-900'), 950: v('ink-950') },
        /** Cards, inputs, menus. */
        surface: v('surface'),
        /** App background behind cards. */
        canvas: v('canvas'),
        /** Always-dark navy for deliberately dark brand moments and overlays (does not switch). */
        night: '#0a0f1a',
        brand: { 50: '#eefbf7', 100: '#d5f5ea', 200: '#aeead7', 300: '#78d8bf', 400: '#41bfa2', 500: '#1fa388', 600: '#13836e', 700: '#12695a', 800: '#12544a', 900: '#11463e' },
        iris: { 300: '#b4a8ff', 400: '#9384ff', 500: '#7563f5', 600: '#5e48e0' },
      },
      fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'], display: ['var(--font-sans)', 'system-ui', 'sans-serif'], serif: ['var(--font-serif)', 'Georgia', 'serif'] },
      letterSpacing: { tightest: '-0.045em' },
      boxShadow: {
        card: 'var(--shadow-card)',
        depth: 'var(--shadow-depth)',
        glow: '0 0 0 1px rgba(65,191,162,.35), 0 8px 32px -4px rgba(31,163,136,.45)',
        btn: '0 1px 0 rgba(255,255,255,.25) inset, 0 6px 16px -6px rgba(19,131,110,.7), 0 2px 4px rgba(19,131,110,.3)',
      },
      keyframes: {
        aurora: { '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' }, '33%': { transform: 'translate3d(6%,-8%,0) scale(1.12)' }, '66%': { transform: 'translate3d(-5%,6%,0) scale(.94)' } },
        float: { '0%,100%': { transform: 'translateY(0) rotateX(0) rotateY(0)' }, '50%': { transform: 'translateY(-10px) rotateX(6deg) rotateY(-6deg)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        spin3d: { '0%': { transform: 'rotateX(-25deg) rotateY(0deg)' }, '100%': { transform: 'rotateX(-25deg) rotateY(360deg)' } },
        pulseRing: { '0%': { transform: 'scale(.9)', opacity: '.7' }, '100%': { transform: 'scale(1.9)', opacity: '0' } },
        gradientShift: { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
      },
      animation: {
        aurora: 'aurora 18s ease-in-out infinite',
        'aurora-slow': 'aurora 26s ease-in-out infinite reverse',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        spin3d: 'spin3d 2.4s linear infinite',
        'pulse-ring': 'pulseRing 1.8s cubic-bezier(.2,.6,.4,1) infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
