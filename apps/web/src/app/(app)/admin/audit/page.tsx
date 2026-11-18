'use client';
import { ScrollText } from 'lucide-react';
import { useState } from 'react';
import { Badge, PageHeader, PageLoader } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';

export default function AuditPage() {
  const [action, setAction] = useState('');
  const { data, loading } = useApi<{ logs: any[] }>(`/admin/audit?action=${encodeURIComponent(action)}`);
  return (
    <>
      <PageHeader icon={ScrollText} eyebrow="Data" title="Audit log" subtitle="Every verification decision, document view, settings change and key workflow action." />
      <select className="input mb-4 w-64" value={action} onChange={(e) => setAction(e.target.value)}>
        <option value="">All actions</option>
        <option value="verification">Verification</option>
        <option value="request">Requests</option>
        <option value="session">Sessions</option>
        <option value="mentorship">Mentorships</option>
        <option value="capacity">Capacity</option>
        <option value="settings">Settings</option>
        <option value="records">Records import</option>
        <option value="user">Users</option>
        <option value="job">Jobs</option>
      </select>
      {loading && !data ? (
        <PageLoader />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-ink-100 bg-ink-50 text-left text-xs uppercase text-ink-500">
              <tr>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Actor</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Entity</th>
                <th className="px-4 py-2.5">Details</th>
              </tr>
            </thead>
            <tbody>
              {data?.logs.map((l) => (
                <tr key={l.id} className="border-b border-ink-100 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-500">{fmtDateTime(l.at)}</td>
                  <td className="px-4 py-2.5">
                    {l.actor.name} <span className="text-xs text-ink-500">({l.actor.role})</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge>{l.action}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-500">
                    {l.entityType}
                    {l.entityId && <div className="font-mono">{l.entityId.slice(-8)}</div>}
                  </td>
                  <td className="max-w-xs px-4 py-2.5 font-mono text-xs text-ink-600">{l.details ? JSON.stringify(l.details).slice(0, 160) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.logs.length === 0 && <p className="p-6 text-center text-sm text-ink-500">No entries.</p>}
        </div>
      )}
    </>
  );
}
