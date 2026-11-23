import {
  BarChart3,
  Bell,
  BookUser,
  CalendarClock,
  ClipboardCheck,
  Compass,
  Database,
  Gauge,
  HeartPulse,
  Inbox,
  IndianRupee,
  LayoutDashboard,
  ScrollText,
  Settings,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from './types';

export type NavItem = { href: string; label: string; icon: LucideIcon; keywords?: string; primary?: boolean };
export type NavGroup = { label?: string; items: NavItem[] };

/** Navigation per role. `primary` items appear in the mobile bottom bar (max 4). */
export const NAV: Record<Role, NavGroup[]> = {
  student: [
    {
      items: [
        { href: '/student', label: 'Home', icon: LayoutDashboard, primary: true },
        { href: '/mentors', label: 'Find a mentor', icon: Compass, keywords: 'search match discover alumni', primary: true },
        { href: '/mentorships', label: 'Mentorships', icon: CalendarClock, keywords: 'sessions goals messages', primary: true },
        { href: '/student/profile', label: 'Career profile', icon: UserRound, keywords: 'goals interests roles', primary: true },
        { href: '/payments', label: 'Payments', icon: Wallet, keywords: 'cards wallet receipts billing upi pay' },
      ],
    },
  ],
  alumnus: [
    {
      items: [
        { href: '/mentor', label: 'Requests', icon: Inbox, keywords: 'inbox accept decline dashboard', primary: true },
        { href: '/mentorships', label: 'Mentees', icon: Users, keywords: 'sessions goals messages', primary: true },
        { href: '/mentor/availability', label: 'Capacity', icon: Gauge, keywords: 'availability pause limit slots', primary: true },
        { href: '/mentor/profile', label: 'Profile', icon: ShieldCheck, keywords: 'verification expertise bio fee', primary: true },
        { href: '/payments', label: 'Earnings', icon: IndianRupee, keywords: 'payments fee payouts money' },
      ],
    },
  ],
  aro: [
    { items: [{ href: '/admin', label: 'Overview', icon: LayoutDashboard, primary: true }] },
    {
      label: 'Programme',
      items: [
        { href: '/admin/verification', label: 'Verification', icon: ClipboardCheck, keywords: 'queue approve alumni records', primary: true },
        { href: '/admin/capacity', label: 'Mentor capacity', icon: Gauge, keywords: 'overload utilisation' },
        { href: '/admin/engagement', label: 'Engagement', icon: HeartPulse, keywords: 'health lapsed nudge', primary: true },
        { href: '/admin/mentors', label: 'Effectiveness', icon: Trophy, keywords: 'ranking rating' },
        { href: '/payments', label: 'Payments', icon: Wallet, keywords: 'refunds receipts money' },
      ],
    },
    {
      label: 'Insights',
      items: [{ href: '/analytics', label: 'Programme report', icon: BarChart3, keywords: 'analytics placement csv', primary: true }],
    },
    {
      label: 'Data',
      items: [
        { href: '/admin/records', label: 'Institution records', icon: Database, keywords: 'erp csv import' },
        { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
      ],
    },
  ],
  admin: [
    { items: [{ href: '/admin', label: 'Overview', icon: LayoutDashboard, primary: true }] },
    {
      label: 'Programme',
      items: [
        { href: '/admin/verification', label: 'Verification', icon: ClipboardCheck, keywords: 'queue approve alumni', primary: true },
        { href: '/admin/capacity', label: 'Mentor capacity', icon: Gauge },
        { href: '/admin/engagement', label: 'Engagement', icon: HeartPulse, keywords: 'health lapsed nudge' },
        { href: '/admin/mentors', label: 'Effectiveness', icon: Trophy },
        { href: '/payments', label: 'Payments', icon: Wallet, keywords: 'refunds receipts money revenue' },
      ],
    },
    { label: 'Insights', items: [{ href: '/analytics', label: 'Programme report', icon: BarChart3, primary: true }] },
    {
      label: 'System',
      items: [
        { href: '/admin/settings', label: 'Programme settings', icon: SlidersHorizontal, keywords: 'weights throttle expiry', primary: true },
        { href: '/admin/users', label: 'Users', icon: BookUser },
        { href: '/admin/records', label: 'Institution records', icon: Database },
        { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
      ],
    },
  ],
  placement: [{ items: [{ href: '/analytics', label: 'Programme & placement', icon: BarChart3, primary: true }] }],
};

export const ACCOUNT_NAV: NavItem[] = [
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings2, keywords: 'calendar google outlook notifications account' },
  { href: '/privacy', label: 'Privacy statement', icon: Settings },
];

export const ROLE_LABEL: Record<Role, string> = { student: 'Student', alumnus: 'Alumni mentor', aro: 'Alumni Relations', placement: 'Placement Office', admin: 'Administrator' };

export const flatNav = (role: Role) => NAV[role].flatMap((g) => g.items);
