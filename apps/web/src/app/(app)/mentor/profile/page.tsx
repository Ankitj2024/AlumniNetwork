'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Badge, Card, ChipToggle, ErrorBox, Field, PageHeader, PageLoader, Spinner, StatusBadge, useToast } from '@/components/ui';
import { api, put } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AREA_LABELS, fmtDate, fmtDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { inr, usePaymentConfig } from '@/lib/payments';
import { VerificationWizard } from '@/components/VerificationWizard';
import { ShieldCheck } from 'lucide-react';
import type { Tag } from '@/lib/types';

function Inner() {
  const toast = useToast();
  const welcome = useSearchParams().get('welcome');
  const { refresh } = useAuth();
  const { data, loading, reload } = useApi<{ profile: any; verification: any }>('/alumni/me');
  const meta = useApi<{ industries: string[]; departments: string[] }>('/meta');
  const tags = useApi<{ tags: Tag[] }>('/tags');
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pay = usePaymentConfig();

  useEffect(() => {
    if (data?.profile && !form) {
      const p = data.profile;
      setForm({ headline: p.headline ?? '', currentRole: p.currentRole ?? '', currentCompany: p.currentCompany ?? '', industry: p.industry ?? '', yearsExperience: p.yearsExperience ?? '', city: p.city ?? '', bio: p.bio ?? '', expertise: p.expertise.map((t: Tag) => t.id), mentoringAreas: p.mentoringAreas, languages: (p.languages ?? []).join(', '), linkedinUrl: p.linkedinUrl ?? '', mentorOptIn: p.mentorOptIn, sessionFee: String(p.sessionFee ?? 0) });
    }
  }, [data, form]);

  if (loading || !form) return <PageLoader />;
  const p = data!.profile;

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await put('/alumni/me', {
        ...form,
        yearsExperience: form.yearsExperience === '' ? undefined : Number(form.yearsExperience),
        industry: form.industry || undefined,
        languages: form.languages.split(',').map((s: string) => s.trim()).filter(Boolean),
        sessionFee: Math.max(0, Math.round(Number(form.sessionFee) || 0)),
      });
      toast('Profile saved');
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const tagsByCat = (tags.data?.tags ?? []).reduce<Record<string, Tag[]>>((acc, t) => ((acc[t.category ?? 'Other'] ??= []).push(t), acc), {});

  return (
    <>
      <PageHeader icon={ShieldCheck} eyebrow="Your mentor profile" title="Profile & verification" subtitle="Students see your professional profile — never your email, phone or LinkedIn." actions={<button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />} Save profile</button>} />
      {welcome && <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">Thanks for joining! Start by verifying your alumni status below, then complete your profile.</div>}
      <ErrorBox message={err} />
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {p.verificationStatus !== 'verified' && (
            <VerificationWizard
              v={data!.verification}
              departments={meta.data?.departments ?? []}
              onDone={() => {
                reload();
                refresh();
              }}
            />
          )}
          <Card title="Professional profile">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Headline">
                <input className="input" value={form.headline} maxLength={140} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder="Senior Data Scientist at Quantia AI" />
              </Field>
              <Field label="Current role">
                <input className="input" value={form.currentRole} onChange={(e) => setForm({ ...form, currentRole: e.target.value })} />
              </Field>
              <Field label="Company">
                <input className="input" value={form.currentCompany} onChange={(e) => setForm({ ...form, currentCompany: e.target.value })} />
              </Field>
              <Field label="Industry">
                <select className="input" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                  <option value="">Select…</option>
                  {(meta.data?.industries ?? []).map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </Field>
              <Field label="Years of experience">
                <input className="input" type="number" min={0} value={form.yearsExperience} onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })} />
              </Field>
              <Field label="City">
                <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Bio">
                <textarea className="input min-h-[120px]" value={form.bio} maxLength={2000} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </Field>
            </div>
          </Card>
          <Card title="Expertise & mentoring">
            <div className="space-y-5">
              <div>
                <span className="label">How you can help</span>
                <ChipToggle options={Object.entries(AREA_LABELS).map(([value, label]) => ({ value, label }))} value={form.mentoringAreas} onChange={(v) => setForm({ ...form, mentoringAreas: v })} />
              </div>
              <div>
                <span className="label">Expertise tags (up to 15)</span>
                <div className="space-y-2">
                  {Object.entries(tagsByCat).map(([cat, ts]) => (
                    <div key={cat}>
                      <div className="mb-1 text-xs font-medium text-ink-500">{cat}</div>
                      <ChipToggle options={ts.map((t) => ({ value: t.id, label: t.name }))} value={form.expertise} onChange={(v) => setForm({ ...form, expertise: v })} max={15} />
                    </div>
                  ))}
                </div>
              </div>
              <Field label="Languages" hint="Comma separated">
                <input className="input" value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} />
              </Field>
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Status">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Verification</dt>
                <dd>
                  <StatusBadge status={p.verificationStatus} />
                </dd>
              </div>
              {p.verifiedAt && (
                <div className="flex justify-between">
                  <dt className="text-ink-500">Verified on</dt>
                  <dd>{fmtDate(p.verifiedAt)}</dd>
                </div>
              )}
              {p.department && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Record</dt>
                  <dd className="text-right">
                    {p.degree} {p.department}, {p.graduationYear}
                  </dd>
                </div>
              )}
            </dl>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" className="rounded text-brand-600" checked={form.mentorOptIn} onChange={(e) => setForm({ ...form, mentorOptIn: e.target.checked })} />
              Show me to students as a mentor
            </label>
          </Card>
          <div id="fee" className="scroll-mt-24">
            <Card title="Session fee">
              <Field label="Price per session (₹)" hint={pay ? `0 means free. The programme allows up to ₹${pay.maxSessionFee}.` : '0 means free.'}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-500">₹</span>
                  <input className="input pl-7 tabular-nums" inputMode="numeric" value={form.sessionFee} onChange={(e) => setForm({ ...form, sessionFee: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })} />
                </div>
              </Field>
              {pay && Number(form.sessionFee) > 0 && (
                <p className="mt-3 text-[12.5px] text-ink-500">
                  Students pay <span className="font-medium text-ink-800">{inr(Number(form.sessionFee) * 100)}</span> when they book; you receive{' '}
                  <span className="font-medium text-ink-800">{inr(Math.round(Number(form.sessionFee) * 100 * (1 - pay.platformFeePercent / 100)))}</span> after the {pay.platformFeePercent}% platform fee. Cancel a paid session and the student is refunded in full.
                </p>
              )}
              {pay && !pay.enabled && <p className="mt-3 text-[12.5px] text-amber-800">Paid sessions are switched off for the programme right now, so sessions stay free.</p>}
            </Card>
          </div>
          <Card title="Private (staff only)">
            <Field label="LinkedIn URL" hint="Visible only to Alumni Relations. Never shown to students.">
              <input className="input" value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} placeholder="https://www.linkedin.com/in/…" />
            </Field>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function MentorProfilePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Inner />
    </Suspense>
  );
}
