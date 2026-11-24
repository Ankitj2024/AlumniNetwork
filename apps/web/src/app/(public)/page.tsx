'use client';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, BarChart3, Building2, CalendarClock, Check, ChevronDown, ChevronRight, Clock, Compass, Download, GraduationCap, Inbox, KeyRound, LayoutDashboard, Lock, Search, ShieldCheck, Sparkles, UserRound, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { LogoMark } from '@/components/Logo';
import { Reveal } from '@/components/motion';
import { SiteFooter } from '@/components/SiteFooter';
import TearTicket from '@/components/ui/tear-ticket';
import { cx } from '@/components/ui';
import { useTheme } from '@/lib/theme';

/* Static marketing copy only — the public page never calls a data endpoint. Product visuals are
   illustrative (labelled as such) and every claim is a property of how the platform works. */

const EASE = [0.22, 1, 0.36, 1] as const;

const AUDIENCES = [
  {
    icon: GraduationCap,
    label: 'Students',
    title: 'A mentor who fits — and says yes.',
    points: ['Ranked matches, with the reasons spelled out', 'Only mentors with open capacity', 'Sessions, goals and action items in one place'],
    cta: { href: '/register?role=student', label: 'Join as a student' },
  },
  {
    icon: Users,
    label: 'Alumni',
    title: 'Give back on your terms.',
    points: ['Set how many mentees and requests you take', 'Decline in one click; the student is redirected kindly', 'Your email and phone are never shown'],
    cta: { href: '/register?role=alumnus', label: 'Join as a mentor' },
  },
  {
    icon: Building2,
    label: 'Institutions',
    title: 'Engagement you can see and report.',
    points: ['Verification against your alumni register, fully audited', 'Weekly health checks with automatic nudges', 'Participation and outcome reporting, no personal data'],
    cta: { href: '/contact', label: 'Talk to us' },
  },
];

const PRINCIPLES = [
  { icon: ShieldCheck, title: 'Verified against records', body: 'Every mentor is checked against the institution’s alumni register before students can see them.' },
  { icon: Clock, title: 'Seven days to reply', body: 'Requests that aren’t answered expire, and the student is pointed to other strong matches.' },
  { icon: Users, title: 'Capacity mentors set', body: 'Mentors choose how many mentees and open requests they take. Nobody gets buried.' },
  { icon: Lock, title: 'Contact details never shown', body: 'Email and phone stay private, and contact details typed into messages are hidden before they’re saved.' },
  { icon: Download, title: 'Your data, your rights', body: 'Download everything the platform holds about you, or delete your account, from Settings — in line with India’s DPDP Act.' },
  { icon: KeyRound, title: 'Secure by default', body: 'Two-factor sign-in for staff, encrypted keys at rest, and an audit trail for every verification decision.' },
];

const FAQ = [
  ['Is it free for students?', 'Requesting a mentor is free. Some mentors set a session fee; if they do, you see it on their profile before you book, and you’re refunded in full if they cancel.'],
  ['How are mentors verified?', 'Alumni confirm their identity against the institution’s records — roll number, programme and graduation year — and an Alumni Relations officer reviews anything that doesn’t match exactly. Every decision is logged.'],
  ['Can mentors see my phone number or email?', 'No. Neither side sees the other’s email or phone. You talk through the platform, and sessions get their own video link.'],
  ['What happens if a mentor doesn’t reply?', 'Mentors have seven days. After that the request expires, your slot is freed, and we suggest other mentors with open capacity.'],
  ['How does an institution get started?', 'Get in touch. We set up your programme, import your alumni register for verification, and give your Alumni Relations team their dashboard.'],
  ['Can I delete my account?', 'Yes, at any time, from Settings → Your data. You can download a copy of everything first. Records the law requires, like payment receipts, are kept without your name.'],
];

export default function Landing() {
  const dark = useTheme().theme === 'dark';
  const [torn, setTorn] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: preview, offset: ['start end', 'center center'] });
  const tilt = useTransform(scrollYProgress, [0, 1], [14, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);

  return (
    <div className="bg-canvas text-ink-900">
      {/* ───────────────────────────── hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(0,113,227,0.10),transparent_70%)] dark:bg-[radial-gradient(60%_50%_at_50%_0%,rgba(41,151,255,0.16),transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-5 pt-16 text-center sm:px-6 sm:pt-24">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
            <Link href="/#product" className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-surface/70 py-1 pl-1 pr-3 text-[13px] text-ink-600 backdrop-blur transition hover:border-[color:var(--line-strong)]">
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">New</span>
              Mentorship, verified by your institution <ChevronRight size={14} className="text-ink-400" />
            </Link>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.05, ease: EASE }} className="mx-auto mt-7 max-w-4xl text-[44px] font-semibold leading-[1.03] tracking-[-0.045em] sm:text-[76px]">
            Mentoring that respects <span className="text-gradient">everyone’s time.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: EASE }} className="mx-auto mt-6 max-w-2xl text-[19px] leading-[1.5] text-ink-500 sm:text-[21px]">
            The alumni mentorship platform for institutions. Students meet verified alumni with the right expertise and the capacity to help — and no one’s contact details ever change hands.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25, ease: EASE }} className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register?role=student" className="btn-primary px-6 py-3 text-[15px]">
              Get started — it’s free <ArrowRight size={16} />
            </Link>
            <Link href="/contact" className="btn-secondary px-6 py-3 text-[15px]">
              For institutions
            </Link>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }} className="mt-5 text-[13px] text-ink-400">
            Alumni? <Link href="/register?role=alumnus" className="link">Become a mentor</Link>
          </motion.p>

          {/* product preview: tilts upright as it scrolls into view */}
          <div ref={preview} className="relative mx-auto mt-16 max-w-5xl [perspective:1600px] sm:mt-20">
            <motion.div style={{ rotateX: tilt, scale }} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.35, ease: EASE }} className="origin-top">
              <ProductPreview />
            </motion.div>
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-canvas to-transparent" />
          </div>
        </div>
      </section>

      {/* ───────────────────────────── features */}
      <section id="product" className="scroll-mt-14">
        <div className="mx-auto max-w-6xl px-5 pb-8 pt-24 text-center sm:px-6 sm:pt-32">
          <Reveal>
            <p className="text-[15px] font-semibold text-brand-700">The platform</p>
            <h2 className="mx-auto mt-3 max-w-3xl text-[36px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[56px]">
              Everything a mentorship needs. <span className="text-ink-400">Nothing that burns mentors out.</span>
            </h2>
          </Reveal>
        </div>

        <Feature
          kicker="Matching"
          title="Matches that explain themselves."
          body="Students see verified alumni ranked by fit — expertise, target role, industry and the help they need — and every suggestion says why. Only mentors with room to take someone on are shown, so requests get answered."
          visual={<MatchVisual />}
        />
        <Feature
          flip
          kicker="Capacity"
          title="Mentor time, protected by design."
          body="Mentors set hard limits on mentees and open requests. Requests expire after seven days, and students are throttled so no one is flooded. Saying no takes one click — and the student is kindly redirected."
          visual={<CapacityVisual />}
        />
        <Feature
          kicker="Sessions"
          title="Every session, one tap away."
          body="Propose times, confirm, and join by video. Goals and action items live alongside the conversation, and both sides leave feedback after each session. Booked sessions come with a pass — try tearing it."
          visual={
            <div className="flex flex-col items-center">
              <div className="w-full max-w-[460px] drop-shadow-[0_30px_50px_rgba(0,0,0,0.14)] dark:drop-shadow-[0_30px_50px_rgba(0,0,0,0.6)]">
                <TearTicket
                  width={460}
                  height={224}
                  stubSize={140}
                  radius={20}
                  rotate={-3}
                  background={dark ? '#1c1c1e' : '#ffffff'}
                  color={dark ? '#f5f5f7' : '#1d1d1f'}
                  ariaLabel="Tear the stub to join the session"
                  onTear={() => setTorn(true)}
                  stub={
                    <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
                      <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] opacity-50">Admit one</span>
                      <span className="text-[21px] font-semibold tracking-[-0.03em]">Join</span>
                      <span className="mt-2 text-[11px] opacity-50">Pull to tear ›</span>
                    </div>
                  }
                >
                  <div className="flex h-full flex-col justify-between p-6 text-left">
                    <div>
                      <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-brand-600 dark:text-[#2997ff]">Session pass</span>
                      <p className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.03em]">Mock interview</p>
                      <p className="mt-1 text-[13px] opacity-60">with your mentor · 45 min</p>
                    </div>
                    <div className="flex gap-6 text-[12px]">
                      <div>
                        <div className="opacity-45">When</div>
                        <div className="mt-0.5 font-semibold">Thu · 6:00 pm</div>
                      </div>
                      <div>
                        <div className="opacity-45">Where</div>
                        <div className="mt-0.5 font-semibold">Video call</div>
                      </div>
                    </div>
                  </div>
                </TearTicket>
              </div>
              <p className="mt-5 h-5 text-[13px] text-ink-500" aria-live="polite">
                {torn ? 'That’s it — you’re in.' : 'Pull the stub to tear it.'}
              </p>
            </div>
          }
        />
        <Feature
          flip
          kicker="Reporting"
          title="Outcomes your institution can report."
          body="Alumni Relations sees participation, session completion, mentor load and placement correlation at a glance, with weekly health checks that nudge stalled mentorships back to life. Reports never include anyone’s personal data."
          visual={<ReportVisual />}
        />
      </section>

      {/* ───────────────────────────── privacy band */}
      <section className="mt-24 bg-black text-[#f5f5f7] sm:mt-32">
        <div className="mx-auto max-w-5xl px-5 py-24 text-center sm:px-6 sm:py-32">
          <Reveal>
            <Lock size={28} className="mx-auto text-[#86868b]" />
            <h2 className="mx-auto mt-6 max-w-3xl text-[36px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[56px]">
              Private by default. <span className="text-[#86868b]">Your email and phone stay yours.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-[#a1a1a6]">Contact details typed into a message are hidden before it’s saved. Students see a mentor’s expertise — never how to reach them outside the platform.</p>
            <div className="mx-auto mt-10 inline-block rounded-[22px] rounded-bl-md bg-[#1c1c1e] px-5 py-3 text-left text-[15px] text-[#d2d2d7]">
              Sure — mail me at <span className="rounded-md bg-[#2997ff]/20 px-1.5 py-0.5 text-[#2997ff]">[contact hidden]</span>
            </div>
            <div className="mt-10">
              <Link href="/privacy" className="inline-flex items-center gap-0.5 text-[17px] font-medium text-[#2997ff] hover:underline hover:underline-offset-4">
                Read the privacy statement <ChevronRight size={18} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────────────────────── audiences */}
      <section id="roles" className="scroll-mt-14">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-6 sm:py-32">
          <Reveal className="text-center">
            <p className="text-[15px] font-semibold text-brand-700">Who it’s for</p>
            <h2 className="mx-auto mt-3 max-w-3xl text-[36px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[56px]">One programme. Three very different needs.</h2>
          </Reveal>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {AUDIENCES.map((a, i) => (
              <Reveal key={a.label} delay={0.08 * i}>
                <div className="card flex h-full flex-col p-8">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink-900/[0.05] text-ink-700">
                    <a.icon size={20} />
                  </span>
                  <p className="mt-6 text-[13px] font-semibold text-ink-500">{a.label}</p>
                  <h3 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.025em]">{a.title}</h3>
                  <ul className="mt-5 flex-1 space-y-3">
                    {a.points.map((p) => (
                      <li key={p} className="flex gap-2.5 text-[15px] leading-snug text-ink-600">
                        <Check size={17} className="mt-0.5 shrink-0 text-brand-600" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <Link href={a.cta.href} className="link mt-7 inline-flex items-center gap-0.5 text-[15px]">
                    {a.cta.label} <ChevronRight size={16} />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────────── principles */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-6 sm:py-32">
          <Reveal className="max-w-2xl">
            <p className="text-[15px] font-semibold text-brand-700">Trust</p>
            <h2 className="mt-3 text-[36px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[48px]">Built on principles, not promises.</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink-500">These aren’t settings someone can forget to switch on. They’re how the platform works.</p>
          </Reveal>
          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.title} delay={0.05 * i}>
                <p.icon size={22} className="text-brand-600" />
                <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.015em]">{p.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-500">{p.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────────── how it works */}
      <section id="how" className="scroll-mt-14">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-6 sm:py-32">
          <Reveal className="text-center">
            <p className="text-[15px] font-semibold text-brand-700">How it works</p>
            <h2 className="mt-3 text-[36px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[56px]">
              From hello to hired. <span className="text-ink-400">In three steps.</span>
            </h2>
          </Reveal>
          <div className="relative mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
            <div aria-hidden className="absolute left-[16%] right-[16%] top-6 hidden h-px bg-[color:var(--line-strong)] md:block" />
            {[
              ['1', 'Get verified', 'Alumni confirm their identity against the institution’s records. Students describe their goals.'],
              ['2', 'Get matched', 'Students see mentors ranked by fit — with reasons — and only those with open capacity.'],
              ['3', 'Grow together', 'Book sessions, set goals, track actions and share feedback. Gentle nudges keep it alive.'],
            ].map(([n, t, d], i) => (
              <Reveal key={n} delay={0.1 + i * 0.1} className="relative text-center">
                <div className="relative mx-auto grid h-12 w-12 place-items-center rounded-full border border-[color:var(--line-strong)] bg-canvas text-[17px] font-semibold">{n}</div>
                <h3 className="mt-5 text-[21px] font-semibold tracking-[-0.02em]">{t}</h3>
                <p className="mx-auto mt-2 max-w-xs text-[16px] leading-relaxed text-ink-500">{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────────── FAQ */}
      <section id="faq" className="scroll-mt-14 border-t border-[color:var(--line)]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-6 sm:py-32 lg:grid-cols-[1fr_1.4fr]">
          <Reveal>
            <h2 className="text-[36px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[48px]">Questions, answered.</h2>
            <p className="mt-4 text-[17px] text-ink-500">
              Something else? <Link href="/contact" className="link">Get in touch</Link>.
            </p>
          </Reveal>
          <div className="divide-y divide-[color:var(--line-strong)] border-y border-[color:var(--line-strong)]">
            {FAQ.map(([q, a]) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────────── CTA */}
      <section className="px-5 pb-24 sm:px-6 sm:pb-32">
        <Reveal>
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-ink-900 px-6 py-20 text-center text-ink-50 sm:py-24">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(41,151,255,0.35),transparent_70%)]" />
            <LogoMark size={52} className="relative mx-auto" />
            <h2 className="relative mt-8 text-[40px] font-semibold leading-[1.04] tracking-[-0.045em] sm:text-[64px]">Give an hour. Change a career.</h2>
            <p className="relative mx-auto mt-5 max-w-xl text-[18px] text-ink-400">Join as a student to find guidance, or as an alumnus to give back — on your terms.</p>
            <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="btn bg-white px-6 py-3 text-[15px] text-[#1d1d1f] hover:bg-white/90 dark:bg-[#1d1d1f] dark:text-white dark:hover:bg-black">
                Create your account <ArrowRight size={16} />
              </Link>
              <Link href="/contact" className="btn border border-current/20 px-6 py-3 text-[15px] opacity-80 hover:opacity-100">
                Talk to us
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── sections */

function Feature({ kicker, title, body, visual, flip = false }: { kicker: string; title: string; body: string; visual: React.ReactNode; flip?: boolean }) {
  return (
    <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-20">
      <Reveal className={cx('max-w-xl', flip && 'lg:order-2')}>
        <p className="text-[14px] font-semibold text-brand-700">{kicker}</p>
        <h3 className="mt-3 text-[30px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[40px]">{title}</h3>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-500">{body}</p>
      </Reveal>
      <Reveal delay={0.1} className={cx(flip && 'lg:order-1')}>
        {visual}
      </Reveal>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="flex w-full items-center justify-between gap-4 py-5 text-left text-[17px] font-medium tracking-[-0.015em]" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {q}
        <ChevronDown size={18} className={cx('shrink-0 text-ink-400 transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <p className="pb-5 pr-8 text-[15.5px] leading-relaxed text-ink-500">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── visuals (illustrative) */

const initialsOf = (n: string) => n.split(' ').map((p) => p[0]).join('');

function ProductPreview() {
  const mentors: [string, string, number, string, number][] = [
    ['Priya N.', 'Senior Data Scientist · Fintech', 93, 'Shares 4 of your interests', 2],
    ['Arjun K.', 'Machine Learning Engineer · SaaS', 86, 'Close to your target role', 1],
    ['Meera R.', 'Product Manager · Consumer tech', 78, 'Offers interview prep', 3],
  ];
  const nav: [typeof LayoutDashboard, string, boolean][] = [
    [LayoutDashboard, 'Home', false],
    [Compass, 'Find a mentor', true],
    [CalendarClock, 'Mentorships', false],
    [UserRound, 'Career profile', false],
    [Wallet, 'Payments', false],
  ];
  return (
    <div className="overflow-hidden rounded-[20px] border border-[color:var(--line-strong)] bg-surface text-left shadow-[0_40px_120px_-40px_rgba(0,0,0,0.35)] dark:shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]" aria-label="Illustrative preview of the student app" role="img">
      <div className="flex items-center gap-2 border-b border-[color:var(--line)] bg-canvas/60 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="mx-auto hidden rounded-md bg-ink-900/[0.05] px-12 py-1 text-[11px] text-ink-400 sm:block">Find your mentor</span>
      </div>
      <div className="flex">
        <aside className="hidden w-52 shrink-0 border-r border-[color:var(--line)] p-3 md:block">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <LogoMark size={22} />
            <span className="text-[12.5px] font-semibold">Alumni Mentor</span>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[color:var(--line)] px-2.5 py-1.5 text-[11.5px] text-ink-400">
            <Search size={12} /> Search…
          </div>
          <div className="mt-4 space-y-0.5">
            {nav.map(([Icon, label, active]) => (
              <div key={label} className={cx('flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px]', active ? 'bg-ink-900/[0.06] font-medium text-ink-900' : 'text-ink-500')}>
                <Icon size={13} className={active ? 'text-brand-600' : ''} /> {label}
              </div>
            ))}
          </div>
        </aside>
        <div className="min-w-0 flex-1 p-5 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">Discover</p>
          <p className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">Find your mentor</p>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[color:var(--line-strong)] px-3 py-2 text-[12.5px] text-ink-400">
            <Search size={14} /> Search by name, role, company or industry
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mentors.map(([n, r, s, why, open], i) => (
              <div key={n} className={cx('rounded-2xl border border-[color:var(--line)] bg-surface p-4 shadow-card', i === 2 && 'hidden lg:block')}>
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#a8a8ad] to-[#86868b] text-[12px] font-semibold text-white">{initialsOf(n)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold">{n}</div>
                    <div className="truncate text-[11.5px] text-ink-500">{r}</div>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-full border-[3px] border-brand-600 text-[12px] font-semibold tabular-nums">{s}</div>
                </div>
                <div className="mt-3 rounded-xl bg-ink-900/[0.03] p-2.5 text-[11.5px] text-ink-600">
                  <span className="flex items-center gap-1.5">
                    <Check size={12} className="text-ok-600" /> {why}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px]">
                  {[0, 1, 2, 3].map((k) => (
                    <span key={k} className={cx('h-2 w-3 rounded-full', k < 4 - open ? 'bg-ink-200' : 'bg-ok-400')} />
                  ))}
                  <span className="ml-1 font-medium text-ok-700">
                    {open} of 4 open
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function VisualCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('rounded-[28px] bg-gradient-to-b from-ink-900/[0.03] to-transparent p-4 sm:p-8', className)}>{children}</div>;
}

function MatchVisual() {
  const rows: [string, number][] = [
    ['Shared expertise', 92],
    ['Role fit', 88],
    ['Industry', 100],
    ['Help offered', 75],
    ['Open capacity', 100],
  ];
  return (
    <VisualCard>
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-b from-[#a8a8ad] to-[#86868b] text-[14px] font-semibold text-white">PN</span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold">Priya N.</div>
            <div className="text-[12.5px] text-ink-500">Senior Data Scientist · Fintech</div>
          </div>
          <div className="text-right">
            <div className="text-[30px] font-semibold leading-none tracking-[-0.04em]">93</div>
            <div className="text-[10px] uppercase tracking-wider text-ink-400">match</div>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {rows.map(([label, v], i) => (
            <div key={label}>
              <div className="mb-1 flex justify-between text-[12px] text-ink-500">
                <span>{label}</span>
                <span className="tabular-nums">{v}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-900/[0.08]">
                <motion.div className="h-full rounded-full bg-brand-600" initial={{ width: 0 }} whileInView={{ width: `${v}%` }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.08 * i, ease: EASE }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-1.5 text-[13px] text-ink-600">
          <p className="flex gap-2"><Sparkles size={14} className="mt-0.5 shrink-0 text-brand-600" /> Shares 4 of your interests: Machine Learning, Python…</p>
          <p className="flex gap-2"><Sparkles size={14} className="mt-0.5 shrink-0 text-brand-600" /> Works close to your target role, “Data Scientist”</p>
        </div>
      </div>
      <p className="mt-3 text-center text-[11.5px] text-ink-400">Illustrative example</p>
    </VisualCard>
  );
}

function CapacityVisual() {
  const steps: [typeof Inbox, string, string][] = [
    [Inbox, 'Request sent', 'With the student’s goals attached'],
    [Clock, 'Seven days to reply', 'Accept, or decline in one click'],
    [Compass, 'Never left hanging', 'Expired or declined? Other open mentors are suggested'],
  ];
  return (
    <VisualCard>
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-medium text-ink-500">Your capacity</div>
            <div className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">2 of 4 slots open</div>
          </div>
          <span className="rounded-full bg-ok-50 px-3 py-1 text-[12px] font-medium text-ok-800">Accepting</span>
        </div>
        <div className="mt-4 flex gap-1.5">
          {[1, 1, 0, 0].map((u, i) => (
            <motion.span key={i} initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ delay: 0.08 * i, duration: 0.5, ease: EASE }} className={cx('h-2.5 flex-1 origin-left rounded-full', u ? 'bg-ink-300' : 'bg-ok-400')} />
          ))}
        </div>
      </div>
      <div className="card mt-4 p-6">
        <ol className="relative space-y-5 border-l border-[color:var(--line-strong)] pl-6">
          {steps.map(([Icon, t, d]) => (
            <li key={t} className="relative">
              <span className="absolute -left-[37px] grid h-6 w-6 place-items-center rounded-full border border-[color:var(--line-strong)] bg-surface text-ink-500">
                <Icon size={12} />
              </span>
              <div className="text-[14px] font-semibold">{t}</div>
              <div className="text-[13px] text-ink-500">{d}</div>
            </li>
          ))}
        </ol>
      </div>
    </VisualCard>
  );
}

function ReportVisual() {
  const bars = [34, 48, 41, 57, 63, 71, 86];
  return (
    <VisualCard>
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink-500">
              <BarChart3 size={14} /> Programme report
            </div>
            <div className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">Sessions completed</div>
          </div>
          <span className="rounded-full bg-ink-900/[0.05] px-3 py-1 text-[12px] font-medium text-ink-600">This term</span>
        </div>
        <div className="mt-6 flex h-40 items-end gap-2">
          {bars.map((h, i) => (
            <motion.span key={i} initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} transition={{ delay: 0.06 * i, duration: 0.7, ease: EASE }} className={cx('w-full rounded-t-lg', i === bars.length - 1 ? 'bg-brand-600' : 'bg-ink-900/[0.08]')} />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-[color:var(--line)] pt-5 text-[12px]">
          {['Participation', 'Mentor load', 'Health'].map((l) => (
            <div key={l}>
              <div className="text-ink-400">{l}</div>
              <div className="mt-1 h-1.5 rounded-full bg-ink-900/[0.08]">
                <div className="h-full w-2/3 rounded-full bg-ink-400" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-[11.5px] text-ink-400">Illustrative example — reports contain no personal data</p>
    </VisualCard>
  );
}
