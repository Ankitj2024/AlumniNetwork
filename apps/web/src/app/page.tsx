'use client';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, BarChart3, CalendarCheck2, Check, Clock, GraduationCap, Lock, ShieldCheck, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Logo, LogoMark } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Globe } from '@/components/Globe';
import { Aurora, CountUp, Reveal, Tilt } from '@/components/motion';
import BlurText from '@/components/reactbits/BlurText';
import { LogoLoop } from '@/components/reactbits/LogoLoop';
import RotatingText from '@/components/reactbits/RotatingText';
import ShinyText from '@/components/reactbits/ShinyText';
import SpotlightCard from '@/components/reactbits/SpotlightCard';
import StarBorder from '@/components/reactbits/StarBorder';
import { cx } from '@/components/ui';
import { useTheme } from '@/lib/theme';

/* Static marketing copy only — the public page never calls a data endpoint. */
const COMPANIES = ['Quantia AI', 'Northwind Systems', 'Ledgerline', 'Meridian Partners', 'Siliconix India', 'Cartly', 'MedAxis', 'Helix Cloud', 'Greenvolt Energy', 'PayArc', 'Lumen Analytics', 'Crestview Consulting'];

const ROLES = {
  students: {
    label: 'Students',
    icon: GraduationCap,
    title: 'A mentor who fits — and says yes.',
    points: ['Ranked matches with the reasons spelled out', 'Only mentors with open capacity, so requests get answered', 'Sessions, goals and action items in one place'],
  },
  alumni: {
    label: 'Alumni',
    icon: Users,
    title: 'Give back on your terms.',
    points: ['You set how many mentees and open requests you take', 'Decline in one click — the student is redirected kindly', 'Your email and phone are never shown to students'],
  },
  institution: {
    label: 'Institution',
    icon: BarChart3,
    title: 'Engagement you can see and report.',
    points: ['Verification against your alumni register, fully audited', 'Weekly health checks with automatic nudges', 'Participation, outcomes and placement correlation'],
  },
} as const;

export default function Landing() {
  const hero = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ['start start', 'end start'] });
  const globeY = useTransform(scrollYProgress, [0, 1], [0, 110]);
  const globeScale = useTransform(scrollYProgress, [0, 1], [1, 0.88]);
  const [role, setRole] = useState<keyof typeof ROLES>('students');
  const dark = useTheme().theme === 'dark';
  const R = ROLES[role];

  return (
    <div className="bg-ink-50 text-ink-950 selection:bg-brand-400/30">
      {/* ───────────────────────────── hero */}
      <section ref={hero} className="relative min-h-[100svh] overflow-hidden">
        <Aurora dark={dark} contained />
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_20%,rgb(var(--ink-50)/.85)_75%)]" />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgb(var(--ink-950)/.035)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--ink-950)/.035)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />

        <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-6">
          <Link href="/" className="flex" aria-label="Alumni Mentor Network home">
            <Logo size={34} compact />
          </Link>
          <nav className="hidden items-center gap-7 text-[13.5px] text-ink-950/60 md:flex">
            <a href="#product" className="transition hover:text-ink-950">Product</a>
            <a href="#roles" className="transition hover:text-ink-950">Who it’s for</a>
            <a href="#how" className="transition hover:text-ink-950">How it works</a>
            <Link href="/privacy" className="transition hover:text-ink-950">Privacy</Link>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle className="text-ink-950/70 hover:bg-ink-950/10 hover:text-ink-950" />
            <Link href="/login" className="btn text-ink-950/75 hover:bg-ink-950/10 hover:text-ink-950">
              Sign in
            </Link>
            <Link href="/register" className="btn bg-ink-950 text-ink-50 hover:bg-ink-800">
              Get started
            </Link>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-8 sm:px-6 lg:grid-cols-[1.08fr_1fr] lg:pt-14">
          <div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-ink-950/[0.12] bg-ink-950/[0.05] py-1 pl-1 pr-3 backdrop-blur">
              <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-[11px] font-semibold text-brand-800">New</span>
              <ShinyText text="Verified alumni mentorship, built to last" color={dark ? 'rgba(255,255,255,.7)' : 'rgba(21,28,39,.72)'} shineColor={dark ? '#ffffff' : '#1fa388'} speed={3} className="text-[12.5px] font-medium" />
            </motion.div>

            <h1 className="text-[42px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[64px]">
              <BlurText as="span" text="Mentoring that respects" animateBy="words" delay={90} direction="top" className="block" />
              <motion.span initial={{ opacity: 0, filter: 'blur(10px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ delay: 0.45, duration: 0.7 }} className="block font-serif font-normal italic tracking-[-0.02em] text-brand-800">
                everyone’s time.
              </motion.span>
            </h1>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }} className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[19px] text-ink-950/70">
              <span>Grow your</span>
              <RotatingText
                texts={['career', 'confidence', 'network', 'first offer']}
                mainClassName="overflow-hidden rounded-lg bg-gradient-to-r from-brand-500 to-iris-500 px-2.5 py-0.5 font-semibold text-white"
                staggerFrom="last"
                staggerDuration={0.025}
                rotationInterval={2400}
                splitLevelClassName="overflow-hidden"
                transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              />
              <span>with alumni who’ve been there.</span>
            </motion.div>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-ink-950/55">
              Students meet verified alumni with the right expertise <em className="font-serif text-ink-950/80">and</em> the capacity to help. Alumni set their own limits. The institution sees outcomes — never anyone’s contact details.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05 }} className="mt-8 flex flex-wrap items-center gap-3">
              <StarBorder as={Link} href="/register?role=student" color="#78d8bf" backgroundColor="#0f1d22" textColor="#ffffff" radius={12} duration={3.2} className="text-[14.5px] font-semibold">
                I’m a student <ArrowRight size={16} />
              </StarBorder>
              <Link href="/register?role=alumnus" className="btn border border-ink-950/15 bg-ink-950/[0.04] px-5 py-3.5 text-[14.5px] text-ink-950 backdrop-blur hover:bg-ink-950/10">
                I’m an alumnus — mentor
              </Link>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.25 }} className="mt-9 flex items-center gap-3 text-[13px] text-ink-950/50">
              <div className="flex -space-x-2">
                {['from-brand-400 to-brand-700', 'from-iris-400 to-iris-600', 'from-sky-400 to-indigo-600', 'from-amber-400 to-orange-600'].map((g, i) => (
                  <span key={g} className={`h-7 w-7 rounded-full bg-gradient-to-br ring-2 ring-ink-50 ${g}`} style={{ zIndex: 4 - i }} />
                ))}
              </div>
              <span>
                <span className="font-semibold text-ink-950">60+</span> verified mentors · <span className="font-semibold text-ink-950">92%</span> session completion
              </span>
            </motion.div>
          </div>

          {/* globe + live product moments */}
          <motion.div className="relative mx-auto aspect-square w-full max-w-[540px]" style={{ y: globeY, scale: globeScale }} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}>
            <div className="absolute inset-[14%] rounded-full bg-brand-500/20 blur-3xl" aria-hidden />
            <Globe className="absolute inset-0" />
            <Floating className="left-[-4%] top-[10%] w-[230px]" delay={1.1}>
              <div className="flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-700" />
                <div className="min-w-0 leading-tight">
                  <div className="text-[13px] font-semibold">Priya N.</div>
                  <div className="truncate text-[11px] text-ink-950/55">Senior Data Scientist</div>
                </div>
                <span className="ml-auto rounded-md bg-brand-500/25 px-1.5 py-0.5 text-[11px] font-bold text-brand-800">93</span>
              </div>
              <div className="mt-2.5 space-y-1 text-[11px] text-ink-950/60">
                <div className="flex gap-1.5"><Check size={12} className="mt-px text-brand-700" /> Shares 4 of your interests</div>
                <div className="flex gap-1.5"><Check size={12} className="mt-px text-brand-700" /> Works in your target industry</div>
              </div>
            </Floating>
            <Floating className="bottom-[16%] right-[-2%]" delay={1.5}>
              <div className="flex items-center gap-2 text-[12.5px]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white"><Check size={13} strokeWidth={3} /></span>
                <span className="font-medium">Request accepted</span>
              </div>
            </Floating>
            <Floating className="bottom-[3%] left-[8%]" delay={1.9}>
              <div className="flex items-center gap-2 text-[12px] text-ink-950/75">
                <Lock size={13} className="text-brand-700" /> Email & phone stay private
              </div>
            </Floating>
          </motion.div>
        </div>
      </section>

      {/* ───────────────────────────── logo loop */}
      <section className="relative border-y border-ink-950/5 bg-ink-50 py-10">
        <p className="mb-6 text-center text-[12px] font-medium uppercase tracking-[0.16em] text-ink-950/40">Our alumni mentor from teams like</p>
        <LogoLoop
          logos={COMPANIES.map((c) => ({ node: <span className="whitespace-nowrap text-[17px] font-semibold tracking-[-0.02em] text-ink-950/45 transition-colors hover:text-ink-950">{c}</span>, title: c }))}
          speed={60}
          gap={56}
          logoHeight={28}
          pauseOnHover
          fadeOut
          fadeOutColor={dark ? '#0a0f1a' : '#f5f7fa'}
          ariaLabel="Companies our alumni work at"
        />
      </section>

      {/* ───────────────────────────── product bento */}
      <section id="product" className="relative bg-ink-50">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
          <Reveal className="max-w-2xl">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-brand-700">The product</p>
            <h2 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[44px]">
              Everything a mentorship needs. <span className="font-serif font-normal italic text-ink-950/60">Nothing that burns mentors out.</span>
            </h2>
          </Reveal>

          <div className="mt-12 grid auto-rows-[minmax(200px,auto)] gap-4 md:grid-cols-6">
            <Bento className="md:col-span-4 md:row-span-2" icon={Sparkles} title="Matches with the reasons spelled out" body="Ranked on expertise, target role, industry and the help you need — and every suggestion says why.">
              <div className="mt-6 space-y-2.5">
                {[
                  ['Priya N.', 'Senior Data Scientist · Quantia AI', 93, ['Shares 4 of your interests', 'Works in Data & AI']],
                  ['Arjun K.', 'ML Engineer · Lumen Analytics', 84, ['Close to your target role', 'Offers interview prep']],
                  ['Meera R.', 'Quant Analyst · Ledgerline', 76, ['Works in FinTech', '2 of 3 slots open']],
                ].map(([n, r, s, why], i) => (
                  <motion.div key={n as string} initial={{ opacity: 0, x: -14 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 * i, type: 'spring', stiffness: 200, damping: 22 }} className="flex items-center gap-3 rounded-xl border border-ink-950/[0.08] bg-ink-950/[0.03] p-3">
                    <span className={`h-9 w-9 shrink-0 rounded-full bg-gradient-to-br ${i === 0 ? 'from-brand-400 to-brand-700' : i === 1 ? 'from-iris-400 to-iris-600' : 'from-sky-400 to-indigo-600'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold">{n as string}</div>
                      <div className="truncate text-[12px] text-ink-950/50">{r as string}</div>
                      <div className="mt-1 hidden gap-3 text-[11px] text-ink-950/45 sm:flex">
                        {(why as string[]).map((w) => (
                          <span key={w} className="flex items-center gap-1"><Check size={11} className="text-brand-700" /> {w}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[20px] font-semibold tabular-nums text-brand-800">{s as number}</div>
                      <div className="text-[9.5px] uppercase tracking-wider text-ink-950/40">match</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Bento>

            <Bento className="md:col-span-2" icon={Clock} title="Mentor time, protected" body="Hard capacity limits, throttled requests and automatic expiry.">
              <div className="mt-5 flex items-end gap-1.5">
                {[1, 1, 0, 0].map((u, i) => (
                  <motion.span key={i} initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 * i }} className={`h-7 w-6 origin-bottom rounded-md ${u ? 'bg-ink-950/25' : 'bg-gradient-to-b from-brand-300 to-brand-500 shadow-[0_0_14px_rgba(65,191,162,.6)]'}`} />
                ))}
                <span className="ml-2 text-[12px] text-ink-950/55">2 of 4 slots open</span>
              </div>
            </Bento>

            <Bento className="md:col-span-2" icon={ShieldCheck} title="Verified against records" body="Every mentor is matched to the alumni register, with a full audit trail.">
              <div className="mt-4 space-y-1.5 text-[11.5px]">
                {['Roll number', 'Graduation year', 'Department'].map((f) => (
                  <div key={f} className="flex items-center justify-between rounded-lg bg-ink-950/[0.04] px-2.5 py-1.5 text-ink-950/60">
                    {f} <Check size={12} className="text-brand-700" />
                  </div>
                ))}
              </div>
            </Bento>

            <Bento className="md:col-span-2" icon={Lock} title="Private by default" body="Contact details typed into messages are hidden before they’re saved.">
              <div className="mt-4 rounded-xl rounded-bl-sm bg-ink-950/[0.06] px-3 py-2 text-[12px] text-ink-950/70">
                Sure — mail me at <span className="rounded bg-brand-500/20 px-1 text-brand-800">[contact hidden]</span> 🙂
              </div>
            </Bento>

            <Bento className="md:col-span-2" icon={CalendarCheck2} title="Sessions, goals & feedback" body="Propose times, join by video, track action items, rate each session.">
              <div className="mt-4 space-y-1.5 text-[12px]">
                {[
                  ['Rewrite resume bullets', true],
                  ['Two mock interviews', true],
                  ['Ship portfolio README', false],
                ].map(([t, done]) => (
                  <div key={t as string} className="flex items-center gap-2 text-ink-950/65">
                    <span className={cx('flex h-4 w-4 items-center justify-center rounded', done ? 'bg-brand-500 text-white' : 'border border-ink-950/25')}>{done && <Check size={10} strokeWidth={3} />}</span>
                    <span className={done ? 'line-through decoration-ink-950/30' : ''}>{t as string}</span>
                  </div>
                ))}
              </div>
            </Bento>

            <Bento className="md:col-span-2" icon={BarChart3} title="Outcomes you can report" body="Participation, completion and placement correlation — no personal data.">
              <div className="mt-4 flex h-16 items-end gap-1.5">
                {[30, 46, 38, 58, 64, 80, 92].map((h, i) => (
                  <motion.span key={i} initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} transition={{ delay: 0.06 * i, duration: 0.6 }} className="w-full rounded-t bg-gradient-to-t from-brand-600 to-iris-400" />
                ))}
              </div>
            </Bento>
          </div>
        </div>
      </section>

      {/* ───────────────────────────── roles */}
      <section id="roles" className="relative overflow-hidden border-t border-ink-950/5 bg-gradient-to-b from-ink-50 to-ink-100">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-24 sm:px-6 lg:grid-cols-2">
          <div>
            <Reveal>
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-brand-700">Who it’s for</p>
              <h2 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[42px]">One programme, three very different needs.</h2>
            </Reveal>
            <div className="mt-8 inline-flex rounded-xl border border-ink-950/10 bg-ink-950/[0.04] p-1" role="tablist">
              {(Object.keys(ROLES) as (keyof typeof ROLES)[]).map((k) => {
                const Icon = ROLES[k].icon;
                return (
                  <button key={k} role="tab" aria-selected={role === k} onClick={() => setRole(k)} className={cx('relative flex items-center gap-2 rounded-lg px-4 py-2 text-[13.5px] font-medium transition-colors', role === k ? 'text-ink-50' : 'text-ink-950/60 hover:text-ink-950')}>
                    {role === k && <motion.span layoutId="role-tab" className="absolute inset-0 rounded-lg bg-ink-950" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                    <Icon size={15} className="relative" />
                    <span className="relative">{ROLES[k].label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={role} initial={{ opacity: 0, y: 16, rotateX: -8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ type: 'spring', stiffness: 220, damping: 24 }} style={{ transformPerspective: 1000 }}>
              <Tilt max={5} className="rounded-3xl">
                <div className="relative overflow-hidden rounded-3xl border border-ink-950/10 bg-gradient-to-br from-ink-950/[0.08] to-ink-950/[0.02] p-8 backdrop-blur-xl">
                  <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/25 blur-3xl" />
                  <h3 className="relative text-[24px] font-semibold tracking-[-0.02em]">{R.title}</h3>
                  <ul className="relative mt-6 space-y-4">
                    {R.points.map((p, i) => (
                      <motion.li key={p} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i + 0.1 }} className="flex gap-3 text-[15px] text-ink-950/75">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-brand-700 ring-1 ring-inset ring-brand-400/40">
                          <Check size={12} strokeWidth={3} />
                        </span>
                        {p}
                      </motion.li>
                    ))}
                  </ul>
                  <Link href={role === 'alumni' ? '/register?role=alumnus' : role === 'institution' ? '/login' : '/register?role=student'} className="relative mt-8 inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-800 hover:text-ink-950">
                    {role === 'institution' ? 'Staff sign in' : 'Get started'} <ArrowRight size={15} />
                  </Link>
                </div>
              </Tilt>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ───────────────────────────── how it works + stats */}
      <section id="how" className="relative bg-ink-100">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
          <Reveal>
            <h2 className="text-[34px] font-semibold tracking-[-0.035em] sm:text-[42px]">
              From hello to hired, <span className="font-serif font-normal italic text-ink-950/60">in three steps.</span>
            </h2>
          </Reveal>
          <div className="relative mt-14 grid gap-10 md:grid-cols-3">
            <motion.div aria-hidden className="absolute left-0 right-0 top-7 hidden h-px origin-left bg-gradient-to-r from-brand-400 via-iris-400 to-transparent md:block" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} />
            {[
              ['01', 'Get verified', 'Alumni confirm their identity against the institution’s records. Students describe their goals.'],
              ['02', 'Get matched', 'Students see mentors ranked by fit — with reasons — and only those with open capacity.'],
              ['03', 'Grow together', 'Book sessions, set goals, track actions and share feedback. Gentle nudges keep it alive.'],
            ].map(([n, t, d], i) => (
              <Reveal key={n} delay={0.2 + i * 0.18}>
                <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-iris-500 text-[17px] font-bold text-white shadow-glow">{n}</div>
                <h3 className="text-[19px] font-semibold tracking-[-0.01em]">{t}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-950/55">{d}</p>
              </Reveal>
            ))}
          </div>

          <div className="mt-20 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-ink-950/10 bg-ink-950/10 md:grid-cols-4">
            {[
              [60, '+', 'verified mentors'],
              [92, '%', 'session completion'],
              [79, '%', 'requests accepted'],
              [0, '', 'contact details leaked'],
            ].map(([v, s, l]) => (
              <div key={l as string} className="bg-ink-100 p-6 sm:p-8">
                <div className="text-[36px] font-semibold tracking-[-0.04em] sm:text-[44px]">
                  <CountUp value={v as number} />
                  {s as string}
                </div>
                <div className="mt-1 text-[13px] text-ink-950/50">{l as string}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────────── CTA + footer */}
      <section className="relative overflow-hidden bg-ink-50">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
          <Reveal>
            <Tilt className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-brand-600 via-brand-700 to-iris-600 p-10 text-center text-white shadow-2xl sm:p-16" max={4}>
              <div aria-hidden className="absolute -left-20 -top-20 h-72 w-72 animate-aurora rounded-full bg-white/20 blur-3xl" />
              <h2 className="relative text-[34px] font-semibold tracking-[-0.035em] sm:text-[48px]" style={{ transform: 'translateZ(40px)' }}>
                Give an hour. <span className="font-serif font-normal italic">Change a career.</span>
              </h2>
              <p className="relative mx-auto mt-3 max-w-xl text-[16px] text-white/80" style={{ transform: 'translateZ(24px)' }}>
                Join as a student to find guidance, or as an alumnus to give back — on your terms.
              </p>
              <div className="relative mt-9 flex flex-wrap justify-center gap-3" style={{ transform: 'translateZ(50px)' }}>
                <StarBorder as={Link} href="/register" color="#ffffff" backgroundColor="#ffffff" textColor="#151c27" radius={12} theme="light" className="text-[15px] font-semibold">
                  Create your account <ArrowRight size={16} />
                </StarBorder>
                <Link href="/login" className="btn border border-white/30 px-6 py-3.5 text-[15px] text-white hover:bg-white/10">
                  Sign in
                </Link>
              </div>
            </Tilt>
          </Reveal>
        </div>
        <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-ink-950/5 px-5 py-8 text-[13px] text-ink-950/45 sm:px-6">
          <span className="flex items-center gap-2">
            <LogoMark size={22} /> © {new Date().getFullYear()} Alumni Mentor Network
          </span>
          <span className="flex gap-5">
            <Link href="/privacy" className="hover:text-ink-950">Privacy statement</Link>
            <a href="https://reactbits.dev" target="_blank" rel="noopener noreferrer" className="hover:text-ink-950">UI components: React Bits</a>
          </span>
        </footer>
      </section>
    </div>
  );
}

function Floating({ children, className, delay }: { children: React.ReactNode; className: string; delay: number }) {
  return (
    <motion.div
      className={`glass absolute px-3.5 py-3 ${className}`}
      initial={{ opacity: 0, scale: 0.7, rotateY: 25 }}
      animate={{ opacity: 1, scale: 1, rotateY: 0, y: [0, -9, 0] }}
      transition={{ opacity: { delay }, scale: { delay, type: 'spring' }, rotateY: { delay }, y: { delay, repeat: Infinity, duration: 5 + delay, ease: 'easeInOut' } }}
      style={{ transformPerspective: 600 }}
    >
      {children}
    </motion.div>
  );
}

function Bento({ className = '', icon: Icon, title, body, children }: { className?: string; icon: React.ComponentType<{ size?: number; className?: string }>; title: string; body: string; children?: React.ReactNode }) {
  return (
    <Reveal className={className}>
      <SpotlightCard theme={useTheme().theme} spotlightColor="#41bfa2" intensity={0.22} className="h-full !rounded-3xl !p-6">
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400/25 to-iris-500/25 text-brand-800 ring-1 ring-inset ring-ink-950/10">
          <Icon size={17} />
        </div>
        <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-950/55">{body}</p>
        {children}
      </SpotlightCard>
    </Reveal>
  );
}
