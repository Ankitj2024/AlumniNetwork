/** First-run onboarding: only for accounts created by sign-up, and only once. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { User } from '../src/models/index.js';
import { api, auth, clearDb, makeMentor, makeStaff, makeStudent, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

async function signUp(role: 'student' | 'alumnus', email: string) {
  const res = await api().post('/api/auth/register').send({ name: 'New Person', email, password: 'Str0ngpass', role });
  expect(res.status).toBe(201);
  const user = await User.findOne({ email }).lean();
  return user!;
}

describe('onboarding', () => {
  it('a new student and a new alumnus are asked to onboard', async () => {
    for (const [role, email] of [['student', 'fresh.student@college.test'], ['alumnus', 'fresh.alum@college.test']] as const) {
      const u = await signUp(role, email);
      const me = await api().get('/api/auth/me').set(auth(u));
      expect(me.body.user.needsOnboarding).toBe(true);
    }
  });

  it('finishing it once clears it for good, on every device', async () => {
    const u = await signUp('student', 'once@college.test');
    const done = await api().patch('/api/auth/me').set(auth(u)).send({ onboarded: true });
    expect(done.status).toBe(200);
    expect(done.body.user.needsOnboarding).toBe(false);
    const stored = await User.findById(u._id).lean();
    expect(stored!.onboardingPending).toBe(false);
    expect(stored!.onboardedAt).toBeInstanceOf(Date);
    // a fresh sign-in (another device) still doesn't see it
    const again = await api().get('/api/auth/me').set(auth(u));
    expect(again.body.user.needsOnboarding).toBe(false);
  });

  it('it can’t be switched back on', async () => {
    const u = await signUp('student', 'no-undo@college.test');
    await api().patch('/api/auth/me').set(auth(u)).send({ onboarded: true });
    const res = await api().patch('/api/auth/me').set(auth(u)).send({ onboarded: false });
    expect(res.status).toBe(400);
    expect((await api().get('/api/auth/me').set(auth(u))).body.user.needsOnboarding).toBe(false);
  });

  it('existing, seeded and staff accounts never see it', async () => {
    const student = await makeStudent();
    const mentor = await makeMentor();
    const admin = await makeStaff('admin');
    for (const u of [student.user, mentor.user, admin]) {
      const me = await api().get('/api/auth/me').set(auth(u));
      expect(me.body.user.needsOnboarding).toBe(false);
    }
  });
});
