'use client';
import { ChevronRight, GraduationCap, IndianRupee, Pencil, Plus, RotateCcw, Star, Trash2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AddCardModal } from '@/components/payments/AddCardModal';
import { NetworkMark } from '@/components/payments/NetworkMark';
import { Card, EmptyState, PageHeader, PageLoader, Stat, StatusBadge, cx, useToast } from '@/components/ui';
import { WalletStack, type WalletStackCard } from '@/components/wallet/WalletStack';
import { del, patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { inr, NETWORK_LABEL, usePaymentConfig, type PaymentRow, type SavedMethod } from '@/lib/payments';

export default function PaymentsPage() {
  const { me } = useAuth();
  if (!me) return <PageLoader />;
  const role = me.user.role;
  if (role === 'student') return <StudentPayments name={me.user.name} />;
  if (role === 'alumnus') return <MentorEarnings />;
  if (role === 'admin' || role === 'aro') return <StaffPayments />;
  return <EmptyState title="Payments aren’t part of your role" body="Programme reports are under Programme & placement." />;
}

const thisYear = (d: string | null) => !!d && new Date(d).getFullYear() === new Date().getFullYear();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const TINTS: Record<string, string> = { rupay: 'oklch(45% 0.11 155)', visa: 'oklch(42% 0.13 262)', mastercard: 'oklch(40% 0.12 30)', amex: 'oklch(44% 0.1 220)', other: 'oklch(42% 0.08 280)' };

/* ------------------------------------------------------------------ student */
function StudentPayments({ name }: { name: string }) {
  const toast = useToast();
  const pay = usePaymentConfig();
  const methods = useApi<{ methods: SavedMethod[] }>('/payments/methods');
  const hist = useApi<{ payments: PaymentRow[] }>('/payments');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = methods.data?.methods ?? [];
  const rows = hist.data?.payments ?? [];

  // Saved cards become wallet cards: what was paid on each this year, and its latest payments.
  const cards: WalletStackCard[] = useMemo(
    () =>
      list.map((m) => ({
        id: m.id,
        issuer: m.nickname ?? m.issuer ?? NETWORK_LABEL[m.network],
        product: `${cap(m.cardType)} card`,
        lastFour: m.last4,
        holder: m.holder ?? name,
        expires: `${String(m.expMonth).padStart(2, '0')}/${String(m.expYear).slice(-2)}`,
        variant: m.finish,
        tint: TINTS[m.network],
        network: <NetworkMark network={m.network} />,
        balance: m.totalPaid / 100,
        balanceLabel: 'Paid this year',
        transactions: m.recent.map((r) => ({
          id: r.id,
          merchant: r.mentorName ?? 'Mentoring session',
          detail: `${r.title} · ${fmtDate(r.at, { day: 'numeric', month: 'short' })}`,
          amount: r.amount / 100,
          icon: r.status === 'refunded' ? <RotateCcw size={15} /> : <GraduationCap size={15} />,
        })),
      })),
    [list, name],
  );
  const opened = list.find((m) => m.id === openId) ?? null;

  const paidRows = rows.filter((r) => r.status === 'paid');
  const stats = {
    year: paidRows.filter((r) => thisYear(r.paidAt)).reduce((a, r) => a + r.amount, 0),
    sessions: paidRows.length,
    refunded: rows.filter((r) => r.status === 'refunded').reduce((a, r) => a + (r.refund?.amount ?? r.amount), 0),
  };

  async function update(m: SavedMethod, body: Record<string, unknown>, msg: string) {
    try {
      await patch(`/payments/methods/${m.id}`, body);
      toast(msg);
      methods.reload();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }
  async function remove(m: SavedMethod) {
    if (!window.confirm(`Remove ${m.nickname ?? NETWORK_LABEL[m.network]} •••• ${m.last4}? You can add it again later.`)) return;
    try {
      await del(`/payments/methods/${m.id}`);
      toast('Card removed');
      setOpenId(null);
      methods.reload();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  if (methods.loading && !methods.data) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        icon={Wallet}
        title="Payments"
        subtitle="Your saved cards and every mentoring session you’ve paid for."
        actions={
          pay?.gateway !== 'off' && (
            <button className="btn-primary" onClick={() => setAdding(true)}>
              <Plus size={15} /> Add card
            </button>
          )
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Card className="!p-6">
          {cards.length ? (
            <>
              <WalletStack key={list.map((m) => m.id).join()} cards={cards} label="Your cards" currency="INR" locale="en-IN" onSelectedChange={(c) => setOpenId(c?.id ?? null)} />
              <div className="mt-5 border-t border-[color:var(--line)] pt-4">
                {opened ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {opened.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-medium text-brand-800 ring-1 ring-inset ring-brand-200">
                        <Star size={12} /> Default card
                      </span>
                    ) : (
                      <button className="btn-secondary text-xs" onClick={() => update(opened, { isDefault: true }, 'Default card updated')}>
                        <Star size={13} /> Make default
                      </button>
                    )}
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => {
                        const n = window.prompt('Card nickname', opened.nickname ?? '');
                        if (n !== null) update(opened, { nickname: n.trim() || null }, 'Card renamed');
                      }}
                    >
                      <Pencil size={13} /> Rename
                    </button>
                    <button className="btn-ghost text-xs text-red-700" onClick={() => remove(opened)}>
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                ) : (
                  <p className="text-[12.5px] text-ink-500">
                    Open a card to see its payments and manage it. {list.find((m) => m.isDefault) && <>Your default is <span className="font-medium text-ink-700">{list.find((m) => m.isDefault)!.nickname ?? NETWORK_LABEL[list.find((m) => m.isDefault)!.network]} •••• {list.find((m) => m.isDefault)!.last4}</span>.</>}
                  </p>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              title="No saved cards yet"
              body="Save a card when you pay for a session, or add one here, and it shows up in your wallet."
              action={
                <button className="btn-primary" onClick={() => setAdding(true)}>
                  <Plus size={15} /> Add card
                </button>
              }
            />
          )}
        </Card>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Paid this year" value={inr(stats.year)} />
            <Stat label="Sessions paid" value={stats.sessions} />
            <Stat label="Refunded" value={inr(stats.refunded)} />
          </div>
          <Card title="Payment history">
            {rows.length === 0 ? (
              <p className="muted">No payments yet. When you book a session with a mentor who charges a fee, it shows up here.</p>
            ) : (
              <ul className="-my-1 divide-y divide-[color:var(--line)]">
                {rows.map((p) => (
                  <li key={p.id}>
                    <Link href={`/payments/${p.id}`} className="group flex items-center gap-3 py-3">
                      <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full', p.status === 'refunded' ? 'bg-violet-50 text-violet-800' : 'bg-ink-100 text-ink-600')}>{p.status === 'refunded' ? <RotateCcw size={15} /> : <GraduationCap size={16} />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-ink-900">{p.sessionTitle ?? 'Mentoring session'}</span>
                        <span className="block truncate text-[12px] text-ink-500">
                          {[p.mentorName, fmtDate(p.paidAt ?? p.createdAt), p.method?.label].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className={cx('text-[14px] font-semibold tabular-nums', p.status === 'failed' ? 'text-ink-400 line-through' : 'text-ink-900')}>{inr(p.amount)}</span>
                        <StatusBadge status={p.status} />
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <AddCardModal open={adding} onClose={() => setAdding(false)} onAdded={() => methods.reload()} config={pay} holderName={name} />
    </div>
  );
}

/* ------------------------------------------------------------------- mentor */
function MentorEarnings() {
  const pay = usePaymentConfig();
  const hist = useApi<{ payments: PaymentRow[] }>('/payments');
  const prof = useApi<{ profile: { sessionFee: number } }>('/alumni/me');
  const rows = hist.data?.payments ?? [];
  const paid = rows.filter((r) => r.status === 'paid');
  const fee = prof.data?.profile.sessionFee ?? 0;
  const stats = {
    earned: paid.reduce((a, r) => a + (r.mentorShare ?? 0), 0),
    gross: paid.reduce((a, r) => a + r.amount, 0),
    platform: paid.reduce((a, r) => a + (r.platformFee ?? 0), 0),
    refunded: rows.filter((r) => r.status === 'refunded').length,
  };
  if (hist.loading && !hist.data) return <PageLoader />;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Earnings"
        icon={IndianRupee}
        title="Earnings"
        subtitle="What students paid for your sessions, and your share after the platform fee."
        actions={
          <Link href="/mentor/profile#fee" className="btn-secondary">
            Session fee: {fee > 0 ? inr(fee * 100) : 'Free'} · Change
          </Link>
        }
      />
      {pay && !pay.enabled && <p className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-inset ring-amber-200">Paid sessions are switched off for the programme right now, so new sessions are free.</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Your share" value={inr(stats.earned)} hint="Paid sessions" />
        <Stat label="Students paid" value={inr(stats.gross)} />
        <Stat label="Platform fee" value={inr(stats.platform)} hint={pay ? `${pay.platformFeePercent}% per session` : undefined} />
        <Stat label="Refunded" value={stats.refunded} hint="Cancelled sessions" />
      </div>
      <Card title="Paid sessions">
        {rows.length === 0 ? (
          <p className="muted">{fee > 0 ? 'No paid sessions yet. Students pay when they pick one of your proposed times.' : 'Your sessions are free. Set a session fee on your profile if you want to charge.'}</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="text-[11.5px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-1 pb-2 font-medium">Date</th>
                  <th className="px-1 pb-2 font-medium">Student · session</th>
                  <th className="px-1 pb-2 text-right font-medium">Paid</th>
                  <th className="px-1 pb-2 text-right font-medium">Your share</th>
                  <th className="px-1 pb-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-1 py-2.5 text-ink-500">{fmtDate(p.paidAt ?? p.createdAt)}</td>
                    <td className="px-1 py-2.5">
                      <Link href={`/payments/${p.id}`} className="font-medium text-ink-900 hover:underline">
                        {p.studentName}
                      </Link>
                      <span className="text-ink-500"> · {p.sessionTitle}</span>
                    </td>
                    <td className="px-1 py-2.5 text-right tabular-nums">{inr(p.amount)}</td>
                    <td className="px-1 py-2.5 text-right font-semibold tabular-nums text-ink-900">{p.status === 'refunded' ? '—' : inr(p.mentorShare ?? 0)}</td>
                    <td className="px-1 py-2.5 text-right">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-[12px] text-ink-500">Payouts: the alumni office settles your share. Automatic bank payouts need Razorpay Route and a KYC check, which can be switched on later.</p>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------- staff */
function StaffPayments() {
  const toast = useToast();
  const pay = usePaymentConfig();
  const hist = useApi<{ payments: PaymentRow[] }>('/payments');
  const [filter, setFilter] = useState<'all' | 'paid' | 'refunded' | 'failed'>('all');
  const rows = hist.data?.payments ?? [];
  const paid = rows.filter((r) => r.status === 'paid');
  const shown = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  async function refund(p: PaymentRow) {
    const upcoming = !!p.sessionStart && new Date(p.sessionStart).getTime() > Date.now();
    const reason = window.prompt(
      `Refund ${inr(p.amount)} to ${p.studentName}?${upcoming ? ' The session has not happened yet, so it will be cancelled too.' : ''} Reason (shown to the student):`,
      'Refunded by the alumni office',
    );
    if (reason === null) return;
    try {
      const r = await post<{ sessionCancelled?: boolean }>(`/payments/${p.id}/refund`, { reason });
      toast(r.sessionCancelled ? 'Refund issued and the session cancelled' : 'Refund issued');
      hist.reload();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  if (hist.loading && !hist.data) return <PageLoader />;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Programme"
        icon={Wallet}
        title="Payments"
        subtitle={
          <>
            Session payments across the programme.{' '}
            {pay && (
              <span>
                Gateway: <span className="font-medium text-ink-700">{pay.gateway === 'razorpay' ? 'Razorpay' : pay.gateway === 'test' ? 'test gateway (no real money)' : 'off'}</span> · platform fee {pay.platformFeePercent}% ·{' '}
                <Link href="/admin/settings#payments" className="font-medium text-brand-700 hover:underline">
                  settings
                </Link>
              </span>
            )}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Collected" value={inr(paid.reduce((a, r) => a + r.amount, 0))} hint={`${paid.length} paid sessions`} />
        <Stat label="Platform revenue" value={inr(paid.reduce((a, r) => a + (r.platformFee ?? 0), 0))} />
        <Stat label="Refunded" value={inr(rows.filter((r) => r.status === 'refunded').reduce((a, r) => a + (r.refund?.amount ?? r.amount), 0))} />
        <Stat label="Failed attempts" value={rows.filter((r) => r.status === 'failed').length} tone={rows.some((r) => r.refund?.status === 'failed') ? 'warn' : undefined} />
      </div>
      <Card
        title="All payments"
        actions={
          <div className="flex gap-1">
            {(['all', 'paid', 'refunded', 'failed'] as const).map((f) => (
              <button key={f} className={cx('chip', filter === f && 'chip-active')} onClick={() => setFilter(f)}>
                {cap(f)}
              </button>
            ))}
          </div>
        }
      >
        {shown.length === 0 ? (
          <p className="muted">Nothing here yet.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[13px]">
              <thead className="text-[11.5px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-1 pb-2 font-medium">Date</th>
                  <th className="px-1 pb-2 font-medium">Student → mentor</th>
                  <th className="px-1 pb-2 font-medium">Method</th>
                  <th className="px-1 pb-2 text-right font-medium">Amount</th>
                  <th className="px-1 pb-2 text-right font-medium">Status</th>
                  <th className="px-1 pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {shown.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-1 py-2.5 text-ink-500">{fmtDate(p.paidAt ?? p.createdAt)}</td>
                    <td className="px-1 py-2.5">
                      <Link href={`/payments/${p.id}`} className="font-medium text-ink-900 hover:underline">
                        {p.studentName} → {p.mentorName}
                      </Link>
                      <span className="block text-[12px] text-ink-500">{p.sessionTitle}</span>
                    </td>
                    <td className="px-1 py-2.5 text-ink-600">{p.method?.label ?? '—'}</td>
                    <td className="px-1 py-2.5 text-right tabular-nums">{inr(p.amount)}</td>
                    <td className="px-1 py-2.5 text-right">
                      <StatusBadge status={p.refund?.status === 'failed' ? 'refund_failed' : p.status} />
                    </td>
                    <td className="px-1 py-2.5 text-right">
                      {p.status === 'paid' && (
                        <button className="btn-ghost px-2 text-xs" onClick={() => refund(p)}>
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
