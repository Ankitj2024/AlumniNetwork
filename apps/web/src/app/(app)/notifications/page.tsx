'use client';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { EmptyState, PageHeader, PageLoader, cx } from '@/components/ui';
import { post } from '@/lib/api';
import { relTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Notice } from '@/lib/types';

export default function NotificationsPage() {
  const { data, loading, reload } = useApi<{ notifications: Notice[]; unread: number }>('/notifications?limit=100');

  useEffect(() => {
    if (data && data.unread > 0) {
      const t = setTimeout(async () => {
        await post('/notifications/read', { all: true });
        window.dispatchEvent(new Event('notifications-read'));
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [data]);

  if (loading && !data) return <PageLoader />;
  const list = data?.notifications ?? [];
  return (
    <>
      <PageHeader icon={Bell} eyebrow="Inbox" title="Notifications" actions={<button className="btn-secondary" onClick={async () => (await post('/notifications/read', { all: true }), window.dispatchEvent(new Event('notifications-read')), reload())}>Mark all read</button>} />
      {list.length === 0 ? (
        <EmptyState title="You're all caught up" />
      ) : (
        <ul className="card divide-y divide-ink-100">
          {list.map((n) => (
            <li key={n.id} className={cx('flex gap-3 px-5 py-4', !n.readAt && 'bg-brand-50/40')}>
              <span className={cx('mt-2 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-brand-500')} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  {n.link ? (
                    <Link href={n.link} className="font-medium hover:text-brand-700">
                      {n.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{n.title}</span>
                  )}
                  <span className="text-xs text-ink-500">{relTime(n.createdAt)}</span>
                </div>
                {n.body && <p className="mt-0.5 whitespace-pre-line text-sm text-ink-600">{n.body}</p>}
                {n.actions.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {n.actions.map((a) => (
                      <Link key={a.href} href={a.href} className="btn-secondary px-2.5 py-1 text-xs">
                        {a.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
