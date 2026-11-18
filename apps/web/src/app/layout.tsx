import type { Metadata, Viewport } from 'next';
import { Geist, Instrument_Serif } from 'next/font/google';
import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/lib/auth';
import { CommandPalette } from '@/components/CommandPalette';
import { MotionProvider } from '@/components/MotionProvider';
import { THEME_SCRIPT, ThemeProvider } from '@/lib/theme';
import './globals.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Alumni Mentor Network', template: '%s · Alumni Mentor Network' },
  description: 'Verified alumni mentorship matching and engagement platform.',
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0f1a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The head script sets the `dark` class before React hydrates, hence suppressHydrationWarning.
    <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <MotionProvider>
            <AuthProvider>
              <ToastProvider>
                {children}
                <CommandPalette />
              </ToastProvider>
            </AuthProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
