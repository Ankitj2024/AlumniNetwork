'use client';
import { BookUser } from 'lucide-react';
import { useState } from 'react';
import { Badge, PageHeader, PageLoader, cx, useToast } from '@/components/ui';
import { patch } from '@/lib/api';
import { relTime } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';

export default function UsersPage() {
  const toast = useToast();
  const { me } = useAuth();
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const { data, loading, reload } = useApi<{ users: any[] }>(`/admin/users?role=${role}&q=${encodeURIComponent(q)}`);

  async function toggle(u: any) {
    try {
      await patch(`/admin/users/${u.id}`, { status: u.status === 'active' ? 'suspended' : 'active' });
      toast(u.status === 'active' ? 'User suspended' : 'User reactivated');
    } catch (e: any) {
      toast(e.message, 'err'); // e.g. the last administrator can't be suspended
    }
    reload();
  }

  return (
    <>
      <PageHeader icon={BookUser} eyebrow="System" title="Users" />
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input w-60" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
        {['', 'student', 'alumnus', 'aro', 'placement', 'admin'].map((r) => (
          <button key={r} className={cx('chip', role === r && 'chip-active')} onClick={() => setRole(r)}>
            {r || 'all'}
          </button>
        ))}
      </div>
      {loading && !data ? (
        <PageLoader />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-ink-100 bg-ink-50 text-left text-xs uppercase text-ink-500">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Last login</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {data?.users.map((u) => (
                <tr key={u.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium">{u.name}</td>
                  <td className="px-4 py-2.5">
                    <Badge>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-ink-600">{u.email}</td>
                  <td className="px-4 py-2.5 text-ink-500">{u.lastLoginAt ? relTime(u.lastLoginAt) : '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={u.status === 'active' ? 'green' : 'red'}>{u.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {u.id === me?.user.id ? (
                      <span className="px-2 text-xs text-ink-400">You</span>
                    ) : (
                      <button className="btn-ghost px-2 text-xs" onClick={() => toggle(u)}>
                        {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
