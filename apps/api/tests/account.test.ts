/**
 * Launch essentials: password reset, email confirmation, sign-out-everywhere, two-factor sign-in,
 * staff two-factor enforcement, and first-run bootstrap.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { totp, verifyTotp, base32Encode, hotp } from '../src/lib/totp.js';
import { decrypt, encrypt } from '../src/lib/crypto.js';
import { AuthToken, ExpertiseTag, Settings, User } from '../src/models/index.js';
import { testOutbox } from '../src/services/channels.js';
import { bootstrap } from '../src/seed/bootstrap.js';
import { api, auth, clearDb, makeMentor, makeStaff, makeStudent, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  testOutbox.length = 0;
});
const saved = { ev: env.requireEmailVerification, mfa: env.requireStaff2fa };
afterEach(() => {
  env.requireEmailVerification = saved.ev;
  env.requireStaff2fa = saved.mfa;
});

const linkToken = (text: string) => /token=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? '';
const lastEmailTo = (to: string) => [...testOutbox].reverse().find((m) => m.to === to);

async function register(email = 'new.student@college.test', password = 'Str0ngpass') {
  const res = await api().post('/api/auth/register').send({ name: 'New Student', email, password, role: 'student' });
  expect(res.status).toBe(201);
  return res;
}

/* ------------------------------------------------------------- TOTP */
describe('authenticator codes (RFC 6238)', () => {
  // RFC 6238 Appendix B, SHA-1 vectors (8 digits) with the ASCII secret "12345678901234567890".
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('T=%i → %s', (t, expected) => {
    expect(totp(secret, t * 1000, 8)).toBe(expected);
  });

  it('accepts one step of drift, rejects older codes and replays', () => {
    const s = base32Encode(Buffer.from('a test secret 1234'));
    const now = 1_700_000_000_000;
    const prev = totp(s, now - 30_000);
    expect(verifyTotp(s, prev, { ms: now })).not.toBeNull();
    expect(verifyTotp(s, totp(s, now - 90_000), { ms: now })).toBeNull();
    const step = verifyTotp(s, totp(s, now), { ms: now })!;
    expect(verifyTotp(s, totp(s, now), { ms: now, afterStep: step })).toBeNull(); // same code twice
    expect(hotp(Buffer.from('12345678901234567890'), 0)).toBe('755224'); // RFC 4226 vector
  });

  it('encrypts secrets at rest (AES-GCM, tamper-evident)', () => {
    const blob = encrypt('JBSWY3DPEHPK3PXP');
    expect(blob).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decrypt(blob)).toBe('JBSWY3DPEHPK3PXP');
    const parts = blob.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => decrypt(parts.join('.'))).toThrow();
  });
});

/* ------------------------------------------------------ password reset */
describe('password reset', () => {
  it('answers the same for unknown emails and sends nothing', async () => {
    const res = await api().post('/api/auth/forgot-password').send({ email: 'nobody@college.test' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(testOutbox).toHaveLength(0);
  });

  it('resets with a one-time link, signs out every session, and the link only works once', async () => {
    const reg = await register('reset.me@college.test', 'OldPassw0rd');
    const oldSession = reg.body.token;
    expect((await api().get('/api/auth/me').set('Authorization', `Bearer ${oldSession}`)).status).toBe(200);

    expect((await api().post('/api/auth/forgot-password').send({ email: 'Reset.Me@college.test' })).status).toBe(200);
    const mail = lastEmailTo('reset.me@college.test')!;
    expect(mail.subject).toMatch(/reset/i);
    const token = linkToken(mail.text);
    expect(token.length).toBeGreaterThan(30);
    // Only the hash is stored.
    expect(await AuthToken.exists({ tokenHash: token })).toBeNull();

    expect((await api().post('/api/auth/reset-password').send({ token, password: 'weak' })).status).toBe(400); // policy enforced, link not burned
    const ok = await api().post('/api/auth/reset-password').send({ token, password: 'NewPassw0rd' });
    expect(ok.status).toBe(200);

    expect((await api().get('/api/auth/me').set('Authorization', `Bearer ${oldSession}`)).status).toBe(401); // signed out everywhere
    expect((await api().post('/api/auth/login').send({ email: 'reset.me@college.test', password: 'OldPassw0rd' })).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ email: 'reset.me@college.test', password: 'NewPassw0rd' })).status).toBe(200);
    expect((await api().post('/api/auth/reset-password').send({ token, password: 'Another1pass' })).status).toBe(400); // used
    expect(lastEmailTo('reset.me@college.test')!.subject).toMatch(/password was changed/i);
  });

  it('rejects expired links and limits how many are sent', async () => {
    await register('slow@college.test');
    await api().post('/api/auth/forgot-password').send({ email: 'slow@college.test' });
    const token = linkToken(lastEmailTo('slow@college.test')!.text);
    await AuthToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await api().post('/api/auth/reset-password').send({ token, password: 'NewPassw0rd' })).status).toBe(400);

    testOutbox.length = 0;
    for (let i = 0; i < 5; i++) await api().post('/api/auth/forgot-password').send({ email: 'slow@college.test' });
    expect(testOutbox.filter((m) => /reset/i.test(m.subject)).length).toBe(2); // 3 per hour in total (1 already used above)
  });

  it('change-password needs the current password and keeps this session only', async () => {
    const reg = await register('changer@college.test', 'FirstPassw0rd');
    const other = reg.body.token;
    expect((await api().post('/api/auth/change-password').set('Authorization', `Bearer ${other}`).send({ currentPassword: 'wrong', newPassword: 'SecondPassw0rd' })).status).toBe(400);
    const ok = await api().post('/api/auth/change-password').set('Authorization', `Bearer ${other}`).send({ currentPassword: 'FirstPassw0rd', newPassword: 'SecondPassw0rd' });
    expect(ok.status).toBe(200);
    expect((await api().get('/api/auth/me').set('Authorization', `Bearer ${other}`)).status).toBe(401);
    expect((await api().get('/api/auth/me').set('Authorization', `Bearer ${ok.body.token}`)).status).toBe(200);
  });
});

/* -------------------------------------------------- email confirmation */
describe('email confirmation', () => {
  it('new accounts get a link; key actions wait until it is used', async () => {
    env.requireEmailVerification = true;
    const reg = await register('confirm.me@college.test');
    const h = { Authorization: `Bearer ${reg.body.token}` };
    expect(reg.body.user.emailVerified).toBe(false);
    const mail = lastEmailTo('confirm.me@college.test')!;
    expect(mail.subject).toMatch(/confirm/i);

    const mentor = await makeMentor();
    const blocked = await api().post('/api/requests').set(h).send({ alumnusId: String(mentor.alumnus._id), message: 'I would really value your guidance on data careers.' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('email_unverified');

    expect((await api().post('/api/auth/verify-email').send({ token: linkToken(mail.text) })).status).toBe(200);
    const me = await api().get('/api/auth/me').set(h);
    expect(me.body.user.emailVerified).toBe(true);
    expect(me.body.security.emailVerified).toBe(true);

    const allowed = await api().post('/api/requests').set(h).send({ alumnusId: String(mentor.alumnus._id), message: 'I would really value your guidance on data careers.' });
    expect(allowed.body.error?.code).not.toBe('email_unverified');
    expect((await api().post('/api/auth/verify-email').send({ token: linkToken(mail.text) })).status).toBe(400); // one-time
  });

  it('resend is a no-op once confirmed', async () => {
    const reg = await register('again@college.test');
    const h = { Authorization: `Bearer ${reg.body.token}` };
    expect((await api().post('/api/auth/resend-verification').set(h)).body).toEqual({ ok: true });
    await User.updateOne({ email: 'again@college.test' }, { $set: { emailVerifiedAt: new Date() } });
    expect((await api().post('/api/auth/resend-verification').set(h)).body).toEqual({ ok: true, alreadyVerified: true });
  });
});

/* -------------------------------------------------- two-factor sign-in */
async function enableMfa(email: string, password: string) {
  const reg = await register(email, password);
  const h = { Authorization: `Bearer ${reg.body.token}` };
  const setup = await api().post('/api/auth/2fa/setup').set(h);
  expect(setup.status).toBe(200);
  expect(setup.body.qrSvg).toMatch(/^<svg/);
  expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
  const secret: string = setup.body.secret;
  const setupCode = totp(secret);
  const en = await api().post('/api/auth/2fa/enable').set(h).send({ code: setupCode });
  expect(en.status).toBe(200);
  expect(en.body.recoveryCodes).toHaveLength(10);
  return { secret, setupCode, recoveryCodes: en.body.recoveryCodes as string[], oldToken: reg.body.token as string, newToken: en.body.token as string };
}

describe('two-factor sign-in', () => {
  it('password alone no longer signs in; a fresh code does, and the same code cannot be reused', async () => {
    const { secret, setupCode, oldToken, newToken } = await enableMfa('mfa.user@college.test', 'Passw0rdmfa');
    expect((await api().get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`)).status).toBe(401); // other sessions ended
    expect((await api().get('/api/auth/me').set('Authorization', `Bearer ${newToken}`)).status).toBe(200);
    const stored = await User.findOne({ email: 'mfa.user@college.test' }).select('+mfaSecret').lean();
    expect(stored!.mfaSecret).not.toContain(secret); // encrypted at rest

    const step1 = await api().post('/api/auth/login').send({ email: 'mfa.user@college.test', password: 'Passw0rdmfa' });
    expect(step1.status).toBe(200);
    expect(step1.body.mfaRequired).toBe(true);
    expect(step1.body.token).toBeUndefined();
    expect(String(step1.headers['set-cookie'])).not.toContain(`${env.cookieName}=`);
    // The challenge is not a session.
    expect((await api().get('/api/auth/me').set('Authorization', `Bearer ${step1.body.challenge}`)).status).toBe(401);

    // The exact code used during setup is refused: replay protection.
    expect((await api().post('/api/auth/login/2fa').send({ challenge: step1.body.challenge, code: setupCode })).status).toBe(401);
    const next = totp(secret, Date.now() + 30_000);
    const ok = await api().post('/api/auth/login/2fa').send({ challenge: step1.body.challenge, code: next });
    expect(ok.status).toBe(200);
    expect(ok.body.user.mfaEnabled).toBe(true);
    expect((await api().get('/api/auth/me').set('Authorization', `Bearer ${ok.body.token}`)).status).toBe(200);
    expect((await api().post('/api/auth/login/2fa').send({ challenge: step1.body.challenge, code: next })).status).toBe(401); // replay
  });

  it('recovery codes work once each', async () => {
    const { recoveryCodes } = await enableMfa('recover@college.test', 'Passw0rdrec');
    const step1 = await api().post('/api/auth/login').send({ email: 'recover@college.test', password: 'Passw0rdrec' });
    const ok = await api().post('/api/auth/login/2fa').send({ challenge: step1.body.challenge, code: recoveryCodes[0].toUpperCase() });
    expect(ok.status).toBe(200);
    expect(ok.body.recoveryCodesLeft).toBe(9);
    expect((await api().post('/api/auth/login/2fa').send({ challenge: step1.body.challenge, code: recoveryCodes[0] })).status).toBe(401);
    expect(lastEmailTo('recover@college.test')!.subject).toMatch(/recovery code/i);
  });

  it('locks for 15 minutes after 5 wrong codes, even for a right one', async () => {
    const { secret } = await enableMfa('locked@college.test', 'Passw0rdlock');
    const step1 = await api().post('/api/auth/login').send({ email: 'locked@college.test', password: 'Passw0rdlock' });
    for (let i = 0; i < 4; i++) expect((await api().post('/api/auth/login/2fa').send({ challenge: step1.body.challenge, code: '000000' })).status).toBe(401);
    expect((await api().post('/api/auth/login/2fa').send({ challenge: step1.body.challenge, code: '000000' })).status).toBe(429);
    expect((await api().post('/api/auth/login/2fa').send({ challenge: step1.body.challenge, code: totp(secret, Date.now() + 30_000) })).status).toBe(429);
    expect(lastEmailTo('locked@college.test')!.subject).toMatch(/paused/i);
  });

  it('turning it off needs a valid code and signs out other sessions', async () => {
    const { secret, newToken } = await enableMfa('off@college.test', 'Passw0rdoff');
    const h = { Authorization: `Bearer ${newToken}` };
    expect((await api().post('/api/auth/2fa/disable').set(h).send({ code: '123456' })).status).toBe(401);
    const off = await api().post('/api/auth/2fa/disable').set(h).send({ code: totp(secret, Date.now() + 30_000) });
    expect(off.status).toBe(200);
    expect((await api().get('/api/auth/me').set(h)).status).toBe(401);
    const login = await api().post('/api/auth/login').send({ email: 'off@college.test', password: 'Passw0rdoff' });
    expect(login.body.token).toBeTruthy();
  });

  it('staff must turn it on before using the platform when required', async () => {
    env.requireStaff2fa = true;
    const aro = await makeStaff('aro');
    const blocked = await api().get('/api/alumni/verify/queue').set(auth(aro));
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('mfa_setup_required');
    const me = await api().get('/api/auth/me').set(auth(aro));
    expect(me.status).toBe(200);
    expect(me.body.security).toMatchObject({ mfaRequired: true, mfaSetupRequired: true });
    // Students are unaffected.
    const s = await makeStudent();
    expect((await api().get('/api/students/me').set(auth(s.user))).status).toBe(200);
    // Staff can't switch it off while it's required.
    expect((await api().post('/api/auth/2fa/disable').set(auth(aro)).send({ code: '123456' })).status).toBe(403);
  });
});

/* ------------------------------------------------------------ bootstrap */
describe('first-run bootstrap', () => {
  it('creates settings, tags and the first admin with an invite link; safe to re-run', async () => {
    const first = await bootstrap({ adminEmail: 'Head.Of.Alumni@College.test', adminName: 'Asha Rao' });
    expect(await Settings.exists({ key: 'global' })).toBeTruthy();
    const tags = await ExpertiseTag.countDocuments();
    expect(tags).toBeGreaterThan(10);
    const admin = await User.findOne({ email: 'head.of.alumni@college.test' }).select('+passwordHash').lean();
    expect(admin).toMatchObject({ role: 'admin', name: 'Asha Rao' });
    expect(admin!.passwordHash).toBeUndefined();
    expect(first.inviteLink).toMatch(/\/reset-password\?token=.+&invite=1$/);
    expect(lastEmailTo('head.of.alumni@college.test')!.subject).toMatch(/added/i);

    const again = await bootstrap({ adminEmail: 'head.of.alumni@college.test' });
    expect(again.inviteLink).toBeNull();
    expect(await ExpertiseTag.countDocuments()).toBe(tags);
    expect(await User.countDocuments({ role: 'admin' })).toBe(1);

    const set = await api().post('/api/auth/reset-password').send({ token: linkToken(first.inviteLink!), password: 'AdminPassw0rd' });
    expect(set.status).toBe(200);
    expect((await api().post('/api/auth/login').send({ email: 'head.of.alumni@college.test', password: 'AdminPassw0rd' })).status).toBe(200);
  });
});
