'use client';
import { UserRound } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Card, ChipToggle, ErrorBox, Field, Modal, PageHeader, PageLoader, Spinner, useToast } from '@/components/ui';
import { del, post, put } from '@/lib/api';
import { AREA_LABELS } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { CareerGoal, Tag } from '@/lib/types';

const TIMEFRAMES: Record<string, string> = { '3_months': '3 months', '6_months': '6 months', '1_year': '1 year', '2_years_plus': '2+ years' };

function ProfileInner() {
  const toast = useToast();
  const welcome = useSearchParams().get('welcome');
  const { data, loading, reload } = useApi<{ profile: any }>('/students/me');
  const meta = useApi<{ industries: string[]; departments: string[]; mentoringAreas: { value: string; label: string }[] }>('/meta');
  const tags = useApi<{ tags: Tag[] }>('/tags');
  const [form, setForm] = useState<any>(null);
  const [roleInput, setRoleInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [goalModal, setGoalModal] = useState<Partial<CareerGoal> | null>(null);

  useEffect(() => {
    if (data?.profile && !form) {
      const p = data.profile;
      setForm({ program: p.program ?? '', department: p.department ?? '', graduationYear: p.graduationYear ?? '', bio: p.bio ?? '', interests: p.interests.map((t: Tag) => t.id), targetRoles: p.targetRoles, targetIndustries: p.targetIndustries, mentoringAreasWanted: p.mentoringAreasWanted });
    }
  }, [data, form]);

  if (loading || !form) return <PageLoader />;
  const goals: CareerGoal[] = data?.profile.goals ?? [];

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await put('/students/me', { ...form, graduationYear: form.graduationYear ? Number(form.graduationYear) : undefined, department: form.department || undefined });
      toast('Profile saved');
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveGoal() {
    if (!goalModal) return;
    try {
      const body = { title: goalModal.title, description: goalModal.description || undefined, targetRole: goalModal.targetRole || undefined, targetIndustry: goalModal.targetIndustry || undefined, timeframe: goalModal.timeframe || '1_year', priority: Number(goalModal.priority ?? 2) };
      if (goalModal.id) await put(`/students/me/goals/${goalModal.id}`, body);
      else await post('/students/me/goals', body);
      setGoalModal(null);
      reload();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  const tagsByCat = (tags.data?.tags ?? []).reduce<Record<string, Tag[]>>((acc, t) => ((acc[t.category ?? 'Other'] ??= []).push(t), acc), {});

  return (
    <>
      <PageHeader icon={UserRound} eyebrow="Your profile" title="Career profile" subtitle="Mentors see this when you send a request. Your email and phone are never shown to mentors." actions={<button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />} Save profile</button>} />
      {welcome && <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">Welcome! Tell us what you are aiming for — your goals drive the mentor matches you&apos;ll see.</div>}
      <ErrorBox message={err} />
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Career goals" actions={<button className="btn-secondary text-xs" onClick={() => setGoalModal({ timeframe: '1_year', priority: 2 })}>Add goal</button>}>
            {goals.length === 0 ? (
              <p className="muted">Add at least one goal — for example “Land a data scientist role at a fintech”.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {goals.map((g) => (
                  <li key={g.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div>
                      <div className="font-medium">{g.title}</div>
                      <div className="text-xs text-ink-500">{[g.targetRole, g.targetIndustry, TIMEFRAMES[g.timeframe]].filter(Boolean).join(' · ')}</div>
                      {g.description && <p className="mt-1 text-sm text-ink-600">{g.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button className="btn-ghost text-xs" onClick={() => setGoalModal(g)}>
                        Edit
                      </button>
                      <button className="btn-ghost text-xs text-red-700" onClick={async () => (await del(`/students/me/goals/${g.id}`), reload())}>
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="What you're aiming for">
            <div className="space-y-5">
              <Field label="Target roles" hint="Press Enter to add. Up to 6.">
                <div className="flex flex-wrap gap-1.5 rounded-lg border border-ink-200 p-2">
                  {form.targetRoles.map((r: string) => (
                    <span key={r} className="chip chip-active">
                      {r}
                      <button type="button" onClick={() => setForm({ ...form, targetRoles: form.targetRoles.filter((x: string) => x !== r) })} aria-label={`Remove ${r}`}>
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    className="min-w-[10rem] flex-1 border-0 p-1 text-sm focus:outline-none"
                    placeholder="e.g. Data Scientist"
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && roleInput.trim()) {
                        e.preventDefault();
                        if (form.targetRoles.length < 6 && !form.targetRoles.includes(roleInput.trim())) setForm({ ...form, targetRoles: [...form.targetRoles, roleInput.trim()] });
                        setRoleInput('');
                      }
                    }}
                  />
                </div>
              </Field>
              <div>
                <span className="label">Target industries</span>
                <ChipToggle options={(meta.data?.industries ?? []).map((i) => ({ value: i, label: i }))} value={form.targetIndustries} onChange={(v) => setForm({ ...form, targetIndustries: v })} max={6} />
              </div>
              <div>
                <span className="label">Help you&apos;re looking for</span>
                <ChipToggle options={Object.entries(AREA_LABELS).map(([value, label]) => ({ value, label }))} value={form.mentoringAreasWanted} onChange={(v) => setForm({ ...form, mentoringAreasWanted: v })} />
              </div>
              <div>
                <span className="label">Interests & skills</span>
                <div className="space-y-2">
                  {Object.entries(tagsByCat).map(([cat, ts]) => (
                    <div key={cat}>
                      <div className="mb-1 text-xs font-medium text-ink-500">{cat}</div>
                      <ChipToggle options={ts.map((t) => ({ value: t.id, label: t.name }))} value={form.interests} onChange={(v) => setForm({ ...form, interests: v })} max={15} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card title="About you">
          <div className="space-y-4">
            <Field label="Programme">
              <input className="input" value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} placeholder="B.Tech Computer Science" />
            </Field>
            <Field label="Department">
              <select className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                <option value="">Select…</option>
                {(meta.data?.departments ?? []).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Graduation year">
              <input className="input" type="number" value={form.graduationYear} onChange={(e) => setForm({ ...form, graduationYear: e.target.value })} />
            </Field>
            <Field label="Short bio" hint="Contact details are removed automatically.">
              <textarea className="input min-h-[120px]" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={1500} />
            </Field>
          </div>
        </Card>
      </div>

      <Modal open={!!goalModal} onClose={() => setGoalModal(null)} title={goalModal?.id ? 'Edit goal' : 'Add a career goal'} footer={<><button className="btn-secondary" onClick={() => setGoalModal(null)}>Cancel</button><button className="btn-primary" onClick={saveGoal} disabled={!goalModal?.title || goalModal.title.length < 3}>Save goal</button></>}>
        {goalModal && (
          <div className="space-y-4">
            <Field label="Goal">
              <input className="input" value={goalModal.title ?? ''} onChange={(e) => setGoalModal({ ...goalModal, title: e.target.value })} placeholder="Land a backend engineering internship" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Target role">
                <input className="input" value={goalModal.targetRole ?? ''} onChange={(e) => setGoalModal({ ...goalModal, targetRole: e.target.value })} />
              </Field>
              <Field label="Target industry">
                <select className="input" value={goalModal.targetIndustry ?? ''} onChange={(e) => setGoalModal({ ...goalModal, targetIndustry: e.target.value })}>
                  <option value="">Any</option>
                  {(meta.data?.industries ?? []).map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </Field>
              <Field label="Timeframe">
                <select className="input" value={goalModal.timeframe ?? '1_year'} onChange={(e) => setGoalModal({ ...goalModal, timeframe: e.target.value })}>
                  {Object.entries(TIMEFRAMES).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Priority">
                <select className="input" value={goalModal.priority ?? 2} onChange={(e) => setGoalModal({ ...goalModal, priority: Number(e.target.value) })}>
                  <option value={1}>High</option>
                  <option value={2}>Medium</option>
                  <option value={3}>Low</option>
                </select>
              </Field>
            </div>
            <Field label="Details (optional)">
              <textarea className="input" value={goalModal.description ?? ''} onChange={(e) => setGoalModal({ ...goalModal, description: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function StudentProfilePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ProfileInner />
    </Suspense>
  );
}
