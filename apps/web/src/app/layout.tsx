import type { Metadata, Viewport } from 'next';
import { Geist, Instrument_Serif } from 'next/font/google';
import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/lib/auth';
import { CommandPalette } from '@/components/CommandPalette';
import { MotionProvider } from '@/components/MotionProvider';
import './globals.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Alumni Mentor Network', template: '%s · Alumni Mentor Network' },
  description: 'Verified alumni mentorship matching and engagement platform.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#13836e' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <MotionProvider>
        <AuthProvider>
          <ToastProvider>
            {children}
            <CommandPalette />
          </ToastProvider>
        </AuthProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
