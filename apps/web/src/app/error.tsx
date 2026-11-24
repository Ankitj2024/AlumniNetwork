'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { LogoMark } from '@/components/Logo';

/** Shown when a page throws. Offers a retry and a way home; never shows the error to visitors. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-5 py-20 text-center">
      <LogoMark size={44} />
      <h1 className="mt-6 text-[32px] font-semibold tracking-[-0.035em]">Something went wrong.</h1>
      <p className="mt-3 max-w-md text-[16px] text-ink-500">Please try again. If it keeps happening, let us know and we’ll look into it.{error.digest ? ` Reference: ${error.digest}` : ''}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button className="btn-primary px-5 py-2.5" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="btn-secondary px-5 py-2.5">
          Go home
        </Link>
      </div>
    </main>
  );
}
