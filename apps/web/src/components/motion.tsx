'use client';
import { animate, motion, useInView, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform, type HTMLMotionProps, type Variants } from 'framer-motion';
import { useEffect, useId, useRef, useState } from 'react';

const spring = { stiffness: 260, damping: 22, mass: 0.6 };

/**
 * 3D tilt: the element rotates toward the cursor with spring physics and a soft light glare.
 * Disabled automatically for reduced-motion users and on touch devices (no hover).
 */
export function Tilt({ children, className = '', max = 8, glare = true, scale = 1.015, ...rest }: { children: React.ReactNode; className?: string; max?: number; glare?: boolean; scale?: number } & Omit<HTMLMotionProps<'div'>, 'children'>) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), spring);
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), spring);
  const s = useSpring(1, spring);
  const gx = useTransform(px, [0, 1], ['0%', '100%']);
  const gy = useTransform(py, [0, 1], ['0%', '100%']);
  const glareBg = useMotionTemplate`radial-gradient(circle at ${gx} ${gy}, rgba(255,255,255,.55), rgba(255,255,255,0) 55%)`;
  const glareOpacity = useSpring(0, spring);

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={`[transform-style:preserve-3d] ${className}`}
      style={{ rotateX: rx, rotateY: ry, scale: s, transformPerspective: 900 }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse' || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width);
        py.set((e.clientY - r.top) / r.height);
        s.set(scale);
        glareOpacity.set(0.6);
      }}
      onPointerLeave={() => {
        px.set(0.5);
        py.set(0.5);
        s.set(1);
        glareOpacity.set(0);
      }}
      {...rest}
    >
      {children}
      {glare && <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-soft-light" style={{ background: glareBg, opacity: glareOpacity }} />}
    </motion.div>
  );
}

/** Fades and lifts content into view on scroll. */
export function Reveal({ children, delay = 0, y = 18, className = '' }: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -40px 0px' });
  const [shown, setShown] = useState(false);
  // Also reveal anything already above the fold or scrolled past (fast scrolls, anchor jumps,
  // throttled background tabs) so content can never get stuck invisible.
  useEffect(() => {
    if (shown) return;
    const check = () => {
      const el = ref.current;
      if (el && el.getBoundingClientRect().top < window.innerHeight) setShown(true);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    const t = setInterval(check, 800);
    return () => {
      window.removeEventListener('scroll', check);
      clearInterval(t);
    };
  }, [shown]);
  const visible = inView || shown;
  return (
    <motion.div ref={ref} className={className} initial={{ opacity: 0, y }} animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y }} transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

export const staggerParent: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };
export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 16, rotateX: -12, scale: 0.98 },
  show: { opacity: 1, y: 0, rotateX: 0, scale: 1, transition: { type: 'spring', stiffness: 220, damping: 24 } },
};

export function Stagger({ children, className = '', as = 'div' }: { children: React.ReactNode; className?: string; as?: 'div' | 'ul' }) {
  const C = as === 'ul' ? motion.ul : motion.div;
  return (
    <C className={className} variants={staggerParent} initial="hidden" animate="show" style={{ perspective: 1200 }}>
      {children}
    </C>
  );
}
export function StaggerItem({ children, className = '', as = 'div' }: { children: React.ReactNode; className?: string; as?: 'div' | 'li' }) {
  const C = as === 'li' ? motion.li : motion.div;
  return (
    <C className={className} variants={staggerChild}>
      {children}
    </C>
  );
}

/** Animates a number up from zero when it scrolls into view. Non-numeric values render as-is. */
export function CountUp({ value, decimals, suffix = '', prefix = '' }: { value: number | string | null | undefined; decimals?: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  // Only plain numbers ("42", "4.5") and percentages ("58.7%") animate; anything else ("25 / 142", "83 h") renders as-is.
  const simple = typeof value === 'string' ? /^\s*(-?\d+(?:\.\d+)?)\s*(%?)\s*$/.exec(value) : null;
  const num = typeof value === 'number' ? value : simple ? Number(simple[1]) : NaN;
  const textSuffix = simple ? simple[2] : '';
  const d = decimals ?? (Number.isInteger(num) ? 0 : 1);
  const [shown, setShown] = useState(reduce || !isFinite(num) ? num : 0);

  useEffect(() => {
    if (!inView || !isFinite(num) || reduce) {
      setShown(num);
      return;
    }
    const c = animate(0, num, { duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setShown(v) });
    // Background tabs throttle animation frames; guarantee the true value is shown regardless.
    const t = setTimeout(() => {
      c.stop();
      setShown(num);
    }, 1400);
    return () => {
      c.stop();
      clearTimeout(t);
    };
  }, [inView, num, reduce]);

  if (value == null || (typeof value === 'string' && !isFinite(num))) return <span ref={ref}>{value ?? '—'}</span>;
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {shown.toFixed(d)}
      {textSuffix || suffix}
    </span>
  );
}

/** Circular animated score ring (match score, health). */
export function Ring({ value, size = 52, stroke = 5, label, tone = 'brand' }: { value: number; size?: number; stroke?: number; label?: string; tone?: 'brand' | 'amber' | 'red' }) {
  const gid = `ring${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = tone === 'amber' ? '#f59e0b' : tone === 'red' ? '#ef4444' : `url(#${gid})`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#41bfa2" />
            <stop offset="100%" stopColor="#7563f5" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'rgb(var(--ink-100))' }} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(100, value)) / 100) }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-sm font-bold tabular-nums text-ink-900">
          <CountUp value={value} />
        </span>
        {label && <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-ink-500">{label}</span>}
      </div>
    </div>
  );
}

/** Entrance animation for each routed page. */
export function PageTransition({ children, routeKey }: { children: React.ReactNode; routeKey: string }) {
  return (
    <motion.div key={routeKey} initial={{ opacity: 0, y: 14, scale: 0.995 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

/** Floating, slowly drifting gradient blobs behind content. */
export function Aurora({ dark = false, contained = false }: { dark?: boolean; contained?: boolean }) {
  return (
    <div className="aurora" style={contained ? { position: 'absolute' } : undefined} aria-hidden>
      <span className="animate-aurora" style={{ width: '46vw', height: '46vw', left: '-10vw', top: '-12vw', background: dark ? '#13836e' : '#aeead7' }} />
      <span className="animate-aurora-slow" style={{ width: '40vw', height: '40vw', right: '-12vw', top: '10vh', background: dark ? '#5e48e0' : '#d9d3ff' }} />
      <span className="animate-aurora" style={{ width: '34vw', height: '34vw', left: '30vw', bottom: '-14vw', background: dark ? '#0e7490' : '#c7ecff', animationDelay: '-7s' }} />
    </div>
  );
}
