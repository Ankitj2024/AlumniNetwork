'use client';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AuthFrame } from '@/components/AuthFrame';
import { ErrorBox, Field, Spinner } from '@/components/ui';
import { post } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title={sent ? 'Check your email' : 'Reset your password'}
      subtitle={sent ? undefined : 'We’ll email you a link to choose a new one.'}
      footer={
        <>
          Remembered it?{' '}
          <Link className="font-semibold text-brand-700 hover:text-brand-800" href="/login">
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="text-[13.5px] text-ink-600">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <MailCheck size={22} />
          </div>
          <p>
            If an account exists for <span className="font-medium text-ink-900">{email}</span>, a reset link is on its way. It works for 30 minutes.
          </p>
          <p className="mt-3 text-ink-500">Nothing arrived after a few minutes? Check your spam folder, or make sure you used the email you signed up with.</p>
          <button className="btn-secondary mt-5" onClick={() => setSent(false)}>
            Try a different email
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <ErrorBox message={error} />
          <Field label="Email">
            <input className="input" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <button className="btn-primary w-full py-2.5" disabled={busy}>
            {busy && <Spinner />} Send reset link
          </button>
        </form>
      )}
    </AuthFrame>
  );
}
