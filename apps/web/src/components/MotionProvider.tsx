'use client';
import { MotionConfig } from 'framer-motion';

/** Makes every Framer Motion animation in the app honour the OS "reduce motion" setting. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
