'use client';
import { MapPin, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { AREA_LABELS } from '@/lib/format';
import type { Mentor } from '@/lib/types';
import { Ring, Tilt } from './motion';
import ShinyText from './reactbits/ShinyText';
import SpotlightCard from './reactbits/SpotlightCard';
import { Avatar, Badge, CapacityMeter } from './ui';

/**
 * Mentor card — the most-seen surface in the product.
 * Hierarchy: who (name, role) → why (match score + top reasons) → what (expertise) → can they take me (capacity).
 * React Bits SpotlightCard gives cursor-following light; a gentle 3D tilt keeps the depth of the brand.
 */
export function MentorCard({ m, topMatch = false }: { m: Mentor; topMatch?: boolean }) {
  return (
    <Tilt className="group h-full rounded-2xl" max={4} glare={false} scale={1.01}>
      <Link href={`/mentors/${m.id}`} className="block h-full rounded-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--ring)]">
        <SpotlightCard theme="light" spotlightColor="#1fa388" intensity={0.14} spotlightSize={260} className="flex h-full flex-col !rounded-2xl !p-5 transition-shadow duration-300 group-hover:shadow-depth">
          <div className="flex items-start justify-between gap-3">
            <Avatar name={m.name} size="lg" />
            <div className="flex flex-col items-end gap-1.5">
              {m.match && <Ring value={m.match.score} label="match" />}
            </div>
          </div>

          <div className="mt-3.5 min-w-0">
            {topMatch && (
              <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-50 to-violet-50 px-2 py-0.5 ring-1 ring-inset ring-brand-200">
                <Sparkles size={11} className="text-brand-600" />
                <ShinyText text="Top match for you" color="#12695a" shineColor="#7563f5" speed={3} className="text-[10.5px] font-semibold" />
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink-900">{m.name}</h3>
              {m.verified && (
                <span title="Verified alumnus" className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[9px] font-bold text-white">
                  ✓
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-[13px] leading-snug text-ink-600">{m.headline ?? m.currentRole}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-500">
              {m.industry && <span>{m.industry}</span>}
              {m.yearsExperience != null && <span>· {m.yearsExperience} yrs</span>}
              {m.city && (
                <span className="inline-flex items-center gap-0.5">
                  · <MapPin size={11} /> {m.city}
                </span>
              )}
            </p>
          </div>

          {m.match && m.match.reasons.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-[color:var(--line)] pt-3.5 text-[13px] text-ink-700">
              {m.match.reasons.slice(0, 2).map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-brand-400 to-iris-500" />
                  <span className="line-clamp-2">{r}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3.5 flex flex-wrap gap-1">
            {m.expertise.slice(0, 4).map((t) => (
              <Badge key={t.id}>{t.name}</Badge>
            ))}
            {m.mentoringAreas.slice(0, 1).map((a) => (
              <Badge key={a} tone="blue">
                {AREA_LABELS[a] ?? a}
              </Badge>
            ))}
          </div>
          <div className="mt-auto pt-4">
            <CapacityMeter capacity={m.capacity} compact />
          </div>
        </SpotlightCard>
      </Link>
    </Tilt>
  );
}
