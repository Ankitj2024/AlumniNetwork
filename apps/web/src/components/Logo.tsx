'use client';
import { useId } from 'react';

/**
 * Brand mark — the "network A".
 *
 * An A whose apex is a mentor node, set apart from the strokes by a small gap, and whose
 * crossbar is an arc. Read as a figure it is someone with open arms; read as a diagram it is a
 * node and its connections.
 *
 * Monochrome: a graphite tile with a light mark in the light theme, the reverse in the dark
 * theme. Drawn on a 48-unit grid. src/app/icon.svg (the favicon) uses the same geometry; keep the
 * two in sync. Every instance gets its own mask id via useId(), because the app can render hidden
 * and visible copies side by side and shared ids would resolve to the hidden one.
 */
export const MARK = {
  legs: 'M13 37A30 30 0 0 1 24 16A30 30 0 0 1 35 37',
  arms: 'M14.4 30.2Q24 25.2 33.6 30.2',
  head: { cx: 24, cy: 13.4, r: 4.9 },
  gap: 7.6,
} as const;

/** The glyph alone as standalone SVG markup (white on transparent), for the glass reveal. */
export const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 6 32 34"><defs><mask id="g" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48"><rect width="48" height="48" fill="#fff"/><circle cx="${MARK.head.cx}" cy="${MARK.head.cy}" r="${MARK.gap}" fill="#000"/></mask></defs><g mask="url(#g)" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"><path d="${MARK.legs}" stroke-width="4.4"/><path d="${MARK.arms}" stroke-width="3.4"/></g><circle cx="${MARK.head.cx}" cy="${MARK.head.cy}" r="${MARK.head.r}" fill="#fff"/></svg>`;

type MarkProps = {
  size?: number;
  className?: string;
  /** `tile`: the mark on a monochrome tile (default). `glyph`: the mark alone in currentColor. */
  variant?: 'tile' | 'glyph';
  /** Strokes draw themselves in a loop; used by the page loader. */
  animated?: boolean;
  /** Accessible name; omit when a visible wordmark sits next to it. */
  title?: string;
};

export function LogoMark({ size = 32, className = '', variant = 'tile', animated = false, title }: MarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tile = variant === 'tile';
  const draw = animated ? { pathLength: 1, className: 'logo-draw' } : {};

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={`shrink-0 ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <mask id={`${uid}gap`} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          <circle cx={MARK.head.cx} cy={MARK.head.cy} r={MARK.gap} fill="#000" />
        </mask>
      </defs>
      {tile && <rect width="48" height="48" rx="13" className="fill-ink-900" />}
      <g mask={`url(#${uid}gap)`} fill="none" className={tile ? 'stroke-ink-50' : 'stroke-current'} strokeLinecap="round" strokeLinejoin="round">
        <path d={MARK.legs} strokeWidth="4.4" {...draw} />
        <path d={MARK.arms} strokeWidth="3.4" {...draw} style={animated ? { animationDelay: '.18s' } : undefined} />
      </g>
      <circle cx={MARK.head.cx} cy={MARK.head.cy} r={MARK.head.r} className={`${tile ? 'fill-ink-50' : 'fill-current'} ${animated ? 'logo-pulse' : ''}`} />
    </svg>
  );
}

/**
 * Mark + wordmark lockup. The wordmark follows the light/dark theme. `compact` drops "Network"
 * below 440px and the whole wordmark below 380px, where the lockup shares a row with buttons.
 */
export function Logo({ size = 30, compact = false, className = '' }: { size?: number; compact?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className={`whitespace-nowrap text-[15px] font-semibold tracking-[-0.02em] text-ink-900 ${compact ? 'max-[380px]:hidden' : ''}`}>
        Alumni Mentor <span className={`font-normal text-ink-500 ${compact ? 'max-[440px]:hidden' : ''}`}>Network</span>
      </span>
    </span>
  );
}
