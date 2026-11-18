'use client';
import { BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { Bar, Card, PageHeader, PageLoader, Stat } from '@/components/ui';
import { DECLINE_LABELS } from '@/lib/format';
import { useApi } from '@/lib/hooks';

function MonthBars({ data, label }: { data: { month: string; count: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (!data.length) return <p className="muted">No data in range.</p>;
  return (
    <div>
      <div className="flex h-40 items-end gap-1.5" role="img" aria-label={label}>
        {data.map((d) => (
          <div key={d.month} className="group flex flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-[10px] tabular-nums text-ink-500 opacity-0 group-hover:opacity-100">{d.count}</span>
            <div className="w-full rounded-t bg-brand-500" style={{ height: `${(d.count / max) * 100}%`, minHeight: 2 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {data.map((d) => (
          <span key={d.month} className="flex-1 truncate text-center text-[10px] text-ink-500">
            {d.month.slice(2)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const qs = `from=${from}&to=${to}`;
  const { data, loading } = useApi<{ report: any }>(`/analytics/programme?${qs}`);
  const pl = useApi<{ correlation: any }>('/analytics/placement');

  if (loading && !data) return <PageLoader />;
  const r = data!.report;
  const c = pl.data?.correlation;

  return (
    <>
      <PageHeader icon={BarChart3} eyebrow="Insights"
        title="Programme report"
        subtitle="Participation, sessions, goals and outcomes. Aggregate data only — no personal contact details."
        actions={
          <>
            <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
            <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
            <a className="btn-secondary" href={`/api/analytics/programme.csv?${qs}`}>
              Export CSV
            </a>
            <button className="btn-secondary" onClick={() => window.print()}>
              Print
            </button>
          </>
        }
      />

      <h2 className="h2 mb-3">Participation</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Student participation" value={`${r.participation.participationRate}%`} hint={`${r.participation.studentsMentored} of ${r.participation.students} students`} />
        <Stat label="Mentor participation" value={`${r.participation.mentorParticipationRate}%`} hint={`${r.participation.mentorsActive} of ${r.participation.mentorsVerified} verified mentors`} />
        <Stat label="Active mentorships" value={r.participation.activeMentorships} hint={`${r.participation.mentorshipsStarted} started in range`} />
        <Stat label="Mentor utilisation" value={`${r.utilisation.utilisationRate}%`} hint={`${r.utilisation.slotsUsed}/${r.utilisation.slotsTotal} slots · ${r.utilisation.mentorsAtCapacity} full`} />
      </div>

      <h2 className="h2 mb-3 mt-8">Requests, sessions & goals</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Request acceptance" value={`${r.requests.acceptanceRate}%`} hint={`${r.requests.total} requests · ${r.requests.expiryRate}% expired`} />
        <Stat label="Median response" value={r.requests.medianResponseHours != null ? `${r.requests.medianResponseHours} h` : '—'} />
        <Stat label="Session completion" value={`${r.sessions.completionRate}%`} hint={`${r.sessions.completed} sessions held`} />
        <Stat label="Goal completion" value={`${r.goals.completionRate}%`} hint={`${r.goals.achieved}/${r.goals.total} goals · ${r.goals.actionCompletionRate}% actions done`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Mentorships started per month">
          <MonthBars data={r.trends.mentorshipsStarted} label="Mentorships started per month" />
        </Card>
        <Card title="Sessions completed per month">
          <MonthBars data={r.trends.sessionsCompleted} label="Sessions completed per month" />
        </Card>

        <Card title="Engagement">
          <div className="space-y-3 text-sm">
            {[
              ['Healthy', r.engagement.healthy, 'brand'],
              ['At risk', r.engagement.atRisk, 'amber'],
              ['Lapsed', r.engagement.lapsed, 'red'],
            ].map(([l, v, t]) => (
              <div key={l as string}>
                <div className="mb-1 flex justify-between">
                  <span>{l}</span>
                  <span className="tabular-nums">{v as number}</span>
                </div>
                <Bar value={v as number} max={Math.max(1, r.engagement.healthy + r.engagement.atRisk + r.engagement.lapsed)} tone={t as any} />
              </div>
            ))}
            <p className="pt-2 text-ink-600">
              {r.engagement.decayEvents} decay events detected · {r.engagement.recoveries} recoveries after a nudge
            </p>
          </div>
        </Card>

        <Card title="Satisfaction">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs uppercase text-ink-500">Students rate mentors</div>
              <div className="mt-1 text-3xl font-semibold">{r.satisfaction.studentRatingOfMentors?.avg ?? '—'}</div>
              <div className="text-xs text-ink-500">{r.satisfaction.studentRatingOfMentors?.responses ?? 0} responses</div>
            </div>
            <div>
              <div className="text-xs uppercase text-ink-500">Mentors rate students</div>
              <div className="mt-1 text-3xl font-semibold">{r.satisfaction.mentorRatingOfStudents?.avg ?? '—'}</div>
              <div className="text-xs text-ink-500">{r.satisfaction.mentorRatingOfStudents?.responses ?? 0} responses</div>
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-2 text-xs uppercase text-ink-500">Decline reasons</div>
            <ul className="space-y-1 text-sm">
              {r.requests.declineReasons.map((d: any) => (
                <li key={d.reason} className="flex justify-between">
                  <span>{DECLINE_LABELS[d.reason] ?? (d.reason === 'no_reason_given' ? 'No reason given' : d.reason)}</span>
                  <span className="tabular-nums">{d.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {c && (
          <Card title="Mentoring and placement outcomes" className="lg:col-span-2">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Placement — mentored" value={`${c.mentored.placementRate}%`} hint={`${c.mentored.students} students`} tone="good" />
                <Stat label="Placement — not mentored" value={`${c.notMentored.placementRate}%`} hint={`${c.notMentored.students} students`} />
              </div>
              <div className="space-y-2">
                {c.bySessions.map((b: any) => (
                  <div key={b.bucket}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{b.bucket}</span>
                      <span className="tabular-nums text-ink-600">
                        {b.placementRate}% placed · n={b.students}
                      </span>
                    </div>
                    <Bar value={b.placementRate} />
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-500">{c.note}</p>
          </Card>
        )}
      </div>
    </>
  );
}
