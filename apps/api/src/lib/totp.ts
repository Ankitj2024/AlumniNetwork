import crypto from 'node:crypto';
import { safeEqual } from './crypto.js';

/**
 * Time-based one-time passwords (RFC 6238 / RFC 4226), compatible with Google Authenticator,
 * Microsoft Authenticator, 1Password, Authy and others: SHA-1, 6 digits, 30-second steps.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SECONDS = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
    value &= (1 << bits) - 1;
  }
  return Buffer.from(out);
}

/** A new random secret (160 bits, the RFC-recommended size), base32-encoded for authenticator apps. */
export const generateSecret = () => base32Encode(crypto.randomBytes(20));

export function hotp(key: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(msg).digest();
  const off = h[h.length - 1] & 0x0f;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export const timeStep = (ms = Date.now()) => Math.floor(ms / 1000 / STEP_SECONDS);

export function totp(secret: string, ms = Date.now(), digits = 6): string {
  return hotp(base32Decode(secret), timeStep(ms), digits);
}

/**
 * Checks a 6-digit code, allowing one step of clock drift either side. Returns the matching
 * time step so the caller can store it and refuse the same code twice, or null.
 */
export function verifyTotp(secret: string, code: string, opts: { ms?: number; window?: number; afterStep?: number } = {}): number | null {
  const clean = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const key = base32Decode(secret);
  const now = timeStep(opts.ms ?? Date.now());
  const window = opts.window ?? 1;
  for (let w = -window; w <= window; w++) {
    const step = now + w;
    if (step <= (opts.afterStep ?? -1)) continue;
    if (safeEqual(hotp(key, step), clean)) return step;
  }
  return null;
}

/** The URI authenticator apps read from the QR code. */
export function otpauthUrl({ secret, account, issuer }: { secret: string; account: string; issuer: string }): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}
