import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { env } from '../config/env.js';
import { decrypt, encrypt, sha256 } from '../lib/crypto.js';
import { base32Encode, generateSecret, otpauthUrl, verifyTotp } from '../lib/totp.js';
import { User } from '../models/index.js';
import { sendSecurityNotice } from './account.js';

/**
 * Two-factor sign-in with an authenticator app.
 * - Setup: a pending key is stored encrypted until the user proves they scanned it.
 * - Sign-in: a password (or Google) only earns a 5-minute "challenge"; the session is issued
 *   after a valid 6-digit code or a one-time recovery code.
 * - A code can't be used twice (last accepted time step is stored atomically).
 * - 5 wrong codes lock two-factor sign-in for 15 minutes and email the user.
 */
export const RECOVERY_CODE_COUNT = 10;
export const MAX_FAILURES = 5;
export const LOCK_MS = 15 * 60 * 1000;
const CHALLENGE_TTL = '5m';

const normaliseRecovery = (c: string) => c.toLowerCase().replace(/[^a-z2-7]/g, '');

export function newRecoveryCodes(): { plain: string[]; hashes: string[] } {
  const plain = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const s = base32Encode(crypto.randomBytes(5)).toLowerCase(); // 8 characters
    return `${s.slice(0, 4)}-${s.slice(4, 8)}`;
  });
  return { plain, hashes: plain.map((c) => sha256(normaliseRecovery(c))) };
}

/** Starts setup: stores a new pending key and returns what the authenticator app needs. The QR is drawn locally. */
export async function beginSetup(user: { _id: unknown; email?: string | null }) {
  const secret = generateSecret();
  await User.updateOne({ _id: user._id }, { $set: { mfaPendingSecret: encrypt(secret) } });
  const url = otpauthUrl({ secret, account: user.email ?? 'account', issuer: env.appName });
  const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return { secret, otpauthUrl: url, qrSvg };
}

export function signChallenge(u: { _id: unknown; tokenVersion?: number | null }) {
  return jwt.sign({ sub: String(u._id), purpose: 'mfa', v: u.tokenVersion ?? 0 }, env.jwtSecret, { expiresIn: CHALLENGE_TTL });
}

export function readChallenge(token: string | undefined): { sub: string; v: number } | null {
  if (!token) return null;
  try {
    const p = jwt.verify(token, env.jwtSecret) as { sub: string; purpose?: string; v?: number };
    return p.purpose === 'mfa' ? { sub: p.sub, v: p.v ?? 0 } : null;
  } catch {
    return null;
  }
}

export type SecondFactorResult = { status: 'ok'; usedRecoveryCode: boolean; recoveryCodesLeft: number } | { status: 'invalid' } | { status: 'locked'; until: Date };

/** Checks a 6-digit code or a recovery code for a user with two-factor on. */
export async function checkSecondFactor(userId: string, code: string): Promise<SecondFactorResult> {
  const u = await User.findById(userId).select('+email +mfaSecret +mfaLastStep +mfaRecoveryCodes +mfaFailures +mfaLockedUntil').lean();
  if (!u || !u.mfaEnabled || !u.mfaSecret) return { status: 'invalid' };
  if (u.mfaLockedUntil && u.mfaLockedUntil > new Date()) return { status: 'locked', until: u.mfaLockedUntil };

  const clean = code.trim();
  let ok = false;
  let usedRecoveryCode = false;
  if (/^\d{3}\s?\d{3}$/.test(clean)) {
    const step = verifyTotp(decrypt(u.mfaSecret), clean, { afterStep: u.mfaLastStep ?? -1 });
    if (step !== null) {
      // Atomic: only one request can claim this time step, so a code can't be replayed.
      const r = await User.updateOne({ _id: u._id, $or: [{ mfaLastStep: { $lt: step } }, { mfaLastStep: null }] }, { $set: { mfaLastStep: step } });
      ok = r.modifiedCount === 1;
    }
  } else {
    const h = sha256(normaliseRecovery(clean));
    const r = await User.updateOne({ _id: u._id, mfaRecoveryCodes: h }, { $pull: { mfaRecoveryCodes: h } });
    ok = r.modifiedCount === 1;
    usedRecoveryCode = ok;
  }

  if (ok) {
    await User.updateOne({ _id: u._id }, { $set: { mfaFailures: 0 }, $unset: { mfaLockedUntil: 1 } });
    const left = (u.mfaRecoveryCodes?.length ?? 0) - (usedRecoveryCode ? 1 : 0);
    if (usedRecoveryCode) await sendSecurityNotice(u.email, 'A recovery code was used to sign in', `A two-factor recovery code was just used to sign in to your account. You have ${left} recovery codes left.`);
    return { status: 'ok', usedRecoveryCode, recoveryCodesLeft: left };
  }

  const after = await User.findOneAndUpdate({ _id: u._id }, { $inc: { mfaFailures: 1 } }, { new: true }).select('+mfaFailures').lean();
  if ((after?.mfaFailures ?? 0) >= MAX_FAILURES) {
    const until = new Date(Date.now() + LOCK_MS);
    await User.updateOne({ _id: u._id }, { $set: { mfaLockedUntil: until, mfaFailures: 0 } });
    await sendSecurityNotice(u.email, 'Two-factor sign-in paused for 15 minutes', 'Someone entered several wrong two-factor codes for your account, so we paused two-factor sign-in for 15 minutes. Your password may be known to someone else.');
    return { status: 'locked', until };
  }
  return { status: 'invalid' };
}

/** Finishes setup when the first code matches the pending key. Returns the recovery codes (shown once). */
export async function completeSetup(userId: string, code: string): Promise<{ recoveryCodes: string[] } | null> {
  const u = await User.findById(userId).select('+mfaPendingSecret').lean();
  if (!u?.mfaPendingSecret) return null;
  const step = verifyTotp(decrypt(u.mfaPendingSecret), code);
  if (step === null) return null;
  const { plain, hashes } = newRecoveryCodes();
  await User.updateOne(
    { _id: u._id },
    { $set: { mfaEnabled: true, mfaSecret: u.mfaPendingSecret, mfaLastStep: step, mfaRecoveryCodes: hashes, mfaFailures: 0 }, $unset: { mfaPendingSecret: 1, mfaLockedUntil: 1 }, $inc: { tokenVersion: 1 } },
  );
  return { recoveryCodes: plain };
}

export async function turnOff(userId: string) {
  await User.updateOne(
    { _id: userId },
    { $set: { mfaEnabled: false }, $unset: { mfaSecret: 1, mfaPendingSecret: 1, mfaLastStep: 1, mfaRecoveryCodes: 1, mfaFailures: 1, mfaLockedUntil: 1 }, $inc: { tokenVersion: 1 } },
  );
}

export async function replaceRecoveryCodes(userId: string): Promise<string[]> {
  const { plain, hashes } = newRecoveryCodes();
  await User.updateOne({ _id: userId }, { $set: { mfaRecoveryCodes: hashes } });
  return plain;
}
