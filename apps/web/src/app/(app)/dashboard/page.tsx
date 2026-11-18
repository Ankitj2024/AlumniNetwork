'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageLoader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { homeFor } from '@/lib/format';

export default function DashboardRedirect() {
  const { me } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (me) router.replace(homeFor(me.user.role));
  }, [me, router]);
  return <PageLoader />;
}
