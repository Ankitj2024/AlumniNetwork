'use client';
import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, ErrorBox, Field, PageHeader, PageLoader, Spinner, useToast } from '@/components/ui';
import { put } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';

const WEIGHT_LABELS: Record<string, string> = {
  expertise: 'Shared expertise / interests',
  targetRole: 'Target role similarity',
  industry: 'Target industry',
  mentoringAreas: 'Mentoring areas offered',
  department: 'Same department',
  availability: 'Published availability',
  loadBalance: 'Open capacity (spreads load)',
};

export default function ProgrammeSettings() {
  const toast = useToast();
  const { me } = useAuth();
  const { data, loading } = useApi<{ settings: any }>('/admin/settings');
  const [s, setS] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const readOnly = me?.user.role !== 'admin';

  useEffect(() => {
    if (data && !s) setS(structuredClone(data.settings));
  }, [data, s]);
  if (loading || !s) return <PageLoader />;

  const num = (group: string, key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [group]: { ...s[group], [key]: Number(e.target.value) } });
  const totalW = Object.values(s.matchingWeights as Record<string, number>).reduce((a, b) => a + b, 0) || 1;

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await put('/admin/settings', s);
      toast('Settings saved — they take effect immediately');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader icon={SlidersHorizontal} eyebrow="System" title="Programme settings" subtitle={readOnly ? 'Read-only — only administrators can change these.' : 'Changes apply immediately and are recorded in the audit log.'} actions={!readOnly && <button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />} Save settings</button>} />
      <ErrorBox message={err} />
      <fieldset disabled={readOnly} className="mt-4 grid gap-6 lg:grid-cols-2">
        <Card title="Matching weights">
          <p className="mb-4 text-sm text-ink-600">Relative importance of each signal when ranking mentors for a student.</p>
          <div className="space-y-4">
            {Object.keys(WEIGHT_LABELS).map((k) => (
              <div key={k}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{WEIGHT_LABELS[k]}</span>
                  <span className="tabular-nums text-ink-500">
                    {s.matchingWeights[k]} · {Math.round((s.matchingWeights[k] / totalW) * 100)}%
                  </span>
                </div>
                <input type="range" min={0} max={100} value={s.matchingWeights[k]} onChange={num('matchingWeights', k)} className="w-full accent-brand-600" />
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Request throttling (per student)">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Max pending requests" hint="Awaiting a reply at once">
                <input className="input" type="number" min={1} max={20} value={s.throttle.maxPendingRequests} onChange={num('throttle', 'maxPendingRequests')} />
              </Field>
              <Field label="Max requests per period">
                <input className="input" type="number" min={1} max={50} value={s.throttle.maxRequestsPerPeriod} onChange={num('throttle', 'maxRequestsPerPeriod')} />
              </Field>
              <Field label="Period (days)">
                <input className="input" type="number" min={1} max={90} value={s.throttle.periodDays} onChange={num('throttle', 'periodDays')} />
              </Field>
              <Field label="Re-request cooldown (days)" hint="After a decline or expiry">
                <input className="input" type="number" min={0} max={365} value={s.throttle.reRequestCooldownDays} onChange={num('throttle', 'reRequestCooldownDays')} />
              </Field>
              <Field label="Max active mentorships per student">
                <input className="input" type="number" min={1} max={10} value={s.throttle.maxActiveMentorshipsPerStudent} onChange={num('throttle', 'maxActiveMentorshipsPerStudent')} />
              </Field>
            </div>
          </Card>
          <Card title="Request expiry">
            <Field label="Days before an unanswered request expires">
              <input className="input" type="number" min={1} max={60} value={s.requestExpiryDays} onChange={(e) => setS({ ...s, requestExpiryDays: Number(e.target.value) })} />
            </Field>
          </Card>
          <Card title="Engagement monitoring">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="At risk after (days idle)">
                <input className="input" type="number" value={s.engagement.atRiskDays} onChange={num('engagement', 'atRiskDays')} />
              </Field>
              <Field label="Lapsed after (days idle)">
                <input className="input" type="number" value={s.engagement.lapsedDays} onChange={num('engagement', 'lapsedDays')} />
              </Field>
              <Field label="Nudge cooldown (days)">
                <input className="input" type="number" value={s.engagement.nudgeCooldownDays} onChange={num('engagement', 'nudgeCooldownDays')} />
              </Field>
            </div>
          </Card>
          <Card title="Verification">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="rounded text-brand-600" checked={s.verification.autoApproveExactMatch} onChange={(e) => setS({ ...s, verification: { ...s.verification, autoApproveExactMatch: e.target.checked } })} />
              Auto-approve claims that match institutional records exactly
            </label>
          </Card>
        </div>
      </fieldset>
    </>
  );
}
