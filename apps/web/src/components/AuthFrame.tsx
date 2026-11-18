'use client';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { Globe } from './Globe';
import { Logo } from './Logo';
import { Aurora } from './motion';
import ShinyText from './reactbits/ShinyText';

/** Split-screen auth: the 3D alumni network and value props on the left, a calm, focused form on the right. */
export function AuthFrame({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950 text-white">
      <Aurora dark />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.03)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_30%_50%,black_20%,transparent_70%)]" />
      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-5 py-10 lg:grid-cols-[1fr_440px]">
        <div className="hidden lg:block">
          <Link href="/" className="mb-10 inline-flex" aria-label="Alumni Mentor Network home">
            <Logo size={36} />
          </Link>
          <div className="relative mx-auto aspect-square w-full max-w-[420px]">
            <div className="absolute inset-[16%] rounded-full bg-brand-500/20 blur-3xl" aria-hidden />
            <Globe className="absolute inset-0" />
          </div>
          <div className="mt-6 max-w-md">
            <ShinyText text="Verified alumni. Protected time. Mentoring that lasts." color="rgba(255,255,255,.75)" shineColor="#ffffff" speed={3.5} className="text-[18px] font-medium tracking-[-0.01em]" />
            <ul className="mt-4 space-y-2 text-[13.5px] text-white/55">
              {['Every mentor verified against institutional records', 'Your email and phone are never shown to other users', 'Mentors set their own limits — requests always get answered'].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Check size={15} className="mt-0.5 shrink-0 text-brand-300" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <Link href="/" className="mb-7 flex lg:hidden" aria-label="Alumni Mentor Network home">
            <Logo size={36} />
          </Link>
          <motion.div className="w-full" initial={{ opacity: 0, y: 24, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ type: 'spring', stiffness: 140, damping: 20 }} style={{ transformPerspective: 1200 }}>
            <div className="relative rounded-[24px] bg-gradient-to-b from-white/25 to-white/5 p-px shadow-[0_40px_100px_-30px_rgba(0,0,0,.8)]">
              <div className="rounded-[23px] bg-white p-7 text-ink-900 sm:p-8">
                <h1 className="text-[24px] font-semibold tracking-[-0.03em]">{title}</h1>
                {subtitle && <p className="mt-1 text-[13.5px] text-ink-500">{subtitle}</p>}
                <div className="mt-6">{children}</div>
              </div>
            </div>
          </motion.div>
          {footer && <p className="mt-6 text-[13.5px] text-white/65">{footer}</p>}
        </div>
      </div>
    </div>
  );
}

