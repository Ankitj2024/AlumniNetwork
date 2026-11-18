'use client';
import { LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { Badge, Card, PageHeader, PageLoader, Stat, useToast } from '@/components/ui';
import { post } from '@/lib/api';
import { relTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';

export default function AdminOverview() {
  const toast = useToast();
  const { data, loading, reload } = useApi<Record<string, number>>('/admin/overview');
  const queue = useApi<{ verifications: any[] }>('/alumni/verify/queue?status=pending');
  const health = useApi<{ mentorships: any[] }>('/admin/engagement?health=lapsed');
  const cap = useApi<{ mentors: any[] }>('/admin/capacity');

  if (loading && !data) return <PageLoader />;
  const d = data ?? {};

  async function run(job: string) {
    const r = await post<{ result: any }>(`/admin/jobs/${job}/run`);
    toast(`${job} job ran: ${JSON.stringify(r.result)}`);
    reload();
    health.reload();
  }

  return (
    <>
      <PageHeader icon={LayoutDashboard} eyebrow="Alumni relations"
        title="Programme overview"
        subtitle="Alumni relations at a glance."
        actions={
          <>
            <button className="btn-secondary" onClick={() => run('expiry')}>
              Run expiry sweep
            </button>
            <button className="btn-secondary" onClick={() => run('engagement')}>
              Run engagement check
            </button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Pending verifications" value={d.pendingVerifications} tone={d.pendingVerifications > 0 ? 'warn' : undefined} />
        <Stat label="Verified mentors" value={d.verifiedMentors} />
        <Stat label="Students" value={d.students} />
        <Stat label="Active mentorships" value={d.activeMentorships} tone="good" />
        <Stat label="Open requests" value={d.pendingRequests} />
        <Stat label="At risk" value={d.atRisk} tone={d.atRisk ? 'warn' : undefined} />
        <Stat label="Lapsed" value={d.lapsed} tone={d.lapsed ? 'bad' : undefined} />
        <Stat label="Mentors at capacity" value={d.mentorsAtCapacity} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Verification queue" actions={<Link href="/admin/verification" className="text-sm text-brand-700">Review</Link>}>
          {(queue.data?.verifications ?? []).slice(0, 5).map((v) => (
            <div key={v.id} className="flex items-center justify-between border-b border-ink-100 py-2 text-sm last:border-0">
              <span>{v.submitted?.fullName}</span>
              <span className="text-xs text-ink-500">{v.matchResult?.matched ? 'Record match' : 'Needs review'}</span>
            </div>
          ))}
          {queue.data?.verifications.length === 0 && <p className="muted">Queue is empty.</p>}
        </Card>
        <Card title="Lapsed mentorships" actions={<Link href="/admin/engagement" className="text-sm text-brand-700">Health board</Link>}>
          {(health.data?.mentorships ?? []).slice(0, 5).map((m) => (
            <div key={m.id} className="flex items-center justify-between border-b border-ink-100 py-2 text-sm last:border-0">
              <span className="truncate">
                {m.student.name} ↔ {m.mentor.name}
              </span>
              <span className="text-xs text-ink-500">{relTime(m.lastActivityAt)}</span>
            </div>
          ))}
          {health.data?.mentorships.length === 0 && <p className="muted">None — great.</p>}
        </Card>
        <Card title="Overload warnings" actions={<Link href="/admin/capacity" className="text-sm text-brand-700">Capacity</Link>}>
          {(cap.data?.mentors ?? [])
            .filter((m) => m.warnings.length)
            .slice(0, 6)
            .map((m) => (
              <div key={m.mentorId} className="flex items-center justify-between border-b border-ink-100 py-2 text-sm last:border-0">
                <span>{m.name}</span>
                <span className="flex flex-wrap justify-end gap-1">
                  {m.warnings.slice(0, 2).map((w: string) => (
                    <Badge key={w} tone={w === 'Over limit' ? 'red' : w === 'Paused' ? 'gray' : 'amber'}>
                      {w}
                    </Badge>
                  ))}
                </span>
              </div>
            ))}
        </Card>
      </div>
    </>
  );
}
