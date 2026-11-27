import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-5 py-20 text-center">
        <p className="text-[15px] font-semibold text-ink-400">404</p>
        <h1 className="mt-2 text-[40px] font-semibold leading-[1.05] tracking-[-0.04em]">This page doesn’t exist.</h1>
        <p className="mt-3 text-[17px] text-ink-500">The link may be old, or the address mistyped.</p>
        <Link href="/" className="btn-primary mt-8 px-6 py-2.5 text-[15px]">
          Back to the home page
        </Link>
      </main>
    </div>
  );
}
