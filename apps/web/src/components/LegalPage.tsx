import { SiteFooter } from './SiteFooter';

/** Layout for legal and info pages: big title, last-updated line, readable column, footer. */
export function LegalPage({ title, updated, intro, children }: { title: string; updated?: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <main className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-20">
        <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[52px]">{title}</h1>
        {updated && <p className="mt-3 text-[14px] text-ink-400">Last updated {updated}</p>}
        {intro && <div className="mt-6 text-[17px] leading-relaxed text-ink-600">{intro}</div>}
        <div className="legal mt-10">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
