import { env } from '../config/env.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { AuthToken } from '../models/index.js';
import { sendEmail } from './channels.js';

/**
 * One-time links for password reset, email confirmation and admin invites.
 * The raw token only ever exists in the email; the database keeps its SHA-256 hash.
 */
export type TokenPurpose = 'password_reset' | 'email_verify';

const TTL_MS: Record<TokenPurpose, number> = {
  password_reset: 30 * 60 * 1000, // 30 minutes
  email_verify: 48 * 60 * 60 * 1000, // 48 hours
};
export const INVITE_TTL_MS = 72 * 60 * 60 * 1000; // first-admin / staff invite links

/** Issues a new link and retires any earlier unused one for the same purpose. */
export async function issueToken(userId: unknown, purpose: TokenPurpose, ttlMs = TTL_MS[purpose]): Promise<string> {
  const now = new Date();
  await AuthToken.updateMany({ user: userId, purpose, usedAt: null }, { $set: { usedAt: now } });
  const raw = randomToken();
  await AuthToken.create({ user: userId, purpose, tokenHash: sha256(raw), expiresAt: new Date(now.getTime() + ttlMs) });
  return raw;
}

/** Atomically marks a valid link as used and returns it, or null if it's unknown, used or expired. */
export async function consumeToken(raw: string, purpose: TokenPurpose) {
  return AuthToken.findOneAndUpdate(
    { tokenHash: sha256(raw), purpose, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true },
  ).lean();
}

/** How many links of this kind were issued to the user recently (for throttling emails). */
export async function recentTokenCount(userId: unknown, purpose: TokenPurpose, withinMs = 60 * 60 * 1000) {
  return AuthToken.countDocuments({ user: userId, purpose, createdAt: { $gt: new Date(Date.now() - withinMs) } });
}

const firstName = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] || 'there';

export async function sendVerificationEmail(user: { _id: unknown; name?: string | null; email?: string | null }) {
  if (!user.email) return;
  const token = await issueToken(user._id, 'email_verify');
  await sendEmail(
    user.email,
    `Confirm your email for ${env.appName}`,
    `Hi ${firstName(user.name)},\n\nPlease confirm this is your email address:\n${env.webOrigin}/verify-email?token=${token}\n\nThe link works for 48 hours. If you didn't create an account, you can ignore this email.`,
  );
}

export async function sendPasswordResetEmail(user: { _id: unknown; name?: string | null; email?: string | null }) {
  if (!user.email) return;
  const token = await issueToken(user._id, 'password_reset');
  await sendEmail(
    user.email,
    `Reset your ${env.appName} password`,
    `Hi ${firstName(user.name)},\n\nSomeone (hopefully you) asked to reset your password. Choose a new one here:\n${env.webOrigin}/reset-password?token=${token}\n\nThe link works for 30 minutes and only once. If you didn't ask for this, ignore this email: your password stays the same.`,
  );
}

/** Invite link for a new staff account (used by the bootstrap command). Returns the link too, for the operator. */
export async function sendInviteEmail(user: { _id: unknown; name?: string | null; email?: string | null }, roleLabel: string): Promise<string> {
  const token = await issueToken(user._id, 'password_reset', INVITE_TTL_MS);
  const link = `${env.webOrigin}/reset-password?token=${token}&invite=1`;
  if (user.email) {
    await sendEmail(
      user.email,
      `You've been added to ${env.appName}`,
      `Hi ${firstName(user.name)},\n\nYou've been set up as ${roleLabel} on ${env.appName}. Choose your password to get started:\n${link}\n\nThe link works for 72 hours.`,
    );
  }
  return link;
}

/** Plain security notices (password changed, two-factor turned on or off). */
export async function sendSecurityNotice(email: string | null | undefined, subject: string, body: string) {
  if (!email) return;
  await sendEmail(email, subject, `${body}\n\nIf this wasn't you, reset your password straight away at ${env.webOrigin}/forgot-password and contact your Alumni Relations office.`);
}
