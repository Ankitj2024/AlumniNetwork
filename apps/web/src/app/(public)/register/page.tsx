'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ErrorBox, Field, Spinner, cx } from '@/components/ui';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthFrame } from '@/components/AuthFrame';
import { GoogleButton } from '@/components/GoogleButton';
import { motion } from 'framer-motion';

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [role, setRole] = useState<'student' | 'alumnus'>(params.get('role') === 'alumnus' ? 'alumnus' : 'student');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await post('/auth/register', { ...form, phone: form.phone || undefined, role });
      await refresh();
      router.replace(role === 'student' ? '/student/profile?welcome=1' : '/mentor/profile?welcome=1');
    } catch (err: any) {
      setError(err.message);
      setFieldErrors(err.details?.fieldErrors ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1">
        {(['student', 'alumnus'] as const).map((r) => (
          <button type="button" key={r} onClick={() => setRole(r)} className={cx('relative rounded-lg py-2 text-sm font-semibold transition-colors', role === r ? 'text-ink-900' : 'text-ink-500 hover:text-ink-700')}>
            {role === r && <motion.span layoutId="role-pill" className="absolute inset-0 rounded-lg bg-surface shadow-card" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
            <span className="relative">{r === 'student' ? 'Student' : 'Alumnus / mentor'}</span>
          </button>
        ))}
      </div>
      <GoogleButton role={role} label={role === 'student' ? 'Sign up with Google' : 'Sign up with Google as alumnus'} />
      {role === 'alumnus' && <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">After signing up you&apos;ll verify your alumni status against institutional records. Students can only find you once you&apos;re verified, and you choose how many mentees to take.</p>}
      <ErrorBox message={error} />
      <Field label="Full name" error={fieldErrors.name?.[0]}>
        <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
      </Field>
      <Field label="Email" error={fieldErrors.email?.[0]}>
        <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
      </Field>
      <Field label="Password" hint="At least 8 characters with a letter and a number" error={fieldErrors.password?.[0]}>
        <input className="input" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
      </Field>
      <Field label="Mobile (optional)" hint="Only used for session reminders by SMS if you opt in. Never shown to anyone.">
        <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
      </Field>
      <button className="btn-primary w-full py-2.5" disabled={busy}>
        {busy && <Spinner />} Create account
      </button>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <AuthFrame title="Create your account" subtitle="Join as a student looking for guidance, or as an alumnus ready to give it." footer={<>Already have an account? <Link className="font-semibold text-brand-700 hover:text-brand-800" href="/login">Sign in</Link></>}>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthFrame>
  );
}
