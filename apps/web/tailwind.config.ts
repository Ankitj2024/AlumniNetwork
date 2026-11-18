import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 50: '#f5f7fa', 100: '#e9edf3', 200: '#cfd7e3', 300: '#a6b3c6', 400: '#7586a0', 500: '#536580', 600: '#3e4e67', 700: '#323f54', 800: '#232d3d', 900: '#151c27', 950: '#0a0f1a' },
        brand: { 50: '#eefbf7', 100: '#d5f5ea', 200: '#aeead7', 300: '#78d8bf', 400: '#41bfa2', 500: '#1fa388', 600: '#13836e', 700: '#12695a', 800: '#12544a', 900: '#11463e' },
        iris: { 300: '#b4a8ff', 400: '#9384ff', 500: '#7563f5', 600: '#5e48e0' },
      },
      fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'], display: ['var(--font-sans)', 'system-ui', 'sans-serif'], serif: ['var(--font-serif)', 'Georgia', 'serif'] },
      letterSpacing: { tightest: '-0.045em' },
      boxShadow: {
        card: '0 1px 2px rgba(21,28,39,.05), 0 8px 24px -12px rgba(21,28,39,.18)',
        depth: '0 2px 4px rgba(21,28,39,.04), 0 12px 32px -8px rgba(21,28,39,.22), 0 32px 64px -24px rgba(19,131,110,.25)',
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
