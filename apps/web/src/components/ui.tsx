'use client';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LogoMark } from './Logo';
import { CountUp } from './motion';
import SpotlightCard from './reactbits/SpotlightCard';
import { initials } from '@/lib/format';
import type { Capacity } from '@/lib/types';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={cx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)} aria-label="Loading" />;
}

/** Branded loader: the logo mark draws itself. */
export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24" role="status" aria-label="Loading">
      <LogoMark size={44} animated />
      <span className="text-xs font-medium uppercase tracking-widest text-ink-400">Loading</span>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow, icon: Icon }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string; icon?: LucideIcon }) {
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {(eyebrow || Icon) && (
          <div className="mb-2 flex items-center gap-2">
            {Icon && (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[color:var(--line)] bg-white text-brand-600 shadow-sm">
                <Icon size={15} />
              </span>
            )}
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          </div>
        )}
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </motion.div>
  );
}

export function Card({ children, className = '', title, actions }: { children: React.ReactNode; className?: string; title?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }} className={cx('card', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] px-5 py-3.5">
          <h2 className="h2">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </motion.section>
  );
}

const TONES = {
  gray: 'bg-ink-100/80 text-ink-700 ring-1 ring-inset ring-ink-200/70',
  green: 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200',
  amber: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200',
  red: 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-200',
  blue: 'bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200',
  violet: 'bg-violet-50 text-violet-800 ring-1 ring-inset ring-violet-200',
};
export function Badge({ children, tone = 'gray', className = '' }: { children: React.ReactNode; tone?: keyof typeof TONES; className?: string }) {
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', TONES[tone], className)}>{children}</span>;
}

export function statusTone(s: string): keyof typeof TONES {
  return (
    ({
      pending: 'amber',
      accepted: 'green',
      active: 'green',
      verified: 'green',
      approved: 'green',
      completed: 'blue',
      scheduled: 'blue',
      proposed: 'violet',
      declined: 'gray',
      withdrawn: 'gray',
      expired: 'gray',
      ended: 'gray',
      cancelled: 'gray',
      rejected: 'red',
      no_show: 'red',
      needs_info: 'amber',
      unverified: 'gray',
      healthy: 'green',
      at_risk: 'amber',
      lapsed: 'red',
    } as Record<string, keyof typeof TONES>)[s] ?? 'gray'
  );
}
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={statusTone(status)}>{status.replace(/_/g, ' ')}</Badge>;

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'warn' | 'bad' | 'good' }) {
  return (
    <SpotlightCard theme="light" spotlightColor={tone === 'warn' ? '#f59e0b' : tone === 'bad' ? '#ef4444' : '#1fa388'} intensity={0.12} spotlightSize={220} className="!rounded-2xl !p-4">
      <div className="flex items-center gap-2">
        <span className={cx('h-1.5 w-1.5 rounded-full', tone === 'warn' ? 'bg-amber-500' : tone === 'bad' ? 'bg-red-500' : tone === 'good' ? 'bg-brand-500' : 'bg-ink-300')} />
        <span className="eyebrow">{label}</span>
      </div>
      <div className={cx('mt-2 text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums', tone === 'warn' && 'text-amber-700', tone === 'bad' && 'text-red-700', tone === 'good' && 'text-brand-700')}>
        {typeof value === 'number' || typeof value === 'string' ? <CountUp value={value} /> : value}
      </div>
      {hint && <div className="mt-1.5 text-xs text-ink-500">{hint}</div>}
    </SpotlightCard>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="canvas-dots rounded-2xl border border-dashed border-ink-200 bg-white/60 px-6 py-12 text-center">
      <div className="relative mx-auto mb-4 h-12 w-12" style={{ perspective: 300 }} aria-hidden>
        <div className="absolute inset-0 animate-float rounded-2xl bg-gradient-to-br from-brand-300 to-iris-400 opacity-90 shadow-glow" />
        <div className="absolute inset-[5px] rounded-xl bg-white/90" />
        <div className="absolute inset-[14px] rounded-md bg-gradient-to-br from-brand-400 to-iris-500" />
      </div>
      <p className="font-medium text-ink-800">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}

export function ErrorBox({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</div>;
}

const AVATAR_GRADS = ['from-brand-400 to-brand-700', 'from-iris-400 to-iris-600', 'from-sky-400 to-indigo-600', 'from-emerald-400 to-teal-700', 'from-fuchsia-400 to-violet-600', 'from-amber-400 to-orange-600'];
export function Avatar({ name, size = 'md', src }: { name: string; size?: 'sm' | 'md' | 'lg'; src?: string | null }) {
  const s = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm';
  const g = AVATAR_GRADS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_GRADS.length];
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" referrerPolicy="no-referrer" className={cx('shrink-0 rounded-full object-cover shadow-md ring-2 ring-white', s)} />;
  return (
    <div className={cx('flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-[0_4px_12px_-2px_rgba(21,28,39,.35),inset_0_1px_0_rgba(255,255,255,.35)] ring-2 ring-white', g, s)}>
      {initials(name)}
    </div>
  );
}

/** Clear capacity indication — a core design requirement. */
export function CapacityMeter({ capacity, compact }: { capacity?: Capacity; compact?: boolean }) {
  if (!capacity) return null;
  const { maxMentees, activeCount, openSlots, paused } = capacity;
  const label = paused ? 'Paused' : openSlots > 0 ? `${openSlots} of ${maxMentees} slot${maxMentees === 1 ? '' : 's'} open` : 'Full';
  return (
    <div className={cx('flex items-center gap-2', compact ? 'text-xs' : 'text-sm')}>
      <div className="flex gap-0.5" aria-hidden>
        {Array.from({ length: Math.max(maxMentees, 1) }).map((_, i) => (
          <motion.span
            key={i}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ delay: 0.05 * i, type: 'spring', stiffness: 300, damping: 20 }}
            className={cx(
              'h-3 w-4 origin-bottom rounded-[4px] shadow-sm',
              paused ? 'bg-ink-200' : i < activeCount ? 'bg-gradient-to-b from-ink-600 to-ink-800' : 'bg-gradient-to-b from-brand-300 to-brand-500 shadow-[0_0_8px_rgba(65,191,162,.6)]',
            )}
          />
        ))}
      </div>
      <span className={cx('font-medium', paused ? 'text-ink-500' : openSlots > 0 ? 'text-brand-700' : 'text-ink-500')}>{label}</span>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            role="dialog"
            aria-modal
            className="max-h-[92vh] w-full overflow-auto rounded-t-3xl border border-white/70 bg-white shadow-depth sm:max-w-lg sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 40, rotateX: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, rotateX: 10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            style={{ transformPerspective: 1000 }}
          >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h3 className="font-semibold">{title}</h3>
          <button className="btn-ghost px-2 py-1" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: React.ReactNode }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="-mx-4 mb-5 overflow-x-auto border-b border-ink-200 px-4 sm:mx-0 sm:px-0">
      <div className="flex gap-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => onChange(t.id)} className={cx('relative whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors', active === t.id ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800')}>
            {t.label}
            {active === t.id && <motion.span layoutId="tab-underline" className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-brand-500 to-iris-500" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, error }: { label: string; children: React.ReactNode; hint?: string; error?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}

export function ChipToggle({ options, value, onChange, max }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; max?: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            type="button"
            key={o.value}
            className={cx('chip', on && 'chip-active')}
            onClick={() => (on ? onChange(value.filter((x) => x !== o.value)) : (!max || value.length < max) && onChange([...value, o.value]))}
          >
            {on && '✓ '}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Bar({ value, max = 100, tone = 'brand' }: { value: number; max?: number; tone?: 'brand' | 'amber' | 'red' | 'ink' }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const c = { brand: 'from-brand-400 to-iris-500', amber: 'from-amber-300 to-amber-500', red: 'from-red-400 to-red-600', ink: 'from-ink-500 to-ink-700' }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100 shadow-[inset_0_1px_2px_rgba(21,28,39,.08)]">
      <motion.div className={cx('h-full rounded-full bg-gradient-to-r', c)} initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}

export const LinkButton = ({ href, children, variant = 'secondary' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'secondary' | 'ghost' }) => (
  <Link href={href} className={variant === 'primary' ? 'btn-primary' : variant === 'ghost' ? 'btn-ghost' : 'btn-secondary'}>
    {children}
  </Link>
);

/* ---------------------------------------------------------------- toasts */
type Toast = { id: number; text: string; tone: 'ok' | 'err' };
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'err') => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              role="status"
              layout
              initial={{ opacity: 0, y: 30, scale: 0.9, rotateX: 30 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className={cx('pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm font-medium shadow-depth backdrop-blur', t.tone === 'ok' ? 'bg-ink-900/95 text-white' : 'bg-red-700/95 text-white')}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
