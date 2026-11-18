import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const API = process.env.API_URL ?? 'http://localhost:4000';
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: repoRoot,
  poweredByHeader: false,
  // Same-origin API: the browser talks to /api on the web origin, Next proxies to the API server.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
