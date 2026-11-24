import { SiteHeader } from '@/components/SiteHeader';

/**
 * Public pages (home, sign-in, legal). The navbar is mounted once here, so it stays put between
 * pages and the gooey pill animates from one page's item to the next instead of restarting.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
