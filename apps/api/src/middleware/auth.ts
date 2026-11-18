import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError, forbidden, unauthorized } from '../lib/errors.js';
import { User, type Role } from '../models/index.js';
import type { Viewer } from '../serializers/index.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      viewer?: Viewer;
    }
  }
}

export const STAFF_ROLES: ReadonlySet<Role> = new Set<Role>(['aro', 'admin', 'placement']);

/**
 * Session tokens carry the user's tokenVersion (`v`). Bumping the version on the user (password
 * reset/change, two-factor changes) invalidates every session issued before it. Tokens without
 * `v` count as version 0, so sessions issued before this field existed keep working.
 */
export function signToken(userId: string, role: Role, version = 0): string {
  return jwt.sign({ sub: userId, role, v: version }, env.jwtSecret, { expiresIn: env.jwtTtl as jwt.SignOptions['expiresIn'] });
}

/** A session token for a user document. */
export const sessionToken = (u: { _id: unknown; role: string; tokenVersion?: number | null }) => signToken(String(u._id), u.role as Role, u.tokenVersion ?? 0);

export function readToken(req: { headers: Record<string, any>; cookies?: Record<string, string> }): string | null {
  const h = req.headers.authorization;
  if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7);
  return req.cookies?.[env.cookieName] ?? null;
}

export async function viewerFromToken(token: string | null): Promise<Viewer | null> {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string; v?: number; purpose?: string };
    if (payload.purpose) return null; // e.g. a two-factor challenge: never a session
    const u = await User.findById(payload.sub).select('+email +phone').lean();
    if (!u || u.status !== 'active') return null;
    if ((payload.v ?? 0) !== (u.tokenVersion ?? 0)) return null; // signed out everywhere since this token was issued
    return { id: String(u._id), role: u.role as Role, email: u.email, phone: u.phone ?? undefined, emailVerified: !!u.emailVerifiedAt, mfaEnabled: !!u.mfaEnabled };
  } catch {
    return null;
  }
}

export async function attachViewer(req: Request, _res: Response, next: NextFunction) {
  try {
    const v = await viewerFromToken(readToken(req));
    if (v) req.viewer = v;
    next();
  } catch (e) {
    next(e);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.viewer) return next(unauthorized());
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.viewer) return next(unauthorized());
    if (!roles.includes(req.viewer.role)) return next(forbidden());
    next();
  };
}

/** For actions that need a confirmed email (sending mentorship requests, submitting alumni verification). */
export function requireVerifiedEmail(req: Request, _res: Response, next: NextFunction) {
  if (!req.viewer) return next(unauthorized());
  if (env.requireEmailVerification && !req.viewer.emailVerified) {
    return next(new HttpError(403, 'email_unverified', 'Please confirm your email address first. We sent you a link, and you can send it again from the banner at the top of the page.'));
  }
  next();
}

/**
 * With REQUIRE_STAFF_2FA on, staff who haven't turned on two-factor sign-in can only reach the
 * account endpoints (to set it up). Everything else answers 403 mfa_setup_required.
 */
export function enforceStaffMfa(req: Request, _res: Response, next: NextFunction) {
  const v = req.viewer;
  if (v && env.requireStaff2fa && STAFF_ROLES.has(v.role) && !v.mfaEnabled && !req.path.startsWith('/api/auth/') && req.path !== '/api/health') {
    return next(new HttpError(403, 'mfa_setup_required', 'Turn on two-factor sign-in to continue. It is required for staff accounts.'));
  }
  next();
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}
