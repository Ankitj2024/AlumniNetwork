'use client';
import { useEffect, useState } from 'react';

/** "Continue with Google". Hidden-state aware: shows a hint when the server has no Google credentials yet. */
export function GoogleButton({ role, next, label = 'Continue with Google' }: { role: 'student' | 'alumnus'; next?: string | null; label?: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/auth/providers', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setEnabled(!!d.google))
      .catch(() => setEnabled(false));
  }, []);
  const q = new URLSearchParams({ role });
  if (next && next.startsWith('/') && !next.startsWith('//')) q.set('next', next);
  const href = `/api/auth/google/start?${q}`;

  const icon = (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );

  const cls = 'btn w-full border border-ink-200 bg-white text-ink-800 shadow-sm hover:-translate-y-0.5 hover:shadow-md';
  if (enabled === false) {
    return (
      <div>
        <button type="button" disabled className={cls} title="Google sign-in is not configured on this server">
          {icon} {label}
        </button>
        <p className="mt-1.5 text-center text-[11px] text-ink-400">Google sign-in becomes available once the administrator adds Google credentials (README §4.4).</p>
      </div>
    );
  }
  return (
    <a href={href} className={cls} aria-disabled={enabled === null}>
      {icon} {label}
    </a>
  );
}

export const GOOGLE_ERRORS: Record<string, string> = {
  google_not_configured: 'Google sign-in is not configured on this server yet. Use email and password for now.',
  google_cancelled: 'Google sign-in was cancelled.',
  invalid_state: 'That sign-in link expired or was already used. Please try again.',
  invalid_token: 'Google could not confirm your sign-in. Please try again.',
  token_exchange_failed: 'Google could not confirm your sign-in. Please try again.',
  email_not_verified: 'Your Google account email is not verified. Verify it with Google, or sign up with email.',
  student_domain_required: 'Students must sign in with their institution Google account.',
  suspended: 'This account is suspended. Contact the alumni relations office.',
  google_failed: 'Google sign-in failed. Please try again.',
};

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-ink-400">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-ink-200" />
      or
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-ink-200" />
    </div>
  );
}
