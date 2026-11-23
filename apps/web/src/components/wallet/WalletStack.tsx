'use client';
import { animate, AnimatePresence, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useSpring, useTransform, type MotionValue, type Transition } from 'framer-motion';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { WalletCardFace, type WalletCardData } from './WalletCardFace';

export type WalletTransaction = { id: string; merchant: string; detail: string; amount: number; icon?: ReactNode; avatar?: string };
export type WalletStackCard = WalletCardData & { balance: number; balanceLabel: string; transactions: WalletTransaction[] };

/* ── Sizes in px. Card proportions follow a real bank card (85.6 × 53.98 mm). ───────── */
const RATIO = 53.98 / 85.6;
const DEFAULT_W = 296; // 18.5rem
const PEEK_REST = 13; // how much of each card behind the front shows at rest
const PEEK_FAN = 42; // …and when the stack is fanned (pointer over it)
const STEP_REST = 0.05; // scale lost per card of depth
const STEP_FAN = 0.045;
const LIFT = 10; // hovered card rises out of the fan
const MAX_DEPTH = 3; // cards deeper than this fade out
const POCKET_PEEK = 44; // visible strip of the pocket at the bottom of the stage (enough to read the issuer)
const POCKET_GAP = 5; // offset between cards tucked in the pocket
const ABOVE_POCKET = 18; // space between the front card and the pocket
const ACTIVITY_GAP = 14;
const ACTIVITY_H = 168;
const STAGE_EXTRA = ACTIVITY_GAP + ACTIVITY_H + POCKET_PEEK; // stage = card height + this
const MAX_TILT = 5; // degrees
const PERSPECTIVE = 900;

/* Over-damped springs, plus a velocity cap in `run()`, so a moving value never passes its target. */
const SPRING = { type: 'spring', stiffness: 320, damping: 42, restDelta: 0.0005 } as const;
const FAN_SPRING = { type: 'spring', stiffness: 260, damping: 36, restDelta: 0.001 } as const;
type Spring = { type: 'spring'; stiffness: number; damping: number; restDelta: number; velocity?: number };

/**
 * An over-damped spring x(t) = A·e^(−r1·t) + B·e^(−r2·t) crosses its target only when the starting
 * speed toward it exceeds r1·distance (r1 = the faster decay rate). Clamp below that.
 */
function safeVelocity(v: number, from: number, to: number, s: Spring) {
  const dx = to - from;
  if (Math.abs(dx) < 1e-6) return 0;
  const disc = s.damping * s.damping - 4 * s.stiffness;
  const r1 = disc > 0 ? (s.damping + Math.sqrt(disc)) / 2 : s.damping / 2;
  if (Math.sign(v) !== Math.sign(dx)) return clamp(v, -6, 6); // moving away: it turns around without crossing
  return Math.sign(v) * Math.min(Math.abs(v), 0.9 * r1 * Math.abs(dx));
}
const TILT_SPRING = { stiffness: 220, damping: 26 };
const LIFT_SPRING = { stiffness: 380, damping: 40 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Soft limit: dragging beyond either end moves less and less. */
function rubber(v: number, lo: number, hi: number) {
  const band = (x: number) => (x * 0.9) / (1 + x * 2.5);
  if (v < lo) return lo - band(lo - v);
  if (v > hi) return hi + band(v - hi);
  return v;
}

type Placement = { top: number; scale: number; alpha: number; weight: number };

/**
 * Where card `i` sits, given the stack state. Every animation (keyboard, drag, open/close) only moves
 * the inputs, so all of them share one consistent picture. Stacking order is set once by index and
 * never swapped mid-animation.
 *   p    — which card is in front (fractional while moving)
 *   open — 0 closed … 1 a card lifted out; sel — the lifted card (fractional while switching)
 *   fan  — 0 resting … 1 spread out under the mouse; lift — hover rise of this card
 */
function place(i: number, n: number, p: number, openIn: number, fan: number, sel: number, lift: number, H: number, S: number): Placement {
  const open = clamp01(openIn);
  const frontTop = S - POCKET_PEEK - ABOVE_POCKET - H;
  const pocketTop = S - POCKET_PEEK;

  // Closed: cards ahead of p sit in the stack, cards behind it slide down into the pocket.
  let top: number;
  let scale = 1;
  let alpha = 1;
  const d = i - p;
  if (d >= 0) {
    const dd = Math.min(d, MAX_DEPTH);
    top = frontTop - dd * lerp(PEEK_REST, PEEK_FAN, fan) - lift * LIFT * fan;
    scale = 1 - dd * lerp(STEP_REST, STEP_FAN, fan);
    alpha = clamp01(MAX_DEPTH + 1 - d);
  } else if (d > -1) {
    top = lerp(frontTop, pocketTop, -d);
  } else {
    const k = -d - 1;
    top = pocketTop + k * POCKET_GAP;
    alpha = clamp01(MAX_DEPTH + 1 - k);
  }

  // Open: the chosen card moves to the top edge; the rest drop to the bottom strip.
  const w = clamp01(1 - Math.abs(i - sel));
  const topOpen = lerp(pocketTop + (n - 1 - i) * POCKET_GAP, 0, w);

  return {
    top: lerp(top, topOpen, open),
    scale: lerp(scale, 1, open),
    alpha: lerp(alpha, 1, open),
    // How much this card is "the active one" (front when closed, selected when open): drives tilt and light.
    weight: lerp(clamp01(1 - Math.abs(d)), w, open),
  };
}

type Shared = {
  p: MotionValue<number>;
  open: MotionValue<number>;
  fan: MotionValue<number>;
  sel: MotionValue<number>;
  hover: MotionValue<number>;
  rx: MotionValue<number>;
  ry: MotionValue<number>;
  lightOn: MotionValue<number>;
  lightX: MotionValue<string>;
  lightY: MotionValue<string>;
  H: MotionValue<number>;
  S: MotionValue<number>;
};

function CardLayer({
  index,
  n,
  card,
  mv,
  label,
  tabIndex,
  expanded,
  controls,
  isOpenCard,
  buttonRef,
  onSelect,
  onKey,
}: {
  index: number;
  n: number;
  card: WalletStackCard;
  mv: Shared;
  label: string;
  tabIndex: number;
  expanded: boolean;
  controls: string;
  isOpenCard: boolean;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onSelect: (i: number) => void;
  onKey: (e: React.KeyboardEvent) => void;
}) {
  const liftTarget = useTransform(mv.hover, (h): number => (h === index ? 1 : 0));
  const lift = useSpring(liftTarget, LIFT_SPRING);
  // Inputs to the layout: [p, open, fan, sel, lift, H, S]. Each derived value recomputes `place` (cheap).
  const { p, open, fan, sel, H, S, rx, ry, lightOn } = mv;
  const base = useMemo(() => [p, open, fan, sel, lift, H, S], [p, open, fan, sel, lift, H, S]);
  const at = (v: number[]) => place(index, n, v[0], v[1], v[2], v[3], v[4], v[5], v[6]);
  const transform = useTransform([...base, rx, ry], (v: number[]) => {
    const pl = at(v);
    const ty = pl.top - (v[5] * (1 - pl.scale)) / 2; // scale is about the centre; keep the top edge where `top` says
    return `perspective(${PERSPECTIVE}px) translate3d(0px, ${ty.toFixed(2)}px, 0px) scale(${pl.scale.toFixed(4)}) rotateX(${(v[7] * pl.weight).toFixed(2)}deg) rotateY(${(v[8] * pl.weight).toFixed(2)}deg)`;
  });
  const opacity = useTransform(base, (v: number[]) => at(v).alpha);
  const shadow = useTransform(base, (v: number[]) => 0.45 + 0.55 * Math.max(at(v).weight, v[4]));
  const lightOpacity = useTransform([...base, lightOn], (v: number[]) => v[7] * at(v).weight);

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      tabIndex={tabIndex}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={() => onSelect(index)}
      onKeyDown={onKey}
      className="absolute left-0 top-0 block w-full cursor-pointer rounded-[3.8cqw] text-left outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand-500"
      style={{ height: mv.H, transform, opacity, zIndex: n - index, transformOrigin: '50% 50%', touchAction: isOpenCard ? 'none' : undefined, WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Fixed box-shadow; animating its opacity is far cheaper than animating the shadow itself. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[3.8cqw]"
        style={{ opacity: shadow, boxShadow: '0 24px 40px -20px rgba(6, 10, 18, .6), 0 10px 18px -10px rgba(6, 10, 18, .4), 0 1px 2px rgba(6, 10, 18, .2)' }}
      />
      <span className="absolute inset-0">
        <WalletCardFace card={card} lightX={mv.lightX} lightY={mv.lightY} lightOpacity={lightOpacity} />
      </span>
    </motion.button>
  );
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type Drag = { id: number; y0: number; p0: number; o0: number; start: number; samples: { y: number; t: number }[]; moved: boolean; mode: 'cycle' | 'pull' };

export function WalletStack({
  cards,
  label = 'Wallet',
  currency = 'USD',
  locale = 'en-US',
  onSelectedChange,
  className = '',
  reducedMotion = false,
}: {
  cards: WalletStackCard[];
  /** Title shown over the stack; screen readers use it to name the group. */
  label?: string;
  currency?: string;
  locale?: string;
  /** Fires with the card that was opened, and with null once it is closed. */
  onSelectedChange?: (card: WalletStackCard | null) => void;
  className?: string;
  /** Force the reduced-motion behaviour (it is also used when the OS asks for less motion). */
  reducedMotion?: boolean;
}) {
  const n = cards.length;
  const osReduce = useReducedMotion();
  const reduce = reducedMotion || !!osReduce;
  const uid = useId().replace(/:/g, '');
  const labelId = `wallet-label-${uid}`;
  const hintId = `wallet-hint-${uid}`;
  const activityId = `wallet-activity-${uid}`;

  const fmt = useMemo(() => new Intl.NumberFormat(locale, { style: 'currency', currency }), [locale, currency]);
  const money = useCallback((a: number) => fmt.format(a), [fmt]);
  const signed = useCallback((a: number) => `${a < 0 ? '−' : '+'}${fmt.format(Math.abs(a))}`, [fmt]);

  /* Continuous state lives in motion values (updated per frame without React renders). */
  const p = useMotionValue(0);
  const open = useMotionValue(0);
  const fan = useMotionValue(0);
  const sel = useMotionValue(0);
  const hover = useMotionValue(-1);
  const rxT = useMotionValue(0);
  const ryT = useMotionValue(0);
  const lightOnT = useMotionValue(0);
  const lpx = useMotionValue(50);
  const lpy = useMotionValue(50);
  const rx = useSpring(rxT, TILT_SPRING);
  const ry = useSpring(ryT, TILT_SPRING);
  const lightOn = useSpring(lightOnT, TILT_SPRING);
  const lightXs = useSpring(lpx, TILT_SPRING);
  const lightYs = useSpring(lpy, TILT_SPRING);
  const lightX = useTransform(lightXs, (v) => `${(v - 50) / 2}%`); // the light layer is 2× the card, so half the percentage
  const lightY = useTransform(lightYs, (v) => `${(v - 50) / 2}%`);
  const H = useMotionValue(DEFAULT_W * RATIO);
  const S = useMotionValue(DEFAULT_W * RATIO + STAGE_EXTRA);
  const count = useMotionValue(cards[0]?.balance ?? 0);
  const countText = useTransform(count, (v) => money(v));
  const activityTop = useTransform(H, (h) => h + ACTIVITY_GAP);
  const activityOpacity = useTransform(open, (o) => clamp01((o - 0.35) / 0.65));
  const activityY = useTransform(open, (o) => (1 - o) * 16);
  const mv: Shared = { p, open, fan, sel, hover, rx, ry, lightOn, lightX, lightY, H, S };

  /* Discrete state, only for things React renders (count, tab order, aria). */
  const [front, setFront] = useState(0);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [shown, setShown] = useState(0);
  const [openSeq, setOpenSeq] = useState(0);
  const [announce, setAnnounce] = useState('');
  const openRef = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const fanTarget = useRef(0);

  const clampIdx = useCallback((i: number) => clamp(i, 0, n - 1), [n]);
  useMotionValueEvent(p, 'change', (v) => setFront(clamp(Math.round(v), 0, n - 1)));

  // Card height comes from the wallet's width; read it before the first paint and whenever it changes.
  useIsoLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const apply = (w: number) => {
      const h = w * RATIO;
      H.set(h);
      S.set(h + STAGE_EXTRA);
    };
    apply(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => apply(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [H, S]);

  const run = useCallback(
    (v: MotionValue<number>, to: number, s: Spring = SPRING, velocity?: number) => {
      if (reduce) {
        v.stop();
        v.set(to);
        return;
      }
      // Start from the given release speed, or the value's current speed if it was already moving.
      animate(v, to, { ...s, velocity: safeVelocity(velocity ?? v.getVelocity(), v.get(), to, s) } as Transition);
    },
    [reduce],
  );

  const resetPointerFx = useCallback(() => {
    hover.set(-1);
    rxT.set(0);
    ryT.set(0);
    lightOnT.set(0);
  }, [hover, rxT, ryT, lightOnT]);

  // With reduced motion, keep the stack still: no spreading, tilting or highlight.
  useEffect(() => {
    if (!reduce) return;
    fanTarget.current = 0;
    fan.set(0);
    resetPointerFx();
  }, [reduce, fan, resetPointerFx]);

  const geo = () => {
    const h = H.get();
    const s = S.get();
    return { W: h / RATIO, H: h, S: s, frontTop: s - POCKET_PEEK - ABOVE_POCKET - h, pocketTop: s - POCKET_PEEK };
  };
  const focusCard = (i: number) => btnRefs.current[i]?.focus({ preventScroll: true });

  const go = (to: number, velocity = 0) => {
    const t = clampIdx(to);
    run(p, t, SPRING, velocity);
    setAnnounce(`${cards[t].issuer} ${cards[t].product} in front, ${t + 1} of ${n}`);
  };

  const openCard = (i: number) => {
    const c = cards[i];
    const wasOpen = openRef.current !== null;
    openRef.current = i;
    setOpenIdx(i);
    setShown(i);
    setOpenSeq((s) => s + 1);
    if (!wasOpen && open.get() < 0.02) sel.set(i);
    else run(sel, i);
    run(p, i);
    run(open, 1);
    fanTarget.current = 0;
    run(fan, 0, FAN_SPRING);
    hover.set(-1);
    if (reduce) count.set(c.balance);
    else {
      count.set(0);
      animate(count, c.balance, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    }
    setAnnounce(`${c.issuer} ${c.product} opened. ${c.balanceLabel}: ${money(c.balance)}.`);
    onSelectedChange?.(c);
  };

  const close = (velocity = 0, returnFocus = true) => {
    const i = openRef.current;
    if (i === null) return;
    openRef.current = null;
    setOpenIdx(null);
    run(open, 0, SPRING, velocity);
    setAnnounce(`${cards[i].issuer} ${cards[i].product} back in the stack, ${i + 1} of ${n}`);
    onSelectedChange?.(null);
    if (returnFocus) focusCard(i);
  };

  const onSelect = (i: number) => {
    if (suppressClick.current) return; // the click at the end of a drag isn't a choice
    const o = openRef.current;
    if (o !== null) {
      if (i === o) close();
      else openCard(i);
      return;
    }
    const f = clampIdx(Math.round(p.get()));
    if (i < f) {
      go(i); // a card in the pocket comes back to the front
      focusCard(i);
    } else openCard(i);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const o = openRef.current;
    const cur = o ?? clampIdx(Math.round(p.get()));
    let t: number;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        t = cur + 1;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        t = cur - 1;
        break;
      case 'Home':
        t = 0;
        break;
      case 'End':
        t = n - 1;
        break;
      case 'Escape':
        if (o !== null) {
          e.preventDefault();
          close();
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    t = clampIdx(t);
    if (t === cur) return;
    if (o !== null) openCard(t);
    else go(t);
    focusCard(t);
  };

  /* Pointer: hover fan + tilt (mouse only), and vertical drag for cycling / pulling an open card down. */
  const track = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || reduce || drag.current?.moved) return;
    const r = stageRef.current!.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const g = geo();
    const o = openRef.current;
    if (o === null) {
      if (fanTarget.current !== 1) {
        fanTarget.current = 1;
        run(fan, 1, FAN_SPRING);
      }
      // The hovered card comes from the pointer position against the fanned layout, not from
      // enter/leave on moving cards, so a card rising out from under the pointer doesn't flicker.
      let h = -1;
      if (y < g.frontTop) {
        const d = Math.ceil((g.frontTop - y) / PEEK_FAN);
        const idx = clampIdx(Math.round(p.get())) + d;
        if (d <= MAX_DEPTH && idx < n) h = idx;
      }
      if (hover.get() !== h) hover.set(h);
    }
    const top = o === null ? g.frontTop : 0;
    if (x >= 0 && x <= g.W && y >= top && y <= top + g.H) {
      const px = x / g.W;
      const py = (y - top) / g.H;
      rxT.set((0.5 - py) * 2 * MAX_TILT);
      ryT.set((px - 0.5) * 2 * MAX_TILT);
      lpx.set(px * 100);
      lpy.set(py * 100);
      lightOnT.set(1);
    } else {
      rxT.set(0);
      ryT.set(0);
      lightOnT.set(0);
    }
  };

  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || drag.current?.moved) return;
    fanTarget.current = 0;
    run(fan, 0, FAN_SPRING);
    resetPointerFx();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    suppressClick.current = false;
    const r = stageRef.current!.getBoundingClientRect();
    const y = e.clientY - r.top;
    const o = openRef.current;
    let mode: Drag['mode'] | null = null;
    if (o === null) mode = 'cycle';
    else if (y <= geo().H) mode = 'pull'; // only the open card can be pulled down
    if (!mode) return;
    drag.current = { id: e.pointerId, y0: e.clientY, p0: p.get(), o0: open.get(), start: clampIdx(Math.round(p.get())), samples: [{ y: e.clientY, t: performance.now() }], moved: false, mode };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) {
      track(e);
      return;
    }
    const dy = e.clientY - d.y0;
    if (!d.moved) {
      if (Math.abs(dy) < 5) {
        track(e);
        return;
      }
      d.moved = true;
      try {
        stageRef.current!.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointers can't be captured */
      }
      (d.mode === 'cycle' ? p : open).stop();
      d.p0 = p.get();
      d.o0 = open.get();
      d.y0 = e.clientY;
      resetPointerFx();
    }
    const now = performance.now();
    d.samples.push({ y: e.clientY, t: now });
    while (d.samples.length > 2 && now - d.samples[0].t > 100) d.samples.shift();
    const g = geo();
    const dist = e.clientY - d.y0;
    if (d.mode === 'cycle') p.set(rubber(d.p0 + dist / (g.H + ABOVE_POCKET), 0, n - 1));
    else open.set(clamp01(d.o0 - Math.max(0, dist) / g.pocketTop));
  };

  const endDrag = (e: React.PointerEvent, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    try {
      stageRef.current!.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
    if (!d.moved) return;
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 0);
    const a = d.samples[0];
    const b = d.samples[d.samples.length - 1];
    const vy = cancelled || b.t === a.t ? 0 : ((b.y - a.y) / (b.t - a.t)) * 1000; // px/s
    const g = geo();
    if (d.mode === 'cycle') {
      const travel = g.H + ABOVE_POCKET;
      const v = vy / travel; // cards per second
      const projected = p.get() + v * 0.18; // look ~0.18 s ahead at the release speed
      go(clampIdx(clamp(Math.round(projected), d.start - 1, d.start + 1)), v); // never more than one card per gesture
    } else {
      const pulled = b.y - d.y0;
      const v = -vy / g.pocketTop;
      if (pulled > 70 || vy > 550) close(v, false);
      else run(open, 1, SPRING, v);
    }
  };

  // Touch devices have no hover, so steer the highlight with the phone's orientation sensor when it reports one.
  useEffect(() => {
    if (reduce || typeof window === 'undefined' || !window.matchMedia('(pointer: coarse)').matches) return;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      lpx.set(clamp(50 + e.gamma * 1.2, 0, 100));
      lpy.set(clamp(50 + (e.beta - 40) * 1.2, 0, 100));
      lightOnT.set(1);
    };
    window.addEventListener('deviceorientation', onTilt);
    return () => window.removeEventListener('deviceorientation', onTilt);
  }, [reduce, lpx, lpy, lightOnT]);

  if (!n) return null;
  const active = cards[shown];

  return (
    <div className={`mx-auto w-full max-w-[18.5rem] [container-type:inline-size] ${className}`}>
      <div className="mb-3 flex h-8 items-center justify-between gap-3">
        <h3 id={labelId} className="truncate text-[15px] font-semibold tracking-tight text-ink-900">
          {label}
        </h3>
        <AnimatePresence mode="wait" initial={false}>
          {openIdx === null ? (
            <motion.span key="count" className="text-[13px] tabular-nums text-ink-500" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              {front + 1} of {n}
            </motion.span>
          ) : (
            <motion.button
              key="all"
              type="button"
              onClick={() => close()}
              className="rounded-full bg-ink-100 px-3 py-1 text-[12.5px] font-medium text-ink-700 transition-colors hover:bg-ink-200"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              All cards
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        ref={stageRef}
        role="group"
        aria-labelledby={labelId}
        aria-describedby={hintId}
        className="relative select-none"
        // overflow-y: clip hides the pocket's lower cards; x stays visible so tilted edges and shadows aren't cut.
        // (overflow-y: hidden would force x to scroll; a CSS mask would break the glass card's backdrop blur.)
        style={{ height: S, overflowX: 'visible', overflowY: 'clip', touchAction: openIdx === null ? 'pan-x' : 'pan-y' }}
        onPointerEnter={track}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.stopPropagation();
            e.preventDefault();
            suppressClick.current = false;
          }
        }}
      >
        {/* Details panel for the open card; unfocusable (inert) while every card is in the stack. */}
        <motion.div id={activityId} inert={openIdx === null} aria-hidden={openIdx === null} className="absolute inset-x-0" style={{ top: activityTop, opacity: activityOpacity, y: activityY }}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[13.5px] text-ink-500">{active.balanceLabel}</span>
            <motion.span className="text-[24px] font-semibold tracking-tight tabular-nums text-ink-900">{countText}</motion.span>
          </div>
          <ul className="mt-1.5">
            {active.transactions.slice(0, 3).map((t, k) => (
              <motion.li
                key={`${openSeq}-${t.id}`}
                className="flex h-10 items-center gap-3"
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32, delay: 0.16 + k * 0.07 }}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-ink-100 text-ink-600">
                  {t.avatar ? <img src={t.avatar} alt="" className="h-full w-full object-cover" /> : t.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium leading-tight text-ink-900">{t.merchant}</span>
                  <span className="block truncate text-[12px] leading-tight text-ink-500">{t.detail}</span>
                </span>
                <span className={`shrink-0 text-[14px] font-medium tabular-nums ${t.amount < 0 ? 'text-ink-900' : 'text-emerald-600 dark:text-emerald-400'}`}>{signed(t.amount)}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {cards.map((c, i) => (
          <CardLayer
            key={c.id}
            index={i}
            n={n}
            card={c}
            mv={mv}
            label={`${c.issuer} ${c.product} ending in ${c.lastFour}, ${i + 1} of ${n}, ${c.balanceLabel.toLowerCase()} ${money(c.balance)}`}
            tabIndex={(openIdx ?? front) === i ? 0 : -1}
            expanded={openIdx === i}
            controls={activityId}
            isOpenCard={openIdx === i}
            buttonRef={(el) => {
              btnRefs.current[i] = el;
            }}
            onSelect={onSelect}
            onKey={onKey}
          />
        ))}
      </motion.div>

      <p id={hintId} className="sr-only">
        Use the arrow keys to move between cards, Enter to open one, and Escape to close it.
      </p>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
