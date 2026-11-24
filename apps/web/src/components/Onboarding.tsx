'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CalendarCheck2, CheckCircle2, Gauge, Inbox, Lock, Scissors, Send, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { patch, put } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AREA_LABELS } from '@/lib/format';
import { LogoMark } from './Logo';
import { ChipToggle, Spinner, cx, useToast } from './ui';

/**
 * First-run onboarding for new students and alumni, in the spirit of Apple's setup assistant.
 * Shown only while the server says `needsOnboarding` (set on sign-up, never on older accounts) and
 * cleared for good when it's finished or skipped, so it appears once per account on any device.
 * Answers on the "aim" / "help" step are saved straight to the profile.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

type Row = { icon: LucideIcon; title: string; body: string };

function Rows({ rows }: { rows: Row[] }) {
  return (
    <ul className="mt-8 space-y-5 text-left">
      {rows.map((r) => (
        <li key={r.title} className="flex gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <r.icon size={19} />
          </span>
          <span>
            <span className="block text-[15px] font-semibold tracking-[-0.01em]">{r.title}</span>
            <span className="mt-0.5 block text-[14px] leading-relaxed text-ink-500">{r.body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const AREAS = Object.entries(AREA_LABELS).map(([value, label]) => ({ value, label }));

export function Onboarding() {
  const { me, refresh } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState('');
  const [headline, setHeadline] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const primary = useRef<HTMLButtonElement>(null);

  const isMentor = me?.user.role === 'alumnus';
  const first = me?.user.name.split(' ')[0] ?? 'there';
  const total = 4;

  // Keep the page behind still, and keep focus inside the flow.
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  useEffect(() => {
    primary.current?.focus();
  }, [step]);

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setStep(to);
  };

  /** Save what was entered on the aim/help step (only what was filled in). */
  async function saveAnswers() {
    if (isMentor) {
      const body: Record<string, unknown> = {};
      if (headline.trim()) body.headline = headline.trim();
      if (areas.length) body.mentoringAreas = areas;
      if (Object.keys(body).length) await put('/alumni/me', body);
    } else {
      const body: Record<string, unknown> = {};
      if (role.trim().length >= 2) body.targetRoles = [role.trim()];
      if (areas.length) body.mentoringAreasWanted = areas;
      if (Object.keys(body).length) await put('/students/me', body);
    }
  }

  async function next() {
    if (step === 2) {
      setBusy(true);
      try {
        await saveAnswers();
      } catch (e: any) {
        toast(e.message ?? 'Couldn’t save that — you can add it on your profile later.', 'err');
      } finally {
        setBusy(false);
      }
    }
    go(step + 1);
  }

  /** Mark onboarding done (once, for good) and optionally move on to a page. */
  async function finish(href?: string) {
    setBusy(true);
    try {
      await patch('/auth/me', { onboarded: true });
    } catch {
      /* if this fails it simply shows again next time */
    }
    await refresh();
    setBusy(false);
    if (href) router.push(href);
  }

  const steps = isMentor
    ? [
        {
          head: <LogoMark size={64} className="mx-auto" />,
          title: `Welcome, ${first}.`,
          sub: 'Thank you for giving back. Here’s how mentoring works here.',
          body: (
            <Rows
              rows={[
                { icon: Gauge, title: 'You set the limits', body: 'Choose how many mentees and open requests you take, and pause any time.' },
                { icon: Inbox, title: 'Saying no is easy', body: 'Decline in one click — the student is kindly pointed to other mentors.' },
                { icon: Lock, title: 'Your contact details stay private', body: 'Students never see your email, phone or LinkedIn.' },
              ]}
            />
          ),
        },
        {
          head: <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600"><ShieldCheck size={30} /></span>,
          title: 'First, get verified',
          sub: 'Students can find you once your alumni status is confirmed against the institution’s records.',
          body: (
            <Rows
              rows={[
                { icon: Users, title: 'Tell us who you are', body: 'Your roll number, programme and graduation year — about two minutes.' },
                { icon: ShieldCheck, title: 'We match it to the register', body: 'Exact matches are approved straight away; anything else is reviewed by Alumni Relations.' },
                { icon: CheckCircle2, title: 'You appear to students', body: 'Once verified, you show up in matches with a verified badge.' },
              ]}
            />
          ),
        },
        {
          head: null,
          title: 'How would you like to help?',
          sub: 'Students see this first. You can change it any time.',
          body: (
            <div className="mt-8 space-y-6 text-left">
              <label className="block">
                <span className="label">Your headline</span>
                <input className="input" value={headline} maxLength={140} onChange={(e) => setHeadline(e.target.value)} placeholder="Senior Data Scientist at Quantia AI" />
              </label>
              <div>
                <span className="label">I can help with</span>
                <ChipToggle options={AREAS} value={areas} onChange={setAreas} />
              </div>
            </div>
          ),
        },
        {
          head: <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ok-50 text-ok-600"><CheckCircle2 size={34} /></span>,
          title: 'You’re ready.',
          sub: 'Start your verification now — then set how many mentees you’d like to take.',
          body: null,
        },
      ]
    : [
        {
          head: <LogoMark size={64} className="mx-auto" />,
          title: `Welcome, ${first}.`,
          sub: 'Let’s get you set up. It takes about a minute.',
          body: (
            <Rows
              rows={[
                { icon: ShieldCheck, title: 'Verified mentors', body: 'Every mentor is checked against the institution’s alumni records.' },
                { icon: Users, title: 'Mentors with time for you', body: 'You only see alumni who can take someone on, so requests get answered.' },
                { icon: Lock, title: 'Private by default', body: 'Your email and phone are never shown to mentors.' },
              ]}
            />
          ),
        },
        {
          head: null,
          title: 'How it works',
          sub: 'Three steps from hello to your first session.',
          body: (
            <Rows
              rows={[
                { icon: Send, title: 'Request a mentor', body: 'Send a short note to a mentor who fits. They have seven days to reply.' },
                { icon: CalendarCheck2, title: 'Book a session', body: 'Pick a time together. Once it’s confirmed, you get a session pass.' },
                { icon: Scissors, title: 'Tear to join', body: 'When it’s time, tear the pass and you’re straight into the video call.' },
              ]}
            />
          ),
        },
        {
          head: null,
          title: 'What are you aiming for?',
          sub: 'This shapes the mentors we suggest. You can change it any time.',
          body: (
            <div className="mt-8 space-y-6 text-left">
              <label className="block">
                <span className="label">A role you’re working towards</span>
                <input className="input" value={role} maxLength={80} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Data Scientist" />
              </label>
              <div>
                <span className="label">Help you’d like (pick up to 3)</span>
                <ChipToggle options={AREAS} value={areas} onChange={setAreas} max={3} />
              </div>
            </div>
          ),
        },
        {
          head: <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ok-50 text-ok-600"><CheckCircle2 size={34} /></span>,
          title: 'You’re all set.',
          sub: 'Your best matches are ready. Adding a few interests to your profile makes them even better.',
          body: null,
        },
      ];

  const s = steps[step];
  const last = step === total - 1;

  return (
    <motion.div className="fixed inset-0 z-[80] flex flex-col bg-canvas" role="dialog" aria-modal="true" aria-label="Welcome to Alumni Mentor Network" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
      {/* progress */}
      <div className="h-1 w-full bg-ink-900/[0.06]">
        <motion.div className="h-full bg-brand-600" animate={{ width: `${((step + 1) / total) * 100}%` }} transition={{ duration: 0.5, ease: EASE }} />
      </div>
      <div className="flex h-14 shrink-0 items-center justify-between px-4 sm:px-6">
        {step > 0 && !last ? (
          <button className="btn-ghost -ml-2 gap-1.5 px-3 text-[13.5px]" onClick={() => go(step - 1)}>
            <ArrowLeft size={15} /> Back
          </button>
        ) : (
          <span />
        )}
        {!last && (
          <button className="btn-ghost px-3 text-[13.5px] text-ink-500" onClick={() => finish()} disabled={busy}>
            Skip for now
          </button>
        )}
      </div>

      <div className="flex flex-1 items-start justify-center overflow-y-auto px-5 pb-10 sm:items-center">
        <div className="w-full max-w-[480px]">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -28 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="text-center"
            >
              {s.head && <div className="mb-7">{s.head}</div>}
              <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[36px]">{s.title}</h1>
              <p className="mx-auto mt-3 max-w-md text-[16px] leading-relaxed text-ink-500">{s.sub}</p>
              {s.body}
            </motion.div>
          </AnimatePresence>

          <div className="mt-10 flex flex-col items-center gap-3">
            {last ? (
              <>
                <button ref={primary} className="btn-primary w-full max-w-xs py-3 text-[15px]" onClick={() => finish(isMentor ? '/mentor/profile' : '/mentors')} disabled={busy}>
                  {busy && <Spinner />} {isMentor ? 'Start verification' : 'See my matches'}
                </button>
                <button className="btn-ghost text-[14px]" onClick={() => finish(isMentor ? '/mentor/availability' : '/student/profile')} disabled={busy}>
                  {isMentor ? 'Set my capacity first' : 'Finish my profile first'}
                </button>
              </>
            ) : (
              <button ref={primary} className="btn-primary w-full max-w-xs py-3 text-[15px]" onClick={next} disabled={busy}>
                {busy && <Spinner />} {step === 0 ? 'Get started' : 'Continue'}
              </button>
            )}
            <div className="mt-3 flex gap-1.5" aria-hidden>
              {Array.from({ length: total }).map((_, i) => (
                <span key={i} className={cx('h-1.5 rounded-full transition-all duration-300', i === step ? 'w-5 bg-ink-900' : 'w-1.5 bg-ink-900/20')} />
              ))}
            </div>
            <span className="sr-only">
              Step {step + 1} of {total}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
