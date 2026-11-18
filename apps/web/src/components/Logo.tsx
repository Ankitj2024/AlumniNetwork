'use client';
import { useId } from 'react';

/**
 * Brand mark — the "network A".
 *
 * An A whose apex is a mentor node, set apart from the strokes by a small gap, and whose
 * crossbar is an arc: the same arcs that link alumni and campus on the hero globe. Read as a
 * figure it is someone with open arms; read as a diagram it is a node and its connections.
 *
 * Drawn on a 48-unit grid. src/app/icon.svg (the favicon) uses the same geometry; keep the two
 * in sync. Every instance gets its own gradient/mask ids via useId(), because the app renders
 * hidden and visible copies side by side (desktop sidebar + mobile bar) and shared ids would
 * resolve to the hidden one.
 */
export const MARK = {
  legs: 'M13 37A30 30 0 0 1 24 16A30 30 0 0 1 35 37',
  arms: 'M14.4 30.2Q24 25.2 33.6 30.2',
  head: { cx: 24, cy: 13.4, r: 4.9 },
  gap: 7.6,
} as const;

type MarkProps = {
  size?: number;
  className?: string;
  /** `tile`: white mark on the brand gradient (default). `glyph`: the mark alone in currentColor. */
  variant?: 'tile' | 'glyph';
  /** Strokes draw themselves in a loop; used by the page loader. */
  animated?: boolean;
  /** Accessible name; omit when a visible wordmark sits next to it. */
  title?: string;
};

export function LogoMark({ size = 32, className = '', variant = 'tile', animated = false, title }: MarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tile = variant === 'tile';
  const ink = tile ? '#fff' : 'currentColor';
  const draw = animated ? { pathLength: 1, className: 'logo-draw' } : {};

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={`shrink-0 ${tile ? 'drop-shadow-[0_6px_14px_rgba(31,163,136,.35)]' : ''} ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        {tile && (
          <>
            <linearGradient id={`${uid}bg`} x1="6" y1="2" x2="42" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="#41bfa2" />
              <stop offset="0.5" stopColor="#1fa388" />
              <stop offset="1" stopColor="#7563f5" />
            </linearGradient>
            <linearGradient id={`${uid}gl`} x1="24" y1="0" x2="24" y2="28" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fff" stopOpacity="0.28" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </>
        )}
        <mask id={`${uid}gap`} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          <circle cx={MARK.head.cx} cy={MARK.head.cy} r={MARK.gap} fill="#000" />
        </mask>
      </defs>
      {tile && (
        <>
          <rect width="48" height="48" rx="13" fill={`url(#${uid}bg)`} />
          <rect width="48" height="48" rx="13" fill={`url(#${uid}gl)`} />
          <rect x="0.5" y="0.5" width="47" height="47" rx="12.5" fill="none" stroke="#fff" strokeOpacity="0.18" />
        </>
      )}
      <g mask={`url(#${uid}gap)`} fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
        <path d={MARK.legs} strokeWidth="4.4" {...draw} />
        <path d={MARK.arms} strokeWidth="3.4" {...draw} style={animated ? { animationDelay: '.18s' } : undefined} />
      </g>
      <circle cx={MARK.head.cx} cy={MARK.head.cy} r={MARK.head.r} fill={ink} className={animated ? 'logo-pulse' : undefined} />
    </svg>
  );
}

/**
 * Mark + wordmark lockup. The wordmark follows the light/dark theme. `compact` drops "Network"
 * below 440px and the whole wordmark below 380px, where the lockup shares a row with buttons.
 */
export function Logo({ size = 34, compact = false, className = '' }: { size?: number; compact?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className={`whitespace-nowrap text-[15px] font-semibold tracking-[-0.02em] text-ink-950 ${compact ? 'max-[380px]:hidden' : ''}`}>
        Alumni Mentor <span className={`font-medium text-ink-500 ${compact ? 'max-[440px]:hidden' : ''}`}>Network</span>
      </span>
    </span>
  );
}
