/**
 * Spec §15: "the expiry job is correct".
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { addDays, DAY_MS } from '../src/lib/clock.js';
import { MentorCapacity, MentorshipRequest, Notification } from '../src/models/index.js';
import { acceptRequest, createRequest, expireRequests } from '../src/services/requests.js';
import { api, auth, clearDb, makeMentor, makeStudent, pendingRequest, setSettings, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const T0 = new Date('2026-03-01T10:00:00Z');
const at = (d: Date) => () => d;

describe('request expiry sweep', () => {
  it('expires only pending requests whose expiresAt has passed, and is idempotent', async () => {
    const m = await makeMentor({ maxPendingRequests: 30 });
    const s = await Promise.all([1, 2, 3, 4, 5].map(() => makeStudent()));
    const past = await pendingRequest(s[0].profile._id, m.alumnus._id, new Date(T0.getTime() - 1000));
    const exactlyNow = await pendingRequest(s[1].profile._id, m.alumnus._id, T0);
    const future = await pendingRequest(s[2].profile._id, m.alumnus._id, new Date(T0.getTime() + 1000));
    const declinedPast = await MentorshipRequest.create({ student: s[3].profile._id, alumnus: m.alumnus._id, message: 'x'.repeat(30), status: 'declined', expiresAt: new Date(T0.getTime() - DAY_MS) });
    const acceptedPast = await MentorshipRequest.create({ student: s[4].profile._id, alumnus: m.alumnus._id, message: 'x'.repeat(30), status: 'accepted', expiresAt: new Date(T0.getTime() - DAY_MS) });

    expect(await expireRequests(at(T0))).toBe(2);
    const st = async (d: any) => (await MentorshipRequest.findById(d._id).lean())!.status;
    expect(await st(past)).toBe('expired');
    expect(await st(exactlyNow)).toBe('expired');
    expect(await st(future)).toBe('pending');
    expect(await st(declinedPast)).toBe('declined');
    expect(await st(acceptedPast)).toBe('accepted');

    // second run does nothing
    expect(await expireRequests(at(T0))).toBe(0);
    // students are told, kindly
    const notes = await Notification.find({ type: 'request_expired' }).lean();
    expect(notes).toHaveLength(2);
    expect(notes[0].body).toMatch(/isn't a judgement/);
  });

  it('concurrent sweeps never double-process a request', async () => {
    const m = await makeMentor({ maxPendingRequests: 30 });
    for (let i = 0; i < 6; i++) {
      const s = await makeStudent();
      await pendingRequest(s.profile._id, m.alumnus._id, new Date(T0.getTime() - 1000));
    }
    const counts = await Promise.all([expireRequests(at(T0)), expireRequests(at(T0)), expireRequests(at(T0))]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(6);
    expect(await Notification.countDocuments({ type: 'request_expired' })).toBe(6);
  });

  it('new requests get expiresAt = now + requestExpiryDays (configurable)', async () => {
    await setSettings({ requestExpiryDays: 3 });
    const m = await makeMentor();
    const s = await makeStudent();
    const req = await createRequest({ id: String(s.user._id), role: 'student' }, { alumnusId: String(m.alumnus._id), message: 'Please mentor me on interviews and projects.' }, at(T0));
    expect(req.expiresAt.toISOString()).toBe(addDays(T0, 3).toISOString());
    // one day before expiry: untouched; at expiry: expired
    expect(await expireRequests(at(addDays(T0, 2)))).toBe(0);
    expect(await expireRequests(at(addDays(T0, 3)))).toBe(1);
  });

  it('an expired-but-not-yet-swept request cannot be accepted', async () => {
    const m = await makeMentor();
    const s = await makeStudent();
    const r = await pendingRequest(s.profile._id, m.alumnus._id, new Date(Date.now() - 60_000));
    const res = await api().post(`/api/requests/${r._id}/accept`).set(auth(m.user));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('expired');
    expect((await MentorshipRequest.findById(r._id).lean())!.status).toBe('expired');
    expect((await MentorCapacity.findOne({ alumnus: m.alumnus._id }).lean())!.activeCount).toBe(0);
  });

  it('acceptance just before expiry succeeds; just after fails', async () => {
    const m = await makeMentor({ maxMentees: 3 });
    const [a, b] = await Promise.all([makeStudent(), makeStudent()]);
    const exp = addDays(T0, 7);
    const r1 = await pendingRequest(a.profile._id, m.alumnus._id, exp);
    const r2 = await pendingRequest(b.profile._id, m.alumnus._id, exp);
    const viewer = { id: String(m.user._id), role: 'alumnus' as const };
    await expect(acceptRequest(viewer, String(r1._id), at(new Date(exp.getTime() - 1)))).resolves.toBeTruthy();
    await expect(acceptRequest(viewer, String(r2._id), at(new Date(exp.getTime() + 1)))).rejects.toMatchObject({ code: 'expired' });
  });
});
