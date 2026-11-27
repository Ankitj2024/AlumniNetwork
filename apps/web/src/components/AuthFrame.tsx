'use client';
import { motion } from 'framer-motion';
import { LogoMark } from './Logo';

/**
 * Sign-in pages (login, register, password reset, email verification): the public navbar, then one
 * calm, centred card, in the spirit of an Apple ID page.
 */
export function AuthFrame({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="min-h-screen text-ink-900">
      <main className="mx-auto flex w-full max-w-[440px] flex-col items-center px-5 pb-16 pt-10 sm:pt-16">
        <motion.div className="w-full" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <div className="text-center">
            <LogoMark size={44} className="mx-auto" />
            <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.035em] sm:text-[32px]">{title}</h1>
            {subtitle && <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-ink-500">{subtitle}</p>}
          </div>
          <div className="card mt-8 p-6 sm:p-8">{children}</div>
        </motion.div>
        {footer && <p className="mt-7 text-center text-[14px] text-ink-500">{footer}</p>}
      </main>
    </div>
  );
}
