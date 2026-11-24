/**
 * Business-logic audit (November 2026): one test per confirmed gap, written to fail against the
 * code before the fix. Covers ended mentorships, booking races, the student mentorship limit under
 * concurrency, suspended accounts, admin safety rails, input validation and record ownership.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Alumnus, CareerGoal, Mentorship, MentorshipRequest, Payment, Session, User } from '../src/models/index.js';
import { api, auth, clearDb, makeMentor, makeStaff, makeStudent, pendingRequest, setSettings, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const hoursAhead = (h: number) => new Date(Date.now() + h * 3600e3);
const slot = (h: number, mins = 60) => ({ start: hoursAhead(h), end: new Date(hoursAhead(h).getTime() + mins * 60e3) });

async function pair(fee = 0) {
  const mentor = await makeMentor({ maxMentees: 5 });
  await Alumnus.updateOne({ _id: mentor.alumnus._id }, { $set: { sessionFee: fee } });
  const student = await makeStudent();
  const m = await Mentorship.create({ student: student.profile._id, alumnus: mentor.alumnus._id });
  return { mentor, student, m, mu: mentor.user, su: student.user };
}
async function propose(m: { _id: unknown }, who: { _id: unknown; role: string }, h = 72) {
  const r = await api().post(`/api/mentorships/${m._id}/sessions`).set(auth(who)).send({ slots: [slot(h)] });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.session.id as string;
}

describe('ended mentorships', () => {
  it('a slot cannot be booked once the mentorship has ended', async () => {
    const p = await pair();
    const sid = await propose(p.m, p.mu);
    await Mentorship.updateOne({ _id: p.m._id }, { $set: { status: 'ended' } });
    const r = await api().post(`/api/mentorships/${p.m._id}/sessions/${sid}/book`).set(auth(p.su)).send({ slotIndex: 0 });
    expect(r.status).toBe(409);
    expect((await Session.findById(sid).lean())!.status).toBe('proposed');
  });

  it('ending a mentorship closes its open proposals and unpaid holds, and their payment attempts', async () => {
    const p = await pair(499);
    const proposed = await propose(p.m, p.mu, 72);
    const held = await propose(p.m, p.mu, 96);
    await api().post(`/api/mentorships/${p.m._id}/sessions/${held}/book`).set(auth(p.su)).send({ slotIndex: 0 });
    const co = await api().post('/api/payments/checkout').set(auth(p.su)).send({ sessionId: held });
    expect(co.status).toBe(201);
    expect((await api().post(`/api/mentorships/${p.m._id}/end`).set(auth(p.su)).send({ outcome: 'completed' })).status).toBe(200);
    expect((await Session.findById(proposed).lean())!.status).toBe('cancelled');
    expect((await Session.findById(held).lean())!.status).toBe('cancelled');
    expect((await Payment.findOne().lean())!.status).toBe('failed');
    // the open checkout can no longer be completed
    const late = await api().post('/api/payments/test/complete').set(auth(p.su)).send({ paymentId: co.body.checkout.paymentId, method: { type: 'upi', vpa: 'aarav@okhdfc' } });
    expect(late.status).toBe(409);
    expect(await Payment.countDocuments({ status: 'paid' })).toBe(0);
  });
});

describe('approved rule changes', () => {
  const pay = async (p: Awaited<ReturnType<typeof pair>>, sid: string) => {
    const co = await api().post('/api/payments/checkout').set(auth(p.su)).send({ sessionId: sid });
    const r = await api().post('/api/payments/test/complete').set(auth(p.su)).send({ paymentId: co.body.checkout.paymentId, method: { type: 'upi', vpa: 'aarav@okhdfc' } });
    expect(r.body.session.status).toBe('scheduled');
    return r.body.payment.id as string;
  };

  it('a booked session can be cancelled only before it starts', async () => {
    const p = await pair();
    const sid = await propose(p.m, p.mu);
    await api().post(`/api/mentorships/${p.m._id}/sessions/${sid}/book`).set(auth(p.su)).send({ slotIndex: 0 });
    await Session.updateOne({ _id: sid }, { $set: { scheduledStart: hoursAhead(-1), scheduledEnd: new Date() } });
    const r = await api().post(`/api/mentorships/${p.m._id}/sessions/${sid}/cancel`).set(auth(p.mu)).send({});
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('already_started');
    // it can still be logged
    expect((await api().post(`/api/mentorships/${p.m._id}/sessions/${sid}/complete`).set(auth(p.su)).send({ outcome: 'no_show' })).status).toBe(200);
  });

  it('ending a mentorship cancels booked sessions still to come and refunds them; past ones stay to be logged', async () => {
    const p = await pair(499);
    const ahead = await propose(p.m, p.mu, 72);
    await api().post(`/api/mentorships/${p.m._id}/sessions/${ahead}/book`).set(auth(p.su)).send({ slotIndex: 0 });
    const paymentId = await pay(p, ahead);
    const past = await propose(p.m, p.mu, 120);
    await api().post(`/api/mentorships/${p.m._id}/sessions/${past}/book`).set(auth(p.su)).send({ slotIndex: 0 });
    await pay(p, past);
    await Session.updateOne({ _id: past }, { $set: { scheduledStart: hoursAhead(-2), scheduledEnd: hoursAhead(-1) } });
    expect((await api().post(`/api/mentorships/${p.m._id}/end`).set(auth(p.mu)).send({ outcome: 'ended' })).status).toBe(200);
    expect((await Session.findById(ahead).lean())!).toMatchObject({ status: 'cancelled', cancelReason: 'The mentorship ended' });
    expect((await Payment.findById(paymentId).lean())!).toMatchObject({ status: 'refunded', refund: { amount: 49900 } });
    expect((await Session.findById(past).lean())!.status).toBe('scheduled');
  });

  it("a staff refund of a session that hasn't happened yet also cancels it; a past one stays", async () => {
    const p = await pair(499);
    const admin = await makeStaff('admin');
    const sid = await propose(p.m, p.mu, 72);
    await api().post(`/api/mentorships/${p.m._id}/sessions/${sid}/book`).set(auth(p.su)).send({ slotIndex: 0 });
    const paymentId = await pay(p, sid);
    const r = await api().post(`/api/payments/${paymentId}/refund`).set(auth(admin)).send({ reason: 'Dispute settled' });
    expect(r.body).toMatchObject({ sessionCancelled: true, payment: { status: 'refunded' } });
    expect((await Session.findById(sid).lean())!.status).toBe('cancelled');

    const old = await propose(p.m, p.mu, 96);
    await api().post(`/api/mentorships/${p.m._id}/sessions/${old}/book`).set(auth(p.su)).send({ slotIndex: 0 });
    const oldPayment = await pay(p, old);
    await Session.updateOne({ _id: old }, { $set: { scheduledStart: hoursAhead(-3), scheduledEnd: hoursAhead(-2) } });
    const r2 = await api().post(`/api/payments/${oldPayment}/refund`).set(auth(admin)).send({ reason: 'Mentor did not show' });
    expect(r2.body.sessionCancelled).toBe(false);
    expect((await Session.findById(old).lean())!.status).toBe('scheduled');
  });
});

describe('booking races', () => {
  it('two students booking overlapping times with one mentor at once: only one gets the slot', async () => {
    const mentor = await makeMentor({ maxMentees: 5 });
    const a = await makeStudent();
    const b = await makeStudent();
    const ma = await Mentorship.create({ student: a.profile._id, alumnus: mentor.alumnus._id });
    const mb = await Mentorship.create({ student: b.profile._id, alumnus: mentor.alumnus._id });
    const sa = await propose(ma, mentor.user, 50);
    const sb = await propose(mb, mentor.user, 50);
    const results = await Promise.all([
      api().post(`/api/mentorships/${ma._id}/sessions/${sa}/book`).set(auth(a.user)).send({ slotIndex: 0 }),
      api().post(`/api/mentorships/${mb._id}/sessions/${sb}/book`).set(auth(b.user)).send({ slotIndex: 0 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await Session.countDocuments({ status: 'scheduled' })).toBe(1);
  });

  it('a double-click on the same slot books it once', async () => {
    const p = await pair();
    const sid = await propose(p.m, p.mu);
    const results = await Promise.all([0, 1, 2].map(() => api().post(`/api/mentorships/${p.m._id}/sessions/${sid}/book`).set(auth(p.su)).send({ slotIndex: 0 })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
  });
});

describe('student mentorship limit under concurrency', () => {
  it('two mentors accepting the same student at once cannot push them past the limit', async () => {
    await setSettings({ 'throttle.maxActiveMentorshipsPerStudent': 1 });
    const s = await makeStudent();
    const m1 = await makeMentor();
    const m2 = await makeMentor();
    const r1 = await pendingRequest(s.profile._id, m1.alumnus._id);
    const r2 = await pendingRequest(s.profile._id, m2.alumnus._id);
    const results = await Promise.all([
      api().post(`/api/requests/${r1._id}/accept`).set(auth(m1.user)).send({}),
      api().post(`/api/requests/${r2._id}/accept`).set(auth(m2.user)).send({}),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await Mentorship.countDocuments({ student: s.profile._id, status: 'active' })).toBe(1);
    // the losing mentor's slot is given back
    const caps = await (await import('../src/models/index.js')).MentorCapacity.find({ alumnus: { $in: [m1.alumnus._id, m2.alumnus._id] } }).lean();
    expect(caps.map((c) => c.activeCount).sort()).toEqual([0, 1]);
  });
});

describe('suspended accounts', () => {
  it('a suspended mentor is not offered to students and cannot be requested', async () => {
    const s = await makeStudent();
    const m = await makeMentor({ name: 'Suspended Sam' });
    await User.updateOne({ _id: m.user._id }, { $set: { status: 'suspended' } });
    const search = await api().get('/api/mentors/search?hasCapacity=false').set(auth(s.user));
    expect(search.body.mentors.map((x: any) => x.name)).not.toContain('Suspended Sam');
    const req = await api().post('/api/requests').set(auth(s.user)).send({ alumnusId: String(m.alumnus._id), message: 'I would really value your guidance on my career.' });
    expect(req.status).toBe(404);
    // their profile page is gone for students, still open to the alumni office
    expect((await api().get(`/api/mentors/${m.alumnus._id}`).set(auth(s.user))).status).toBe(404);
    expect((await api().get(`/api/mentors/${m.alumnus._id}`).set(auth(await makeStaff('aro')))).status).toBe(200);
  });
});

describe('admin safety rails', () => {
  it('an admin cannot suspend or demote themselves, or remove the last admin', async () => {
    const admin = await makeStaff('admin');
    expect((await api().patch(`/api/admin/users/${admin._id}`).set(auth(admin)).send({ status: 'suspended' })).status).toBe(409);
    expect((await api().patch(`/api/admin/users/${admin._id}`).set(auth(admin)).send({ role: 'aro' })).status).toBe(409);
    const other = await makeStaff('admin');
    expect((await api().patch(`/api/admin/users/${other._id}`).set(auth(admin)).send({ role: 'aro' })).status).toBe(200);
    expect((await User.findById(admin._id).lean())!.role).toBe('admin'); // still an admin
  });

  it("a student's or alumnus's role cannot be switched (their profile and records would be orphaned)", async () => {
    const admin = await makeStaff('admin');
    const s = await makeStudent();
    const r = await api().patch(`/api/admin/users/${s.user._id}`).set(auth(admin)).send({ role: 'alumnus' });
    expect(r.status).toBe(409);
    expect((await User.findById(s.user._id).lean())!.role).toBe('student');
    // staff roles can still be changed among themselves
    const aro = await makeStaff('aro');
    expect((await api().patch(`/api/admin/users/${aro._id}`).set(auth(admin)).send({ role: 'placement' })).status).toBe(200);
  });
});

describe('input validation and ownership', () => {
  it('bad paging values on messages are a 400, not a server error', async () => {
    const p = await pair();
    expect((await api().get(`/api/messages?mentorshipId=${p.m._id}&before=not-a-date`).set(auth(p.su))).status).toBe(400);
    expect((await api().get(`/api/messages?mentorshipId=${p.m._id}&limit=abc`).set(auth(p.su))).status).toBe(400);
  });

  it("goals and action items can't point at another student's career goal or another mentorship's session", async () => {
    const p = await pair();
    const other = await pair();
    const foreignGoal = await CareerGoal.findOne({ student: other.student.profile._id }).lean();
    const g = await api().post(`/api/mentorships/${p.m._id}/goals`).set(auth(p.su)).send({ title: 'Ship it', careerGoalId: String(foreignGoal!._id) });
    expect(g.status).toBe(400);
    const foreignSession = await propose(other.m, other.mu);
    const a = await api().post(`/api/mentorships/${p.m._id}/actions`).set(auth(p.su)).send({ title: 'Prep', sessionId: foreignSession });
    expect(a.status).toBe(400);
  });

  it('feedback for a session can be given once per person', async () => {
    const p = await pair();
    const sid = await propose(p.m, p.mu);
    await Session.updateOne({ _id: sid }, { $set: { status: 'completed', completedAt: new Date() } });
    const first = await api().post(`/api/mentorships/${p.m._id}/feedback`).set(auth(p.su)).send({ rating: 5, sessionId: sid });
    expect(first.status).toBe(201);
    const again = await api().post(`/api/mentorships/${p.m._id}/feedback`).set(auth(p.su)).send({ rating: 1, sessionId: sid });
    expect(again.status).toBe(409);
    void MentorshipRequest;
  });
});
