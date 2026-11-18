'use client';
import { Gauge } from 'lucide-react';
import { useState } from 'react';
import { Badge, Bar, CapacityMeter, PageHeader, PageLoader, Stat, cx } from '@/components/ui';
import { useApi } from '@/lib/hooks';

export default function CapacityOverview() {
  const { data, loading } = useApi<{ mentors: any[] }>('/admin/capacity');
  const [filter, setFilter] = useState<'all' | 'warnings' | 'open'>('warnings');
  if (loading && !data) return <PageLoader />;
  const all = data?.mentors ?? [];
  const rows = all.filter((m) => (filter === 'warnings' ? m.warnings.length : filter === 'open' ? m.capacity.accepting : true));
  const total = all.reduce((a, m) => a + m.capacity.maxMentees, 0);
  const used = all.reduce((a, m) => a + m.capacity.activeCount, 0);

  return (
    <>
      <PageHeader icon={Gauge} eyebrow="Programme" title="Mentor capacity" subtitle="Spot overload early. Mentors who burn out leave the programme." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Slots used" value={`${used} / ${total}`} hint={`${total ? Math.round((used / total) * 100) : 0}% utilisation`} />
        <Stat label="Accepting now" value={all.filter((m) => m.capacity.accepting).length} tone="good" />
        <Stat label="At capacity" value={all.filter((m) => m.warnings.includes('At capacity') || m.warnings.includes('Over limit')).length} />
        <Stat label="With warnings" value={all.filter((m) => m.warnings.length).length} tone="warn" />
      </div>
      <div className="mb-4 flex gap-1">
        {(['warnings', 'open', 'all'] as const).map((f) => (
          <button key={f} className={cx('chip capitalize', filter === f && 'chip-active')} onClick={() => setFilter(f)}>
            {f === 'warnings' ? 'Needs attention' : f === 'open' ? 'Accepting' : 'All'}
          </button>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-ink-100 bg-ink-50 text-left text-xs uppercase text-ink-500">
            <tr>
              <th className="px-4 py-2.5">Mentor</th>
              <th className="px-4 py-2.5">Capacity</th>
              <th className="px-4 py-2.5">Utilisation</th>
              <th className="px-4 py-2.5">Open requests</th>
              <th className="px-4 py-2.5">Warnings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.mentorId} className="border-b border-ink-100 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-ink-500">{m.industry}</div>
                </td>
                <td className="px-4 py-3">
                  <CapacityMeter capacity={m.capacity} compact />
                </td>
                <td className="w-40 px-4 py-3">
                  <Bar value={m.utilisation} tone={m.utilisation >= 100 ? 'amber' : 'brand'} />
                  <div className="mt-1 text-xs text-ink-500">{m.utilisation}%</div>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {m.pendingRequests} / {m.maxPendingRequests}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {m.warnings.map((w: string) => (
                      <Badge key={w} tone={w === 'Over limit' ? 'red' : w === 'Paused' ? 'gray' : 'amber'}>
                        {w}
                      </Badge>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-sm text-ink-500">No mentors in this view.</p>}
      </div>
    </>
  );
}
