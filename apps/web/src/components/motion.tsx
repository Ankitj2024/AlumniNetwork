'use client';
import { animate, motion, useInView, useReducedMotion, type Variants } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

const spring = { stiffness: 260, damping: 22, mass: 0.6 };

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
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = tone === 'amber' ? '#ff9f0a' : tone === 'red' ? '#ff453a' : 'var(--color-primary)';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'rgb(var(--ink-900) / 0.08)' }} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          style={{ stroke: color }}
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
        <span className="text-sm font-semibold tabular-nums tracking-[-0.02em] text-ink-900">
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
