'use client';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CalendarClock, LayoutGrid, MessagesSquare, Star, Target } from 'lucide-react';
import { Avatar, Badge, ErrorBox, Modal, PageLoader, StatusBadge, Tabs, useToast } from '@/components/ui';
import { post } from '@/lib/api';
import { fmtDate, relTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { CareerGoal, Mentorship } from '@/lib/types';
import { FeedbackTab, GoalsTab, MessagesTab, OverviewTab, SessionsTab } from './tabs';

function Inner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState(params.get('tab') ?? 'overview');
  const { data, loading, error, reload } = useApi<{ mentorship: Mentorship; careerGoals: CareerGoal[]; stats: { sessionsCompleted: number; goals: number; openActions: number } }>(`/mentorships/${id}`);
  const [ending, setEnding] = useState(false);
  const [endReason, setEndReason] = useState('');

  if (loading && !data) return <PageLoader />;
  if (error || !data) return <ErrorBox message={error ?? 'Not found'} />;
  const m = data.mentorship;
  const role = m.viewerRole;
  const other = role === 'student' ? m.mentor : m.student;
  const active = m.status === 'active';

  async function end(outcome: 'completed' | 'ended') {
    try {
      await post(`/mentorships/${id}/end`, { outcome, reason: endReason || undefined });
      toast('Mentorship closed. Thank you!');
      setEnding(false);
      reload();
      setTab('feedback');
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  const change = (t: string) => {
    setTab(t);
    router.replace(`/mentorships/${id}?tab=${t}`, { scroll: false });
  };

  return (
    <>
      <div className="card relative isolate mb-6 flex flex-col gap-4 overflow-hidden p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 -z-10 h-56 w-56 rounded-full bg-gradient-to-br from-brand-200/60 to-violet-200/50 blur-3xl" />
        <div className="flex items-center gap-3">
          <Avatar name={other.name} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{other.name}</h1>
              <StatusBadge status={m.status} />
              {active && <StatusBadge status={m.health} />}
            </div>
            <p className="text-sm text-ink-600">{role === 'student' ? m.mentor.headline : [m.student.program, m.student.graduationYear && `Class of ${m.student.graduationYear}`].filter(Boolean).join(' · ')}</p>
            <p className="text-xs text-ink-500">
              Started {fmtDate(m.startedAt)} · last activity {relTime(m.lastActivityAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {active && role !== 'staff' && (
            <button className="btn-secondary" onClick={() => setEnding(true)}>
              Close mentorship
            </button>
          )}
          {role === 'staff' && <Badge tone="violet">Read-only staff view</Badge>}
        </div>
      </div>

      <Tabs
        active={tab}
        onChange={change}
        tabs={[
          { id: 'overview', label: <span className="flex items-center gap-1.5"><LayoutGrid size={14} /> Overview</span> },
          { id: 'sessions', label: <span className="flex items-center gap-1.5"><CalendarClock size={14} /> Sessions</span> },
          { id: 'goals', label: <span className="flex items-center gap-1.5"><Target size={14} /> Goals & actions</span> },
          { id: 'messages', label: <span className="flex items-center gap-1.5"><MessagesSquare size={14} /> Messages</span> },
          { id: 'feedback', label: <span className="flex items-center gap-1.5"><Star size={14} /> Feedback</span> },
        ]}
      />

      {tab === 'overview' && <OverviewTab m={m} careerGoals={data.careerGoals} stats={data.stats} onGo={change} />}
      {tab === 'sessions' && <SessionsTab id={id} role={role} active={active} />}
      {tab === 'goals' && <GoalsTab id={id} role={role} active={active} careerGoals={data.careerGoals} />}
      {tab === 'messages' && <MessagesTab id={id} role={role} active={active} otherName={other.name} />}
      {tab === 'feedback' && <FeedbackTab id={id} role={role} sessionParam={params.get('session')} />}

      <Modal
        open={ending}
        onClose={() => setEnding(false)}
        title="Close this mentorship"
        footer={
          <>
            <button className="btn-secondary" onClick={() => end('ended')}>
              End early
            </button>
            <button className="btn-primary" onClick={() => end('completed')}>
              Mark as completed
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-600">Closing frees a mentee slot{role === 'mentor' ? ' for you' : ' for your mentor'}. Both of you will be asked for brief closing feedback. It&apos;s completely fine to end a mentorship that isn&apos;t working.</p>
        <textarea className="input mt-3" placeholder="Optional: a short note on why (seen by the programme team only)" value={endReason} onChange={(e) => setEndReason(e.target.value)} />
      </Modal>
    </>
  );
}

export default function MentorshipPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Inner />
    </Suspense>
  );
}
