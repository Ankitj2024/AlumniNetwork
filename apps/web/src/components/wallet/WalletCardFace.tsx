'use client';
import { motion, type MotionValue } from 'framer-motion';
import { useId, type CSSProperties, type ReactNode } from 'react';

export type CardVariant = 'metal' | 'black' | 'glass' | 'color';

export type WalletCardData = {
  id: string;
  issuer: string;
  product: string;
  lastFour: string;
  holder: string;
  expires?: string;
  variant?: CardVariant;
  /** Base colour for the `color` finish (any CSS colour value). */
  tint?: string;
  /** Logo for the bottom-right corner. Leave it out for the demo "nova" mark, or pass null for none. */
  network?: ReactNode | null;
  /** Background picture, blended into the card. */
  image?: string;
};

/*
 * Card faces are physical objects, so their colours are fixed hex/rgba values rather than the
 * theme tokens (globals.css re-colours tokens like text-brand-700 in dark mode).
 * Sizes use cqw (percent of the wallet's width), so text, chip and spacing grow and shrink with the card.
 */

type Material = { face: CSSProperties; ink: string; sub: string; emboss: string; chip: 'gold' | 'silver'; edge: string; light: number };

function material(variant: CardVariant, tint = 'oklch(45% 0.11 160)'): Material {
  switch (variant) {
    case 'black':
      return {
        face: { background: 'linear-gradient(140deg, #232937 0%, #121621 48%, #1b2130 100%)' },
        ink: '#eef1f6',
        sub: 'rgba(214, 220, 232, 0.72)',
        emboss: '0 1px 1px rgba(0,0,0,.55), 0 -1px 0 rgba(255,255,255,.06)',
        chip: 'silver',
        edge: 'inset 0 0 0 1px rgba(255,255,255,.07), inset 0 1px 0 rgba(255,255,255,.12)',
        light: 0.32,
      };
    case 'glass':
      return {
        face: {
          background:
            'radial-gradient(120% 90% at 18% 8%, rgba(255,255,255,.34), rgba(255,255,255,0) 52%), linear-gradient(145deg, rgba(126, 206, 178, .62) 0%, rgba(58, 136, 112, .58) 52%, rgba(28, 92, 76, .66) 100%)',
          backdropFilter: 'blur(14px) saturate(150%)',
          WebkitBackdropFilter: 'blur(14px) saturate(150%)',
        },
        ink: '#ffffff',
        sub: 'rgba(255,255,255,.78)',
        emboss: '0 1px 1px rgba(0, 40, 30, .35)',
        chip: 'silver',
        edge: 'inset 0 0 0 1px rgba(255,255,255,.34), inset 0 1px 0 rgba(255,255,255,.5)',
        light: 0.42,
      };
    case 'color':
      return {
        face: {
          background: `radial-gradient(110% 80% at 85% 0%, rgba(255,255,255,.16), rgba(255,255,255,0) 55%), linear-gradient(155deg, color-mix(in oklch, ${tint} 80%, white) 0%, ${tint} 45%, color-mix(in oklch, ${tint} 72%, black) 100%)`,
        },
        ink: '#ffffff',
        sub: 'rgba(255,255,255,.76)',
        emboss: '0 1px 1px rgba(0,0,0,.32)',
        chip: 'gold',
        edge: 'inset 0 0 0 1px rgba(255,255,255,.14), inset 0 1px 0 rgba(255,255,255,.28)',
        light: 0.36,
      };
    case 'metal':
    default:
      return {
        face: {
          // Spun metal: a conic sheen centred right of middle, plus fine concentric brushing.
          background: [
            'repeating-radial-gradient(circle at 62% 46%, rgba(255,255,255,.07) 0 1px, rgba(0,0,0,.035) 1px 2px)',
            'conic-gradient(from 12deg at 62% 46%, #d6d8dc, #f6f7f8 8%, #c4c7cc 17%, #eef0f2 27%, #cdd0d4 37%, #f8f8f9 47%, #c2c5ca 57%, #eceef0 68%, #c9ccd1 79%, #f4f5f6 90%, #d6d8dc)',
          ].join(', '),
        },
        ink: '#2a2e35',
        sub: 'rgba(52, 57, 66, .72)',
        emboss: '0 1px 0 rgba(255,255,255,.75), 0 -1px 0 rgba(0,0,0,.12)',
        chip: 'gold',
        edge: 'inset 0 0 0 1px rgba(255,255,255,.55), inset 0 -1px 0 rgba(0,0,0,.08)',
        light: 0.55,
      };
  }
}

/* Fine wavy rings for the black card, generated once (deterministic, so server and client match). */
const GUILLOCHE = (() => {
  const out: string[] = [];
  const cx = 610;
  const cy = 250;
  for (let j = 0; j < 30; j++) {
    const R = 36 + j * 15;
    const A = 5 + (j % 4) * 1.6;
    const ph = j * 0.33;
    let d = '';
    for (let s = 0; s <= 260; s++) {
      const t = (s / 260) * Math.PI * 2;
      const r = R + A * Math.sin(14 * t + ph) + 2.6 * Math.sin(5 * t - ph * 2);
      d += `${s ? 'L' : 'M'}${(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * Math.sin(t)).toFixed(1)}`;
    }
    out.push(`${d}Z`);
  }
  return out;
})();

function Guilloche() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 856 540" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {GUILLOCHE.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth={1.1} />
      ))}
    </svg>
  );
}

function Chip({ tone }: { tone: 'gold' | 'silver' }) {
  const id = useId().replace(/:/g, '');
  const stops = tone === 'gold' ? ['#f6dd97', '#cfa64f', '#f1d07c', '#b98d38'] : ['#f4f5f7', '#b3b8c0', '#e9ebee', '#9ea3ab'];
  return (
    <svg viewBox="0 0 50 38" className="h-auto w-[15.5cqw] drop-shadow-[0_1px_1px_rgba(0,0,0,.25)]" aria-hidden>
      <defs>
        <linearGradient id={`chip-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset=".38" stopColor={stops[1]} />
          <stop offset=".62" stopColor={stops[2]} />
          <stop offset="1" stopColor={stops[3]} />
        </linearGradient>
      </defs>
      <rect x=".6" y=".6" width="48.8" height="36.8" rx="7" fill={`url(#chip-${id})`} stroke="rgba(0,0,0,.22)" strokeWidth=".8" />
      <path d="M0 12.5h15.5M0 25.5h15.5M34.5 12.5H50M34.5 25.5H50M15.5 0v38M34.5 0v38M15.5 19h19" stroke="rgba(60,40,0,.3)" strokeWidth="1.1" fill="none" />
      <rect x="19.5" y="9" width="11" height="20" rx="3.5" fill="none" stroke="rgba(60,40,0,.3)" strokeWidth="1.1" />
    </svg>
  );
}

function Contactless() {
  return (
    <svg viewBox="0 0 24 24" className="w-[6.4cqw] opacity-80" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
      <path d="M6.5 9a4.5 4.5 0 0 1 0 6" />
      <path d="M10 6.5a8.5 8.5 0 0 1 0 11" />
      <path d="M13.5 4a12.5 12.5 0 0 1 0 16" />
      <path d="M17 1.8a16 16 0 0 1 0 20.4" />
    </svg>
  );
}

/** Fictional card network for the demo: a four-point spark and the word "nova". */
function NovaMark() {
  return (
    <span className="inline-flex items-center gap-[1.2cqw] text-[4.5cqw] font-semibold tracking-tight">
      <svg viewBox="0 0 20 20" className="w-[4.6cqw]" aria-hidden>
        <path d="M10 1.5c.7 4.6 3.9 7.8 8.5 8.5-4.6.7-7.8 3.9-8.5 8.5-.7-4.6-3.9-7.8-8.5-8.5 4.6-.7 7.8-3.9 8.5-8.5Z" fill="currentColor" />
      </svg>
      nova
    </span>
  );
}

export function WalletCardFace({
  card,
  lightX,
  lightY,
  lightOpacity,
}: {
  card: WalletCardData;
  lightX: MotionValue<string>;
  lightY: MotionValue<string>;
  lightOpacity: MotionValue<number>;
}) {
  const m = material(card.variant ?? 'metal', card.tint);
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[3.8cqw]" style={{ ...m.face, color: m.ink }} aria-hidden>
      {card.image && <img src={card.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90 mix-blend-overlay" draggable={false} />}
      {card.variant === 'black' && <Guilloche />}

      {/* Highlight: a fixed radial glow that slides with the pointer; only its position and opacity animate. */}
      <motion.div
        className="pointer-events-none absolute -inset-1/2"
        style={{
          x: lightX,
          y: lightY,
          opacity: lightOpacity,
          background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,${m.light}) 0%, rgba(255,255,255,${m.light * 0.35}) 14%, rgba(255,255,255,0) 32%)`,
          mixBlendMode: card.variant === 'metal' ? 'soft-light' : 'overlay',
        }}
      />

      <div className="relative flex h-full flex-col px-[7cqw] pb-[6.2cqw] pt-[6.4cqw]">
        <div className="flex items-baseline justify-between gap-[3cqw]">
          <span className="truncate text-[6.3cqw] font-semibold tracking-[-0.01em]" style={{ textShadow: m.emboss }}>
            {card.issuer}
          </span>
          <span className="shrink-0 text-[3.7cqw]" style={{ color: m.sub }}>
            {card.product}
          </span>
        </div>

        <div className="mt-[6.4cqw] flex items-center gap-[3.2cqw]">
          <Chip tone={m.chip} />
          <Contactless />
        </div>

        <div className="mt-[5cqw] flex items-baseline gap-[2.4cqw] font-mono" style={{ textShadow: m.emboss }}>
          <span className="text-[4.4cqw] tracking-[0.12em]" style={{ color: m.sub }}>
            •••• •••• ••••
          </span>
          <span className="text-[7.2cqw] font-medium tracking-[0.08em]">{card.lastFour}</span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-[3cqw]">
          <span className="truncate text-[4cqw] font-medium" style={{ textShadow: m.emboss }}>
            {card.holder}
          </span>
          <div className="flex items-end gap-[5cqw]">
            {card.expires && (
              <span className="flex flex-col leading-none">
                <span className="text-[2.3cqw]" style={{ color: m.sub }}>
                  Valid thru
                </span>
                <span className="mt-[0.8cqw] font-mono text-[4.2cqw]" style={{ textShadow: m.emboss }}>
                  {card.expires}
                </span>
              </span>
            )}
            {card.network === undefined ? <NovaMark /> : card.network}
          </div>
        </div>
      </div>

      {/* Physical edge: a hairline highlight on top of everything. */}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ boxShadow: m.edge }} />
    </div>
  );
}
