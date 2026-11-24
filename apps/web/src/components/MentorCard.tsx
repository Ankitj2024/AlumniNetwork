'use client';
import { ArrowUpRight, BriefcaseBusiness, Check, Clock3, MapPin, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { AREA_LABELS } from '@/lib/format';
import { inr, usePaymentConfig } from '@/lib/payments';
import { useTheme } from '@/lib/theme';
import type { Mentor } from '@/lib/types';
import { Ring, Tilt } from './motion';
import ShinyText from './reactbits/ShinyText';
import SpotlightCard from './reactbits/SpotlightCard';
import { Avatar, CapacityMeter } from './ui';

/**
 * Mentor card — the most-seen surface in the product.
 * Reading order: who (avatar, name, role) → how well they fit (score + reasons) → what they know (tags)
 * → can I book them (capacity, fee). The spotlight is shared across neighbouring cards (proximity),
 * so moving through a grid feels like one light passing over it.
 */
export function MentorCard({ m, topMatch = false }: { m: Mentor; topMatch?: boolean }) {
  const { theme } = useTheme();
  const pay = usePaymentConfig();
  const dark = theme === 'dark';
  const role = m.currentRole ?? m.headline;
  const tags = m.expertise.slice(0, 3);
  const more = m.expertise.length - tags.length;
  const area = m.mentoringAreas[0];
  const showFee = !!pay?.enabled && m.sessionFee !== undefined;
  // What a booking would actually charge: the mentor's fee, capped by the programme's maximum.
  const fee = showFee ? Math.min(m.sessionFee!, pay!.maxSessionFee) : 0;

  return (
    <Tilt className="group h-full rounded-3xl" max={3} glare={false} scale={1.008}>
      <Link href={`/mentors/${m.id}`} className="block h-full rounded-3xl focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--ring)]">
        <SpotlightCard
          theme={theme}
          spotlightColor={dark ? '#5fd3b6' : '#1fa388'}
          intensity={dark ? 0.2 : 0.24}
          spotlightSize={320}
          softness={0.75}
          borderGlow={0.95}
          proximity={140}
          smoothing={0.22}
          className="flex h-full flex-col !rounded-3xl !p-0 transition-shadow duration-300 group-hover:shadow-depth"
        >
          {/* Identity */}
          <div className="px-5 pt-5">
            <div className="flex items-start gap-3.5">
              <div className="relative shrink-0">
                <Avatar name={m.name} size="lg" />
                {m.verified && (
                  <span title="Verified alumnus" className="absolute -bottom-0.5 -right-0.5 grid h-[22px] w-[22px] place-items-center rounded-full bg-brand-500 text-white shadow-[0_2px_6px_rgba(31,163,136,.45)] ring-[2.5px] ring-surface">
                    <Check size={12} strokeWidth={3.2} />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h3 className="truncate text-[16px] font-semibold leading-tight tracking-[-0.015em] text-ink-900">{m.name}</h3>
                {role && <p className="mt-0.5 truncate text-[13px] leading-snug text-ink-600">{role}</p>}
                {m.currentCompany && <p className="truncate text-[13px] font-medium leading-snug text-ink-800">{m.currentCompany}</p>}
              </div>
              {m.match && (
                <div className="-mr-1 -mt-1">
                  <Ring value={m.match.score} size={50} stroke={4.5} label="match" />
                </div>
              )}
            </div>

            {topMatch && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-50 to-violet-50 px-2.5 py-1 ring-1 ring-inset ring-brand-200">
                <Sparkles size={12} className="text-brand-600" />
                <ShinyText text="Top match for you" color={dark ? '#78d8bf' : '#12695a'} shineColor={dark ? '#b4a8ff' : '#7563f5'} speed={3} className="text-[11px] font-semibold" />
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5 text-[12px] text-ink-600">
              {m.industry && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-ink-50 px-2 py-1 ring-1 ring-inset ring-[color:var(--line)]">
                  <BriefcaseBusiness size={12} className="text-ink-400" /> {m.industry}
                </span>
              )}
              {m.yearsExperience != null && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-ink-50 px-2 py-1 ring-1 ring-inset ring-[color:var(--line)]">
                  <Clock3 size={12} className="text-ink-400" /> {m.yearsExperience} yrs
                </span>
              )}
              {m.city && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-ink-50 px-2 py-1 ring-1 ring-inset ring-[color:var(--line)]">
                  <MapPin size={12} className="text-ink-400" /> {m.city}
                </span>
              )}
            </div>
          </div>

          {/* Why this mentor */}
          {m.match && m.match.reasons.length > 0 && (
            <div className="mx-5 mt-4 rounded-2xl bg-gradient-to-br from-brand-50 to-transparent p-3.5 ring-1 ring-inset ring-[color:var(--line)]">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">Why you match</p>
              <ul className="mt-2 space-y-1.5">
                {m.match.reasons.slice(0, 2).map((r) => (
                  <li key={r} className="flex gap-2 text-[13px] leading-snug text-ink-700">
                    <span className="mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-500/15 text-brand-600">
                      <Check size={10} strokeWidth={3} />
                    </span>
                    <span className="line-clamp-2">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Expertise */}
          <div className="mt-3.5 flex flex-wrap gap-1.5 px-5">
            {tags.map((t) => (
              <span key={t.id} className="rounded-full border border-[color:var(--line-strong)] px-2.5 py-0.5 text-[12px] font-medium text-ink-700">
                {t.name}
              </span>
            ))}
            {more > 0 && <span className="rounded-full px-1.5 py-0.5 text-[12px] font-medium text-ink-400">+{more}</span>}
            {area && <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[12px] font-medium text-sky-800 ring-1 ring-inset ring-sky-200">{AREA_LABELS[area] ?? area}</span>}
          </div>

          {/* Availability and price */}
          <div className="mt-auto pt-4">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[color:var(--line)] px-5 py-3.5">
              {/* Labels never break mid-phrase; in a narrow card the price drops to its own line, right-aligned. */}
              <div className="min-w-0 [&_span]:whitespace-nowrap">
                <CapacityMeter capacity={m.capacity} compact />
              </div>
              <span className="ml-auto flex items-center gap-2 whitespace-nowrap">
                {showFee && (
                  <span className="text-[13px] font-semibold tabular-nums text-ink-900">
                    {fee > 0 ? (
                      <>
                        {inr(fee * 100)}
                        <span className="text-[12px] font-normal text-ink-500">/session</span>
                      </>
                    ) : (
                      <span className="text-brand-700">Free</span>
                    )}
                  </span>
                )}
                <ArrowUpRight size={16} className="text-ink-400 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink-900" />
              </span>
            </div>
          </div>
        </SpotlightCard>
      </Link>
    </Tilt>
  );
}
