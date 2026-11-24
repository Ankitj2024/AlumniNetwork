import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/** Public pages are indexable; the signed-in app, the API and one-time links are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', '/analytics', '/dashboard', '/demo', '/mentor', '/mentors', '/mentorships', '/notifications', '/payments', '/settings', '/student', '/reset-password', '/verify-email'],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
