'use client';
import { ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import { Badge, Card, EmptyState, PageHeader, PageLoader, StatusBadge, cx, useToast } from '@/components/ui';
import { post } from '@/lib/api';
import { fmtDateTime, relTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';

const FIELDS: [string, string][] = [
  ['fullName', 'Name'],
  ['rollNumber', 'Roll number'],
  ['graduationYear', 'Graduation year'],
  ['degree', 'Degree'],
  ['department', 'Department'],
  ['dateOfBirth', 'Date of birth'],
];

export default function VerificationQueue() {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const { data, loading, reload } = useApi<{ verifications: any[]; counts: Record<string, number> }>(`/alumni/verify/queue?status=${status}`);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const list = data?.verifications ?? [];
  const v = list.find((x) => x.id === selected) ?? list[0];

  async function decide(decision: 'approve' | 'reject' | 'needs_info') {
    try {
      await post(`/alumni/verify/${v.id}/decision`, { decision, note: note || undefined });
      toast(decision === 'approve' ? 'Approved — the alumnus can now mentor' : 'Decision recorded');
      setNote('');
      setSelected(null);
      reload();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  return (
    <>
      <PageHeader icon={ClipboardCheck} eyebrow="Programme" title="Verification queue" subtitle="Each claim is matched against institutional records. Review differences and documents before approving." />
      <div className="mb-4 flex flex-wrap gap-1">
        {['pending', 'needs_info', 'approved', 'rejected', 'all'].map((s) => (
          <button key={s} className={cx('chip capitalize', status === s && 'chip-active')} onClick={() => (setStatus(s), setSelected(null))}>
            {s.replace('_', ' ')} {data?.counts[s] != null && <span className="text-ink-400">{data.counts[s]}</span>}
          </button>
        ))}
      </div>
      {loading && !data ? (
        <PageLoader />
      ) : list.length === 0 ? (
        <EmptyState title="Nothing to review" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <ul className="card max-h-[70vh] divide-y divide-ink-100 overflow-auto">
            {list.map((x) => (
              <li key={x.id}>
                <button className={cx('w-full px-4 py-3 text-left hover:bg-ink-50', v?.id === x.id && 'bg-brand-50')} onClick={() => setSelected(x.id)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{x.submitted?.fullName}</span>
                    {x.matchResult?.matched ? <Badge tone="green">Match</Badge> : <Badge tone="amber">Review</Badge>}
                  </div>
                  <div className="text-xs text-ink-500">
                    {x.submitted?.rollNumber} · submitted {relTime(x.createdAt)}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {v && (
            <div className="space-y-6">
              <Card title={v.submitted?.fullName} actions={<StatusBadge status={v.status} />}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase text-ink-500">
                      <tr>
                        <th className="py-2 pr-4">Field</th>
                        <th className="py-2 pr-4">Submitted</th>
                        <th className="py-2 pr-4">Institution record</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {FIELDS.map(([k, label]) => {
                        const bad = v.matchResult?.mismatchedFields?.includes(k);
                        const good = v.matchResult?.matchedFields?.includes(k);
                        return (
                          <tr key={k} className={cx('border-t border-ink-100', bad && 'bg-amber-50')}>
                            <td className="py-2 pr-4 text-ink-500">{label}</td>
                            <td className="py-2 pr-4 font-medium">{v.submitted?.[k] ?? '—'}</td>
                            <td className="py-2 pr-4">{v.institutionRecord?.[k] ?? '—'}</td>
                            <td className="py-2 text-right">{bad ? <Badge tone="amber">Differs</Badge> : good ? <Badge tone="green">✓</Badge> : null}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!v.institutionRecord && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">No institutional record found for this roll number.</p>}
                <p className="mt-3 text-xs text-ink-500">Record confidence: {Math.round((v.matchResult?.confidence ?? 0) * 100)}%</p>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <Card title="Applicant (staff only)">
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-500">Email</dt>
                      <dd className="truncate">{v.alumnus?.contact?.email ?? '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-500">Phone</dt>
                      <dd>{v.alumnus?.contact?.phone ?? '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-500">Current role</dt>
                      <dd className="text-right">{v.alumnus?.headline ?? '—'}</dd>
                    </div>
                  </dl>
                </Card>
                <Card title="Documents">
                  {v.documents.length === 0 ? (
                    <p className="muted">No documents uploaded.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {v.documents.map((d: any) => (
                        <li key={d.id}>
                          <a className="text-brand-700 hover:underline" href={`/api/alumni/verify/${v.id}/documents/${d.id}`} target="_blank" rel="noopener noreferrer">
                            {d.originalName}
                          </a>{' '}
                          <span className="text-xs text-ink-500">({Math.round(d.size / 1024)} KB)</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-ink-500">Opening a document is recorded in the audit log.</p>
                </Card>
              </div>

              <Card title="Audit trail">
                <ol className="space-y-2 border-l-2 border-ink-100 pl-4 text-sm">
                  {v.history.map((h: any, i: number) => (
                    <li key={i}>
                      <span className="font-medium capitalize">{h.status.replace('_', ' ')}</span>
                      <span className="text-ink-500">
                        {' '}
                        · {fmtDateTime(h.at)} · {h.byName}
                      </span>
                      {h.note && <div className="text-xs text-ink-600">{h.note}</div>}
                    </li>
                  ))}
                </ol>
              </Card>

              {(v.status === 'pending' || v.status === 'needs_info') && (
                <Card title="Decision">
                  <textarea className="input" placeholder="Note to the applicant (required to reject or request info)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-primary" onClick={() => decide('approve')}>
                      Approve
                    </button>
                    <button className="btn-secondary" onClick={() => decide('needs_info')} disabled={!note}>
                      Request more info
                    </button>
                    <button className="btn-danger" onClick={() => decide('reject')} disabled={!note}>
                      Reject
                    </button>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
