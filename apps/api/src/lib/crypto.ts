import crypto from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Small crypto helpers.
 * - encrypt/decrypt: AES-256-GCM for secrets stored in the database (two-factor keys).
 * - sha256 / randomToken: one-time links are stored only as hashes, so a database leak
 *   doesn't hand out working reset links.
 */
let cachedKey: Buffer | null = null;
function dataKey(): Buffer {
  if (cachedKey) return cachedKey;
  if (env.dataEncryptionKey) {
    const k = Buffer.from(env.dataEncryptionKey, 'base64');
    if (k.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)');
    cachedKey = k;
  } else {
    // Development fallback only. Production refuses to start without DATA_ENCRYPTION_KEY (config/validate.ts).
    cachedKey = crypto.createHash('sha256').update(`amn-data-key:${env.jwtSecret}`).digest();
  }
  return cachedKey;
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function decrypt(blob: string): string {
  const [version, iv, tag, data] = blob.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unrecognised ciphertext');
  const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
