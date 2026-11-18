'use client';
import { HeartPulse } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Bar, PageHeader, PageLoader, Stat, StatusBadge, cx, useToast } from '@/components/ui';
import { post } from '@/lib/api';
import { fmtDate, relTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';

export default function EngagementBoard() {
  const toast = useToast();
  const [health, setHealth] = useState('all');
  const { data, loading, reload } = useApi<{ mentorships: any[] }>(`/admin/engagement?health=${health}`);
  const all = useApi<{ mentorships: any[] }>('/admin/engagement?health=all');

  async function nudge(id: string) {
    try {
      await post(`/mentorships/${id}/nudge`);
      toast('Nudge sent to both participants');
      reload();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  const counts = (all.data?.mentorships ?? []).reduce<Record<string, number>>((a, m) => ((a[m.health] = (a[m.health] ?? 0) + 1), a), {});
  return (
    <>
      <PageHeader icon={HeartPulse} eyebrow="Programme" title="Engagement health" subtitle="Weekly decay detection flags quiet mentorships. Participants are nudged automatically; you can nudge again here." />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Healthy" value={counts.healthy ?? 0} tone="good" />
        <Stat label="At risk" value={counts.at_risk ?? 0} tone="warn" />
        <Stat label="Lapsed" value={counts.lapsed ?? 0} tone="bad" />
      </div>
      <div className="mb-4 flex gap-1">
        {['all', 'at_risk', 'lapsed', 'healthy'].map((h) => (
          <button key={h} className={cx('chip capitalize', health === h && 'chip-active')} onClick={() => setHealth(h)}>
            {h.replace('_', ' ')}
          </button>
        ))}
      </div>
      {loading && !data ? (
        <PageLoader />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-ink-100 bg-ink-50 text-left text-xs uppercase text-ink-500">
              <tr>
                <th className="px-4 py-2.5">Student ↔ Mentor</th>
                <th className="px-4 py-2.5">Health</th>
                <th className="px-4 py-2.5">Score</th>
                <th className="px-4 py-2.5">Last activity</th>
                <th className="px-4 py-2.5">Last nudged</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {data?.mentorships.map((m) => (
                <tr key={m.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/mentorships/${m.id}`} className="font-medium hover:text-brand-700">
                      {m.student.name} ↔ {m.mentor.name}
                    </Link>
                    <div className="text-xs text-ink-500">since {fmtDate(m.startedAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.health} />
                  </td>
                  <td className="w-36 px-4 py-3">
                    <Bar value={m.healthScore} tone={m.health === 'lapsed' ? 'red' : m.health === 'at_risk' ? 'amber' : 'brand'} />
                    <div className="mt-1 text-xs text-ink-500">{m.healthScore}</div>
                  </td>
                  <td className="px-4 py-3">
                    {m.daysSinceActivity} days <span className="text-xs text-ink-500">({relTime(m.lastActivityAt)})</span>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{m.lastNudgedAt ? relTime(m.lastNudgedAt) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {m.health !== 'healthy' && (
                      <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => nudge(m.id)}>
                        Nudge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
