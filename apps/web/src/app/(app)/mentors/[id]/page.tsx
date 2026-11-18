'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar, Badge, Bar, Card, CapacityMeter, ErrorBox, Field, Modal, PageLoader, Spinner, useToast } from '@/components/ui';
import { ApiError, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AREA_LABELS, DAYS, fmtDate, minutesToTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { CareerGoal, Mentor } from '@/lib/types';

const BREAKDOWN_LABELS: Record<string, string> = { expertise: 'Shared expertise', targetRole: 'Role fit', industry: 'Industry', mentoringAreas: 'Help offered', department: 'Department', availability: 'Availability', loadBalance: 'Open capacity' };

export default function MentorProfile() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { me } = useAuth();
  const { data, loading, error, reload } = useApi<{ mentor: Mentor; accepting: boolean; requestState?: { pendingRequestId: string | null; mentorshipId: string | null; cooldownUntil: string | null } }>(`/mentors/${id}`);
  const student = useApi<{ profile: { goals: CareerGoal[] }; throttle: any }>(me?.user.role === 'student' ? '/students/me' : null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [goalIds, setGoalIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (loading) return <PageLoader />;
  if (error || !data) return <ErrorBox message={error ?? 'Not found'} />;
  const m = data.mentor;
  const rs = data.requestState;
  const t = student.data?.throttle;
  const throttled = t && (t.pending >= t.maxPending || t.inPeriod >= t.maxPerPeriod || t.activeMentorships >= t.maxActiveMentorships);

  async function send() {
    setBusy(true);
    setErr(null);
    try {
      await post('/requests', { alumnusId: m.id, message, goalIds });
      toast(`Request sent to ${m.name}. They have ${7} days to respond.`);
      setOpen(false);
      reload();
      student.reload();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn-ghost mb-4 px-2 text-sm" onClick={() => router.back()}>
        ← Back
      </button>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar name={m.name} size="lg" />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold">{m.name}</h1>
                  {m.verified && <Badge tone="green">✓ Verified alumnus</Badge>}
                </div>
                <p className="mt-0.5 text-ink-700">{m.headline}</p>
                <p className="mt-1 text-sm text-ink-500">{[m.industry, m.city, m.yearsExperience != null && `${m.yearsExperience} years experience`, m.department && `${m.degree ?? ''} ${m.department}`.trim(), m.graduationYear && `Class of ${m.graduationYear}`].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            {m.bio && <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-ink-700">{m.bio}</p>}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Expertise</h3>
                <div className="flex flex-wrap gap-1">
                  {m.expertise.map((t) => (
                    <Badge key={t.id}>{t.name}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Can help with</h3>
                <div className="flex flex-wrap gap-1">
                  {m.mentoringAreas.map((a) => (
                    <Badge key={a} tone="blue">
                      {AREA_LABELS[a] ?? a}
                    </Badge>
                  ))}
                </div>
              </div>
              {m.languages.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Languages</h3>
                  <p className="text-sm">{m.languages.join(', ')}</p>
                </div>
              )}
            </div>
          </div>

          {m.match && (
            <Card title={`Why this match · ${m.match.score}/100`}>
              <ul className="mb-5 space-y-2 text-sm">
                {m.match.reasons.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                    {r}
                  </li>
                ))}
              </ul>
              {m.match.breakdown && (
                <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {Object.entries(m.match.breakdown).map(([k, v]) => (
                    <div key={k}>
                      <div className="mb-1 flex justify-between text-xs text-ink-600">
                        <span>{BREAKDOWN_LABELS[k] ?? k}</span>
                        <span className="tabular-nums">{Math.round(v * 100)}%</span>
                      </div>
                      <Bar value={v * 100} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Availability">
            <CapacityMeter capacity={m.capacity} />
            {m.capacity?.paused && <p className="mt-2 text-sm text-ink-500">Taking a break{m.capacity.pausedUntil ? ` until ${fmtDate(m.capacity.pausedUntil)}` : ''}.</p>}
            <div className="mt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Usually available</h3>
              {m.availability?.length ? (
                <ul className="space-y-1 text-sm">
                  {m.availability.map((w) => (
                    <li key={w.id} className="flex justify-between">
                      <span>{DAYS[w.dayOfWeek]}</span>
                      <span className="tabular-nums text-ink-600">
                        {minutesToTime(w.startMinute)}–{minutesToTime(w.endMinute)}
                      </span>
                    </li>
                  ))}
                  <li className="pt-1 text-xs text-ink-400">{m.availability[0].timezone}</li>
                </ul>
              ) : (
                <p className="muted">Not published</p>
              )}
            </div>
          </Card>

          {me?.user.role === 'student' && (
            <Card>
              {rs?.mentorshipId ? (
                <Link href={`/mentorships/${rs.mentorshipId}`} className="btn-primary w-full">
                  Open your mentorship
                </Link>
              ) : rs?.pendingRequestId ? (
                <p className="text-sm text-ink-700">Your request is waiting for {m.name.split(' ')[0]}&apos;s reply.</p>
              ) : rs?.cooldownUntil ? (
                <p className="text-sm text-ink-700">{m.name.split(' ')[0]} wasn&apos;t available recently. You can ask again after {fmtDate(rs.cooldownUntil)} — meanwhile, try your other matches.</p>
              ) : !data.accepting ? (
                <p className="text-sm text-ink-700">{m.name.split(' ')[0]} isn&apos;t taking new mentees right now.</p>
              ) : throttled ? (
                <p className="text-sm text-amber-800">You&apos;ve reached your request limit. Wait for a reply or withdraw a pending request first.</p>
              ) : (
                <>
                  <button className="btn-primary w-full" onClick={() => setOpen(true)}>
                    Request mentorship
                  </button>
                  <p className="mt-2 text-center text-xs text-ink-500">Mentors have 7 days to reply. You have {t ? t.maxPending - t.pending : '—'} request{t && t.maxPending - t.pending === 1 ? '' : 's'} available.</p>
                </>
              )}
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Request ${m.name} as your mentor`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={send} disabled={busy || message.trim().length < 20}>
              {busy && <Spinner />} Send request
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <ErrorBox message={err} />
          <Field label="Your message" hint={`${message.trim().length}/1200 · Be specific about what you hope to get. Contact details are removed automatically.`}>
            <textarea className="input min-h-[140px]" value={message} maxLength={1200} onChange={(e) => setMessage(e.target.value)} placeholder={`Hi ${m.name.split(' ')[0]}, I'm working towards… I'd value your guidance on…`} />
          </Field>
          {!!student.data?.profile.goals?.length && (
            <div>
              <span className="label">Share goals with the mentor</span>
              <div className="space-y-1">
                {student.data.profile.goals.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="rounded text-brand-600" checked={goalIds.includes(g.id)} onChange={() => setGoalIds((x) => (x.includes(g.id) ? x.filter((y) => y !== g.id) : [...x, g.id]))} />
                    {g.title}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
