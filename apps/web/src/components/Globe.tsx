'use client';
import dynamic from 'next/dynamic';

/** Client-only, lazily loaded 3D globe (Three.js stays out of the initial bundle). */
export const Globe = dynamic(() => import('./three/NetworkGlobe'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-full bg-gradient-to-br from-brand-500/10 to-iris-500/10" />,
});
