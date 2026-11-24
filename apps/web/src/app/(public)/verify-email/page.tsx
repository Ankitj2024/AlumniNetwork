'use client';
import { CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { AuthFrame } from '@/components/AuthFrame';
import { Spinner } from '@/components/ui';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { homeFor } from '@/lib/format';

function Confirm() {
  const params = useSearchParams();
  const { me, refresh } = useAuth();
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const [message, setMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // the link is single-use: never post it twice (React strict mode runs effects twice)
    started.current = true;
    const token = params.get('token');
    window.history.replaceState(null, '', '/verify-email');
    if (!token) {
      setState('failed');
      setMessage('This page needs the link from your email.');
      return;
    }
    post('/auth/verify-email', { token })
      .then(async () => {
        setState('done');
        await refresh();
      })
      .catch((e) => {
        setState('failed');
        setMessage(e.message);
      });
  }, [params, refresh]);

  if (state === 'working') {
    return (
      <p className="flex items-center gap-2 text-[13.5px] text-ink-600">
        <Spinner /> Confirming your email…
      </p>
    );
  }
  if (state === 'done') {
    return (
      <div className="text-[13.5px] text-ink-600">
        <CheckCircle2 size={36} className="text-ok-500" />
        <p className="mt-3">Thanks, your email is confirmed. You now have full access.</p>
        <Link href={me ? homeFor(me.user.role) : '/login'} className="btn-primary mt-5 inline-flex">
          {me ? 'Continue' : 'Sign in'}
        </Link>
      </div>
    );
  }
  return (
    <div className="text-[13.5px] text-ink-600">
      <XCircle size={36} className="text-red-500" />
      <p className="mt-3">{message}</p>
      <p className="mt-2 text-ink-500">Sign in and use “Send again” on the banner to get a fresh link.</p>
      <Link href={me ? homeFor(me.user.role) : '/login'} className="btn-primary mt-5 inline-flex">
        {me ? 'Go to the app' : 'Sign in'}
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthFrame title="Confirm your email">
      <Suspense>
        <Confirm />
      </Suspense>
    </AuthFrame>
  );
}
