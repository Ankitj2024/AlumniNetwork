'use client';
import { CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Avatar, EmptyState, LinkButton, PageHeader, PageLoader, StatusBadge, cx } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime, relTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Mentorship } from '@/lib/types';

export default function MentorshipsPage() {
  const { me } = useAuth();
  const [status, setStatus] = useState('active');
  const { data, loading } = useApi<{ mentorships: Mentorship[] }>(`/mentorships?status=${status}`);
  const unread = useApi<{ unread: Record<string, number> }>('/messages/unread');
  const isStudent = me?.user.role === 'student';

  return (
    <>
      <PageHeader icon={CalendarClock} eyebrow="Relationships" title={isStudent ? 'My mentorships' : 'My mentees'} />
      <div className="mb-4 flex gap-1">
        {['active', 'completed', 'ended', 'all'].map((s) => (
          <button key={s} className={cx('chip capitalize', status === s && 'chip-active')} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>
      {loading && !data ? (
        <PageLoader />
      ) : !data?.mentorships.length ? (
        <EmptyState title="Nothing here yet" body={isStudent ? 'Find a mentor who matches your goals.' : 'Accepted requests will appear here.'} action={isStudent ? <LinkButton href="/mentors" variant="primary">Find a mentor</LinkButton> : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.mentorships.map((m) => {
            const other = isStudent ? m.mentor : m.student;
            const n = unread.data?.unread[m.id] ?? 0;
            return (
              <Link key={m.id} href={`/mentorships/${m.id}`} className="card flex items-start gap-3 p-5 hover:shadow-md">
                <Avatar name={other.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{other.name}</span>
                    <StatusBadge status={m.status === 'active' ? m.health : m.status} />
                    {n > 0 && <span className="rounded-full bg-brand-600 px-2 text-xs text-white">{n} new</span>}
                  </div>
                  <p className="truncate text-sm text-ink-600">{isStudent ? m.mentor.headline : m.student.program}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    Since {fmtDate(m.startedAt)} · last activity {relTime(m.lastActivityAt)}
                    {m.nextSessionAt && <> · next session {fmtDateTime(m.nextSessionAt)}</>}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
