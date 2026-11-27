import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/lib/auth';
import { CommandPalette } from '@/components/CommandPalette';
import { IntroSplash } from '@/components/IntroSplash';
import { MotionProvider } from '@/components/MotionProvider';
import { INTRO_SCRIPT, THEME_SCRIPT } from '@/lib/headScripts';
import { SITE } from '@/lib/site';
import { ThemeProvider } from '@/lib/theme';
import './globals.css';

/** Fallback for devices without San Francisco (see tailwind.config.ts). */
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: 'Alumni Mentor Network — mentoring that respects everyone’s time', template: '%s · Alumni Mentor Network' },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: { type: 'website', siteName: SITE.name, title: 'Alumni Mentor Network', description: SITE.description, url: '/', locale: 'en_IN' },
  twitter: { card: 'summary_large_image', title: 'Alumni Mentor Network', description: SITE.description },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e4eefc' },
    { media: '(prefers-color-scheme: dark)', color: '#06162f' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The head scripts set the `dark` class and the first-visit flag before React hydrates,
    // hence suppressHydrationWarning.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT + INTRO_SCRIPT }} />
      </head>
      <body>
        <div className="intro-cover" aria-hidden />
        <ThemeProvider>
          <MotionProvider>
            <AuthProvider>
              <ToastProvider>
                {children}
                <CommandPalette />
                <IntroSplash />
              </ToastProvider>
            </AuthProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
