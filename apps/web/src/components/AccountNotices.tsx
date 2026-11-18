'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, MailCheck, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { LogoMark } from './Logo';
import { TwoFactorSetup } from './TwoFactorSetup';
import { Spinner, useToast } from './ui';

/** Reminds users to confirm their email; some actions wait for it. Dismissable for the session. */
export function EmailBanner() {
  const { me } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (!me || me.security?.emailVerified !== false || hidden) return null;

  async function resend() {
    setBusy(true);
    try {
      const r = await post<{ alreadyVerified?: boolean }>('/auth/resend-verification');
      toast(r.alreadyVerified ? 'Your email is already confirmed' : `Link sent to ${me!.user.email}`);
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-amber-50 px-4 py-3 text-[13.5px] text-amber-950 ring-1 ring-inset ring-amber-200" role="status">
        <MailCheck size={17} className="shrink-0 text-amber-700" />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">Confirm your email.</span> We sent a link to <span className="font-medium">{me.user.email}</span>.
          {me.security.emailVerificationRequired && <> You’ll need it before {me.user.role === 'alumnus' ? 'submitting your alumni verification' : 'sending mentorship requests'}.</>}
        </p>
        <button className="btn-secondary px-3 py-1.5 text-[12.5px]" onClick={resend} disabled={busy}>
          {busy && <Spinner />} Send again
        </button>
        <button className="btn-ghost p-1.5 text-amber-800" onClick={() => setHidden(true)} aria-label="Hide for now">
          <X size={15} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

/** Staff accounts on servers that require it must set up two-factor sign-in before anything else. */
export function StaffMfaGate() {
  const { me, refresh, logout } = useAuth();
  return (
    <div className="mx-auto max-w-xl py-6">
      <div className="mb-6 flex items-center gap-3">
        <LogoMark size={40} />
        <div>
          <p className="eyebrow">One more step</p>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Protect your staff account</h1>
        </div>
      </div>
      <div className="card p-6">
        <div className="mb-5 flex items-start gap-3 rounded-xl bg-brand-50 px-4 py-3 text-[13.5px] text-brand-900 ring-1 ring-inset ring-brand-200">
          <ShieldCheck size={17} className="mt-0.5 shrink-0" />
          <p>
            Staff accounts can see alumni identity documents and contact details, so this programme requires <strong>two-factor sign-in</strong>. It takes about a minute.
          </p>
        </div>
        <TwoFactorSetup onComplete={() => void refresh()} />
      </div>
      <button className="btn-ghost mt-4 text-[13px] text-ink-500" onClick={logout}>
        <LogOut size={14} /> Sign out ({me?.user.email})
      </button>
    </div>
  );
}
