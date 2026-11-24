'use client';
import { ArrowLeft, Clock, Languages, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Chips, EducationIcon, ExperienceIcon, ProfileEntry, ProfileHeader, ProfileSection } from '@/components/Profile';
import { Bar, CapacityMeter, ErrorBox, Field, Modal, PageLoader, Spinner, useToast } from '@/components/ui';
import { inr, usePaymentConfig } from '@/lib/payments';
import { ApiError, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AREA_LABELS, DAYS, fmtDate, minutesToTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { CareerGoal, Mentor } from '@/lib/types';

const BREAKDOWN_LABELS: Record<string, string> = { expertise: 'Shared expertise', targetRole: 'Role fit', industry: 'Industry', mentoringAreas: 'Help offered', department: 'Department', availability: 'Availability', loadBalance: 'Open capacity' };

/** A mentor's profile as students see it: LinkedIn-style header and sections, booking on the side. */
export default function MentorProfile() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { me } = useAuth();
  const { data, loading, error, reload } = useApi<{ mentor: Mentor; accepting: boolean; requestState?: { pendingRequestId: string | null; mentorshipId: string | null; cooldownUntil: string | null } }>(`/mentors/${id}`);
  const pay = usePaymentConfig();
  const student = useApi<{ profile: { goals: CareerGoal[] }; throttle: any }>(me?.user.role === 'student' ? '/students/me' : null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [goalIds, setGoalIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (loading) return <PageLoader />;
  if (error || !data) return <ErrorBox message={error ?? 'Not found'} />;
  const m = data.mentor;
  const first = m.name.split(' ')[0];
  const rs = data.requestState;
  const t = student.data?.throttle;
  const throttled = t && (t.pending >= t.maxPending || t.inPeriod >= t.maxPerPeriod || t.activeMentorships >= t.maxActiveMentorships);
  const isStudent = me?.user.role === 'student';
  const fee = pay?.enabled ? (m.sessionFee ? Math.min(m.sessionFee, pay.maxSessionFee) : 0) : null;

  async function send() {
    setBusy(true);
    setErr(null);
    try {
      await post('/requests', { alumnusId: m.id, message, goalIds });
      toast(`Request sent to ${m.name}. They have 7 days to respond.`);
      setOpen(false);
      reload();
      student.reload();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  // The primary action, LinkedIn's "Connect" spot.
  const action = !isStudent ? null : rs?.mentorshipId ? (
    <Link href={`/mentorships/${rs.mentorshipId}`} className="btn-primary px-5">
      Open mentorship
    </Link>
  ) : rs?.pendingRequestId ? (
    <span className="btn-secondary cursor-default px-5">Request sent</span>
  ) : rs?.cooldownUntil || !data.accepting || throttled ? null : (
    <button className="btn-primary px-5" onClick={() => setOpen(true)}>
      Request mentorship
    </button>
  );
  const status = !isStudent
    ? null
    : rs?.pendingRequestId
      ? `Your request is waiting for ${first}’s reply.`
      : rs?.cooldownUntil
        ? `${first} wasn’t available recently. You can ask again after ${fmtDate(rs.cooldownUntil)} — meanwhile, try your other matches.`
        : !rs?.mentorshipId && !data.accepting
          ? `${first} isn’t taking new mentees right now.`
          : !rs?.mentorshipId && throttled
            ? 'You’ve reached your request limit. Wait for a reply or withdraw a pending request first.'
            : null;

  const role = [m.currentRole, m.currentCompany].filter(Boolean).join(' at ');
  const place = [m.city, m.industry].filter(Boolean).join(' · ');

  return (
    <>
      <button className="btn-ghost mb-4 -ml-2 gap-1.5 px-2.5 text-[13px]" onClick={() => router.back()}>
        <ArrowLeft size={15} /> Back
      </button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <ProfileHeader
            name={m.name}
            headline={m.headline}
            verified={m.verified}
            lines={[role, place]}
            actions={action}
            badges={
              <>
                {m.match && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[12.5px] font-medium text-brand-700">
                    <Sparkles size={13} /> {m.match.score} match for you
                  </span>
                )}
                {m.yearsExperience != null && <span className="rounded-full bg-ink-900/[0.05] px-3 py-1 text-[12.5px] font-medium text-ink-600">{m.yearsExperience} years’ experience</span>}
                {m.graduationYear && <span className="rounded-full bg-ink-900/[0.05] px-3 py-1 text-[12.5px] font-medium text-ink-600">Class of {m.graduationYear}</span>}
              </>
            }
          />
          {status && <p className="rounded-2xl bg-ink-900/[0.04] px-5 py-3.5 text-[14px] text-ink-700">{status}</p>}

          {m.bio && (
            <ProfileSection title="About">
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-700">{m.bio}</p>
            </ProfileSection>
          )}

          {(m.currentRole || m.currentCompany) && (
            <ProfileSection title="Experience">
              <ProfileEntry monogram={m.currentCompany ?? m.currentRole ?? undefined} icon={ExperienceIcon} title={m.currentRole ?? 'Current role'} subtitle={m.currentCompany} meta={[m.industry, m.yearsExperience != null && `${m.yearsExperience} years in industry`, m.city].filter(Boolean).join(' · ')} />
            </ProfileSection>
          )}

          {(m.department || m.graduationYear) && (
            <ProfileSection title="Education">
              <ProfileEntry icon={EducationIcon} title={[m.degree, m.department].filter(Boolean).join(', ') || 'Alumnus'} subtitle={m.graduationYear ? `Class of ${m.graduationYear}` : null} meta={m.verified ? 'Verified against the institution’s alumni records' : null} />
            </ProfileSection>
          )}

          <ProfileSection title="Skills">
            <Chips items={m.expertise.map((x) => x.name)} />
          </ProfileSection>

          <ProfileSection title="Mentoring">
            <p className="mb-3 text-[13px] font-medium text-ink-500">Can help with</p>
            <Chips items={m.mentoringAreas.map((a) => AREA_LABELS[a] ?? a)} tone="accent" />
            {m.languages.length > 0 && (
              <p className="mt-5 flex items-center gap-2 text-[14px] text-ink-600">
                <Languages size={15} className="text-ink-400" /> Speaks {m.languages.join(', ')}
              </p>
            )}
          </ProfileSection>
        </div>

        <aside className="space-y-6">
          <ProfileSection title="Availability">
            <CapacityMeter capacity={m.capacity} />
            {fee !== null && (
              <div className="mt-4 flex items-baseline justify-between rounded-xl bg-ink-900/[0.04] px-4 py-3 text-[14px]">
                <span className="text-ink-500">Session fee</span>
                {fee > 0 ? (
                  <span className="font-semibold tabular-nums">
                    {inr(fee * 100)} <span className="font-normal text-ink-500">/ session</span>
                  </span>
                ) : (
                  <span className="font-semibold text-ok-700">Free</span>
                )}
              </div>
            )}
            {m.capacity?.paused && <p className="mt-3 text-[14px] text-ink-500">Taking a break{m.capacity.pausedUntil ? ` until ${fmtDate(m.capacity.pausedUntil)}` : ''}.</p>}
            <div className="mt-5">
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink-500">
                <Clock size={14} /> Usually available
              </p>
              {m.availability?.length ? (
                <ul className="space-y-1.5 text-[14px]">
                  {m.availability.map((w) => (
                    <li key={w.id} className="flex justify-between">
                      <span>{DAYS[w.dayOfWeek]}</span>
                      <span className="tabular-nums text-ink-600">
                        {minutesToTime(w.startMinute)}–{minutesToTime(w.endMinute)}
                      </span>
                    </li>
                  ))}
                  <li className="pt-1 text-[12px] text-ink-400">{m.availability[0].timezone}</li>
                </ul>
              ) : (
                <p className="text-[14px] text-ink-400">Not published</p>
              )}
            </div>
            {isStudent && action && !rs?.mentorshipId && !rs?.pendingRequestId && (
              <div className="mt-6">
                <button className="btn-primary w-full" onClick={() => setOpen(true)}>
                  Request mentorship
                </button>
                <p className="mt-2 text-center text-[12px] text-ink-500">
                  Mentors have 7 days to reply. You have {t ? t.maxPending - t.pending : '—'} request{t && t.maxPending - t.pending === 1 ? '' : 's'} available.
                </p>
              </div>
            )}
          </ProfileSection>

          {m.match && (
            <ProfileSection title={`Why you match · ${m.match.score}`}>
              <ul className="space-y-2.5 text-[14px] text-ink-700">
                {m.match.reasons.map((r) => (
                  <li key={r} className="flex gap-2">
                    <Sparkles size={14} className="mt-0.5 shrink-0 text-brand-600" />
                    {r}
                  </li>
                ))}
              </ul>
              {m.match.breakdown && (
                <div className="mt-5 space-y-3 border-t border-[color:var(--line)] pt-5">
                  {Object.entries(m.match.breakdown).map(([k, v]) => (
                    <div key={k}>
                      <div className="mb-1 flex justify-between text-[12px] text-ink-500">
                        <span>{BREAKDOWN_LABELS[k] ?? k}</span>
                        <span className="tabular-nums">{Math.round(v * 100)}%</span>
                      </div>
                      <Bar value={v * 100} />
                    </div>
                  ))}
                </div>
              )}
            </ProfileSection>
          )}
        </aside>
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
            <textarea className="input min-h-[140px]" value={message} maxLength={1200} onChange={(e) => setMessage(e.target.value)} placeholder={`Hi ${first}, I'm working towards… I'd value your guidance on…`} />
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
