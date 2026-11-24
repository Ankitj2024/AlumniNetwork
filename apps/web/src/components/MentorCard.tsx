'use client';
import { ArrowUpRight, BriefcaseBusiness, Check, Clock3, MapPin, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { AREA_LABELS } from '@/lib/format';
import { inr, usePaymentConfig } from '@/lib/payments';
import type { Mentor } from '@/lib/types';
import { Ring } from './motion';
import { Avatar, CapacityMeter } from './ui';

/**
 * Mentor card — the most-seen surface in the product.
 * Reading order: who (avatar, name, role) → how well they fit (score + reasons) → what they know (tags)
 * → can I book them (capacity, fee). A plain white card that lifts a little on hover.
 */
export function MentorCard({ m, topMatch = false }: { m: Mentor; topMatch?: boolean }) {
  const pay = usePaymentConfig();
  const role = m.currentRole ?? m.headline;
  const tags = m.expertise.slice(0, 3);
  const more = m.expertise.length - tags.length;
  const area = m.mentoringAreas[0];
  const showFee = !!pay?.enabled && m.sessionFee !== undefined;
  // What a booking would actually charge: the mentor's fee, capped by the programme's maximum.
  const fee = showFee ? Math.min(m.sessionFee!, pay!.maxSessionFee) : 0;

  return (
      <Link href={`/mentors/${m.id}`} className="group block h-full rounded-[22px] focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--ring)]">
        <div className="card flex h-full flex-col transition-[box-shadow,transform] duration-300 group-hover:-translate-y-0.5 group-hover:shadow-depth">
          {/* Identity */}
          <div className="px-5 pt-5">
            <div className="flex items-start gap-3.5">
              <div className="relative shrink-0">
                <Avatar name={m.name} size="lg" />
                {m.verified && (
                  <span title="Verified alumnus" className="absolute -bottom-0.5 -right-0.5 grid h-[22px] w-[22px] place-items-center rounded-full bg-brand-600 text-white ring-[2.5px] ring-surface">
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
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11.5px] font-semibold text-brand-700">
                <Sparkles size={12} /> Top match for you
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5 text-[12px] text-ink-600">
              {m.industry && (
                <span className="inline-flex items-center gap-1 rounded-full bg-ink-900/[0.04] px-2.5 py-1">
                  <BriefcaseBusiness size={12} className="text-ink-400" /> {m.industry}
                </span>
              )}
              {m.yearsExperience != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-ink-900/[0.04] px-2.5 py-1">
                  <Clock3 size={12} className="text-ink-400" /> {m.yearsExperience} yrs
                </span>
              )}
              {m.city && (
                <span className="inline-flex items-center gap-1 rounded-full bg-ink-900/[0.04] px-2.5 py-1">
                  <MapPin size={12} className="text-ink-400" /> {m.city}
                </span>
              )}
            </div>
          </div>

          {/* Why this mentor */}
          {m.match && m.match.reasons.length > 0 && (
            <div className="mx-5 mt-4 rounded-2xl bg-ink-900/[0.03] p-3.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">Why you match</p>
              <ul className="mt-2 space-y-1.5">
                {m.match.reasons.slice(0, 2).map((r) => (
                  <li key={r} className="flex gap-2 text-[13px] leading-snug text-ink-700">
                    <span className="mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ok-50 text-ok-700">
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
            {area && <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[12px] font-medium text-brand-800">{AREA_LABELS[area] ?? area}</span>}
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
                      <span className="text-ok-700">Free</span>
                    )}
                  </span>
                )}
                <ArrowUpRight size={16} className="text-ink-400 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink-900" />
              </span>
            </div>
          </div>
        </div>
      </Link>
  );
}
