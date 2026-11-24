'use client';
import { motion } from 'framer-motion';
import { BadgeCheck, Briefcase, GraduationCap, type LucideIcon } from 'lucide-react';
import { Avatar, cx } from './ui';

/**
 * Profile building blocks in the shape people know from LinkedIn: a cover, an overlapping
 * avatar, name, headline and place, then section cards (About, Experience, Education, Skills…).
 * Used by the mentor profile students see (/mentors/[id]) and by both "your profile" pages.
 * Shows only what the platform holds; contact details never appear here.
 */

const COVERS = [
  'from-[#dfe9fb] via-[#ebe6fb] to-[#f5efe6] dark:from-[#16223a] dark:via-[#211b35] dark:to-[#2a2218]',
  'from-[#e2f1ea] via-[#e6eefa] to-[#efe9f8] dark:from-[#12291f] dark:via-[#15213a] dark:to-[#241c33]',
  'from-[#f6e9e2] via-[#efe6f6] to-[#e3ecfb] dark:from-[#2e1d16] dark:via-[#251b33] dark:to-[#15213a]',
  'from-[#e6ecf3] via-[#eef0f4] to-[#e4eef0] dark:from-[#1b2230] dark:via-[#1e2128] dark:to-[#18262a]',
];

function coverFor(name: string) {
  const n = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return COVERS[n % COVERS.length];
}

export function ProfileHeader({
  name,
  headline,
  lines = [],
  verified = false,
  avatarUrl,
  badges,
  actions,
  note,
}: {
  name: string;
  headline?: string | null;
  /** Secondary lines under the headline, e.g. "Senior Data Scientist at Quantia AI", "Bengaluru · Fintech". */
  lines?: (string | null | undefined | false)[];
  verified?: boolean;
  avatarUrl?: string | null;
  /** Small pills under the text (match score, capacity…). */
  badges?: React.ReactNode;
  /** Buttons on the right (Request mentorship, Save…). */
  actions?: React.ReactNode;
  /** A quiet line above the card, e.g. "This is how mentors see you". */
  note?: React.ReactNode;
}) {
  const shown = lines.filter(Boolean) as string[];
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="card overflow-hidden" aria-label={`${name}’s profile`}>
      <div className={cx('h-28 bg-gradient-to-br sm:h-40', coverFor(name))} aria-hidden />
      <div className="px-6 pb-6 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="-mt-14 rounded-full ring-4 ring-surface sm:-mt-16">
            <Avatar name={name} size="xl" src={avatarUrl} />
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 pt-3">{actions}</div>}
        </div>
        {note && <p className="mt-3 text-[12.5px] text-ink-400">{note}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] sm:text-[30px]">{name}</h1>
          {verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-[12px] font-medium text-brand-700" title="Verified against institution records">
              <BadgeCheck size={14} /> Verified alumnus
            </span>
          )}
        </div>
        {headline && <p className="mt-1.5 max-w-2xl text-[16px] leading-snug text-ink-700">{headline}</p>}
        {shown.length > 0 && (
          <div className="mt-2 space-y-0.5 text-[14px] text-ink-500">
            {shown.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
        )}
        {badges && <div className="mt-4 flex flex-wrap items-center gap-2">{badges}</div>}
      </div>
    </motion.section>
  );
}

export function ProfileSection({ title, action, children, className = '' }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className={cx('card p-6 sm:p-7', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em]">{title}</h2>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

/** One entry in Experience / Education, with a square monogram like a company logo. */
export function ProfileEntry({ icon: Icon, monogram, title, subtitle, meta, children }: { icon?: LucideIcon; monogram?: string; title: string; subtitle?: string | null; meta?: string | null; children?: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-ink-900/[0.05] text-[15px] font-semibold text-ink-600">{monogram ? monogram.slice(0, 2).toUpperCase() : Icon ? <Icon size={20} /> : null}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug">{title}</p>
        {subtitle && <p className="text-[14px] text-ink-700">{subtitle}</p>}
        {meta && <p className="mt-0.5 text-[13px] text-ink-500">{meta}</p>}
        {children}
      </div>
    </div>
  );
}

export const ExperienceIcon = Briefcase;
export const EducationIcon = GraduationCap;

/** Chips for skills and help areas. */
export function Chips({ items, tone = 'plain' }: { items: string[]; tone?: 'plain' | 'accent' }) {
  if (!items.length) return <p className="text-[14px] text-ink-400">Nothing added yet.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => (
        <span key={t} className={cx('rounded-full px-3 py-1 text-[13px] font-medium', tone === 'accent' ? 'bg-brand-50 text-brand-800' : 'bg-ink-900/[0.05] text-ink-700')}>
          {t}
        </span>
      ))}
    </div>
  );
}
