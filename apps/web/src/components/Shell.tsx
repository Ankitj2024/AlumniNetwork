'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronsLeft, LogOut, Menu, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ACCOUNT_NAV, NAV, ROLE_LABEL, flatNav, type NavItem } from '@/lib/nav';
import { closeSocket, getSocket } from '@/lib/socket';
import type { Notice } from '@/lib/types';
import { EmailBanner, StaffMfaGate } from './AccountNotices';
import { LogoMark } from './Logo';
import { openCommandPalette } from './CommandPalette';
import { ThemeToggle } from './ThemeToggle';
import { PageTransition } from './motion';
import { Avatar, PageLoader, cx, useToast } from './ui';

const ROOTS = new Set(['/admin', '/mentor', '/student']);

export function Shell({ children }: { children: React.ReactNode }) {
  const { me, loading, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const [unread, setUnread] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!loading && !me) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [loading, me, router, path]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('amn.sidebar') === 'collapsed');
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('amn.sidebar', c ? 'open' : 'collapsed');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  useEffect(() => {
    if (!me) return;
    get<{ unread: number }>('/notifications?limit=1').then((d) => setUnread(d.unread)).catch(() => undefined);
    const s = getSocket();
    const onNote = (n: Notice) => {
      setUnread((u) => u + 1);
      if (n.type !== 'message' || !window.location.pathname.startsWith('/mentorships/')) toast(n.title);
    };
    s.on('notification', onNote);
    return () => {
      s.off('notification', onNote);
    };
  }, [me, toast]);

  useEffect(() => {
    setMoreOpen(false);
  }, [path]);
  useEffect(() => {
    const h = () => setUnread(0);
    window.addEventListener('notifications-read', h);
    return () => window.removeEventListener('notifications-read', h);
  }, []);

  if (loading || !me) return <PageLoader />;
  if (me.security?.mfaSetupRequired) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] px-4 py-10">
        <StaffMfaGate />
      </div>
    );
  }
  const role = me.user.role;
  const isActive = (href: string) => path === href || (!ROOTS.has(href) && path.startsWith(href + '/'));
  const primary = flatNav(role).filter((n) => n.primary).slice(0, 4);
  const signOut = () => {
    closeSocket();
    logout();
  };

  const NavLink = ({ n, i }: { n: NavItem; i: number }) => {
    const active = isActive(n.href);
    const Icon = n.icon;
    return (
      <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.02 * i, type: 'spring', stiffness: 320, damping: 28 }}>
        <Link
          href={n.href}
          title={collapsed ? n.label : undefined}
          className={cx('group relative flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-[13.5px] font-medium transition-colors', active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900', collapsed && 'justify-center px-0')}
        >
          {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-[10px] bg-surface shadow-[0_1px_2px_rgba(21,28,39,.08),0_0_0_1px_var(--line)]" transition={{ type: 'spring', stiffness: 460, damping: 36 }} />}
          <Icon size={17} strokeWidth={active ? 2.1 : 1.8} className={cx('relative shrink-0 transition-colors', active ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-700')} />
          {!collapsed && <span className="relative truncate">{n.label}</span>}
          {!collapsed && n.href === '/notifications' && unread > 0 && <span className="relative ml-auto rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">{unread > 99 ? '99+' : unread}</span>}
        </Link>
      </motion.div>
    );
  };

  let idx = 0;
  return (
    <div className="relative min-h-screen bg-[var(--canvas)] lg:flex">
      {/* ─────────────── desktop sidebar */}
      <aside className={cx('sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-[color:var(--line)] bg-[var(--sidebar)] transition-[width] duration-300 lg:flex', collapsed ? 'w-[68px]' : 'w-[248px]')}>
        <div className={cx('flex h-16 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
          <LogoMark size={32} />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="text-[13.5px] font-semibold tracking-[-0.01em]">Alumni Mentor</div>
              <div className="text-[11px] text-ink-500">{ROLE_LABEL[role]}</div>
            </div>
          )}
        </div>

        <div className={cx('px-3', collapsed && 'px-2.5')}>
          <button onClick={openCommandPalette} className={cx('flex w-full items-center gap-2 rounded-[10px] border border-[color:var(--line-strong)] bg-surface px-2.5 py-2 text-[13px] text-ink-400 shadow-[0_1px_2px_rgba(21,28,39,.04)] transition hover:border-ink-300 hover:text-ink-600', collapsed && 'justify-center px-0')} aria-label="Search (Ctrl+K)">
            <Search size={15} />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Search…</span>
                <span className="kbd">⌘K</span>
              </>
            )}
          </button>
        </div>

        <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {NAV[role].map((g, gi) => (
            <div key={gi} className="space-y-0.5">
              {g.label && !collapsed && <div className="eyebrow px-2.5 pb-1.5">{g.label}</div>}
              {g.label && collapsed && <div className="mx-auto my-2 h-px w-6 bg-ink-200" />}
              {g.items.map((n) => (
                <NavLink key={n.href} n={n} i={idx++} />
              ))}
            </div>
          ))}
          <div className="space-y-0.5 border-t border-[color:var(--line)] pt-4">
            {ACCOUNT_NAV.map((n) => (
              <NavLink key={n.href} n={n} i={idx++} />
            ))}
          </div>
        </nav>

        <div className={cx('border-t border-[color:var(--line)] p-3', collapsed && 'px-2')}>
          <div className={cx('flex items-center gap-2.5 rounded-xl p-1.5', collapsed && 'flex-col')}>
            <Avatar name={me.user.name} size="sm" src={me.user.avatarUrl} />
            {!collapsed && (
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[13px] font-medium">{me.user.name}</div>
                <div className="truncate text-[11px] text-ink-500">{ROLE_LABEL[role]}</div>
              </div>
            )}
            <button onClick={signOut} className="btn-ghost p-1.5" aria-label="Sign out" title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
          <div className={cx('mt-1 flex items-center gap-1', collapsed && 'flex-col')}>
            <button onClick={toggleCollapsed} className={cx('btn-ghost flex-1 justify-start gap-2 px-2.5 text-[12px] text-ink-400', collapsed && 'w-full flex-none justify-center px-0')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <ChevronsLeft size={15} className={cx('transition-transform', collapsed && 'rotate-180')} />
              {!collapsed && 'Collapse'}
            </button>
            <ThemeToggle size={15} className="text-ink-400" />
          </div>
        </div>
      </aside>

      {/* ─────────────── main column */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-[color:var(--line)] bg-surface/80 px-4 backdrop-blur-xl lg:hidden">
          <Link href={primary[0]?.href ?? '/'} className="flex items-center gap-2">
            <LogoMark size={28} />
            <span className="text-[13.5px] font-semibold">Alumni Mentor</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle size={18} />
            <button onClick={openCommandPalette} className="btn-ghost p-2" aria-label="Search">
              <Search size={18} />
            </button>
            <Link href="/notifications" className="btn-ghost relative p-2" aria-label="Notifications">
              <Bell size={18} />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-surface" />}
            </Link>
            <Avatar name={me.user.name} size="sm" src={me.user.avatarUrl} />
          </div>
        </header>

        <main className="relative mx-auto w-full max-w-[1180px] flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
          <EmailBanner />
          <PageTransition routeKey={path}>{children}</PageTransition>
        </main>

        {/* mobile bottom tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--line)] bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Primary">
          <div className="mx-auto grid max-w-md grid-cols-5">
            {primary.map((n) => {
              const active = isActive(n.href);
              const Icon = n.icon;
              return (
                <Link key={n.href} href={n.href} className="relative flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium">
                  {active && <motion.span layoutId="tab-active" className="absolute top-0 h-0.5 w-8 rounded-full bg-brand-500" />}
                  <Icon size={20} strokeWidth={active ? 2.2 : 1.8} className={active ? 'text-brand-600' : 'text-ink-400'} />
                  <span className={cx('max-w-full truncate px-1', active ? 'text-ink-900' : 'text-ink-500')}>{n.label}</span>
                </Link>
              );
            })}
            {Array.from({ length: Math.max(0, 4 - primary.length) }).map((_, k) => (
              <span key={k} />
            ))}
            <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium text-ink-500">
              <Menu size={20} strokeWidth={1.8} className="text-ink-400" />
              More
            </button>
          </div>
        </nav>

        {/* mobile "More" sheet */}
        <AnimatePresence>
          {moreOpen && (
            <motion.div className="fixed inset-0 z-40 bg-night/40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMoreOpen(false)}>
              <motion.div
                className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-2xl"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-200" />
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={me.user.name} size="sm" src={me.user.avatarUrl} />
                    <div className="leading-tight">
                      <div className="text-sm font-medium">{me.user.name}</div>
                      <div className="text-xs text-ink-500">{ROLE_LABEL[role]}</div>
                    </div>
                  </div>
                  <button className="btn-ghost p-2" onClick={() => setMoreOpen(false)} aria-label="Close">
                    <X size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-0.5">
                  {[...flatNav(role), ...ACCOUNT_NAV].map((n) => {
                    const Icon = n.icon;
                    return (
                      <Link key={n.href} href={n.href} className={cx('flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium', isActive(n.href) ? 'bg-ink-100 text-ink-900' : 'text-ink-600')}>
                        <Icon size={18} className="text-ink-400" />
                        {n.label}
                      </Link>
                    );
                  })}
                  <button onClick={signOut} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-700">
                    <LogOut size={18} /> Sign out
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
