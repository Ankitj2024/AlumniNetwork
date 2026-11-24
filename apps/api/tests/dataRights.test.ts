/** Data rights (DPDP Act 2023): download my data, and erase my account. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Alumnus, CareerGoal, Mentorship, MentorshipRequest, Payment, PaymentMethod, Session, User, VerificationRequest } from '../src/models/index.js';
import { api, auth, clearDb, makeMentor, makeStaff, makeStudent, pendingRequest, startDb, stopDb } from './helpers.js';
import bcrypt from 'bcryptjs';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const YEAR = new Date().getFullYear();

/** A student with a paid session booked three days ahead, a message thread and a saved card. */
async function busyStudent() {
  const mentor = await makeMentor({ maxMentees: 5 });
  await Alumnus.updateOne({ _id: mentor.alumnus._id }, { $set: { sessionFee: 499 } });
  const student = await makeStudent();
  await User.updateOne({ _id: student.user._id }, { $set: { passwordHash: bcrypt.hashSync('Passw0rd!', 4) } });
  const m = await Mentorship.create({ student: student.profile._id, alumnus: mentor.alumnus._id });
  const start = new Date(Date.now() + 72 * 3600e3);
  const prop = await api().post(`/api/mentorships/${m._id}/sessions`).set(auth(mentor.user)).send({ slots: [{ start, end: new Date(start.getTime() + 3600e3) }] });
  const sid = prop.body.session.id;
  await api().post(`/api/mentorships/${m._id}/sessions/${sid}/book`).set(auth(student.user)).send({ slotIndex: 0 });
  const co = await api().post('/api/payments/checkout').set(auth(student.user)).send({ sessionId: sid });
  await api().post('/api/payments/test/complete').set(auth(student.user)).send({ paymentId: co.body.checkout.paymentId, method: { type: 'card', network: 'visa', cardType: 'credit', last4: '4242', expMonth: 12, expYear: YEAR + 2, save: true } });
  await api().post('/api/messages').set(auth(student.user)).send({ mentorshipId: String(m._id), body: 'Looking forward to our session!' });
  const other = await makeMentor();
  const pending = await pendingRequest(student.profile._id, other.alumnus._id);
  return { mentor, student, m, sid, pending };
}

describe('download my data', () => {
  it('a student gets their own records, with no one else’s contact details', async () => {
    const b = await busyStudent();
    const res = await api().get('/api/auth/me/export').set(auth(b.student.user));
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="my-data-/);
    const d = res.body;
    expect(d.account.email).toBe(b.student.user.email);
    expect(d.profile).toBeTruthy();
    expect(d.requests).toHaveLength(1);
    expect(d.mentorships[0].messages[0].body).toBe('Looking forward to our session!');
    expect(d.mentorships[0].sessions[0].paid).toBe(true);
    expect(d.payments[0]).toMatchObject({ status: 'paid', amount: 49900 });
    expect(d.savedCards[0].last4).toBe('4242');
    const text = JSON.stringify(d);
    const mentorUser = await User.findById(b.mentor.user._id).select('+email +phone').lean();
    expect(text).not.toContain(mentorUser!.email);
    expect(text).not.toContain('linkedin.com/in/mentor');
    expect(text).not.toMatch(/tok_test_|passwordHash|mfaSecret/);
  });

  it('a mentor gets their profile, mentees’ requests and their earnings', async () => {
    const b = await busyStudent();
    const d = (await api().get('/api/auth/me/export').set(auth(b.mentor.user))).body;
    expect(d.profile.linkedinUrl).toMatch(/linkedin/); // their own
    expect(d.mentorships[0].sessions).toHaveLength(1);
    expect(d.earnings[0]).toMatchObject({ amount: 49900, mentorShare: 44910 });
    const studentUser = await User.findById(b.student.user._id).select('+email').lean();
    expect(JSON.stringify(d)).not.toContain(studentUser!.email);
  });
});

describe('delete my account', () => {
  it('needs DELETE typed and the password; staff accounts are removed by an admin', async () => {
    const b = await busyStudent();
    expect((await api().post('/api/auth/me/delete').set(auth(b.student.user)).send({ password: 'Passw0rd!' })).status).toBe(400);
    expect((await api().post('/api/auth/me/delete').set(auth(b.student.user)).send({ confirm: 'DELETE', password: 'wrong' })).status).toBe(400);
    expect((await api().post('/api/auth/me/delete').set(auth(await makeStaff('admin'))).send({ confirm: 'DELETE' })).status).toBe(403);
    expect((await User.findById(b.student.user._id).lean())!.status).toBe('active');
  });

  it('erases a student: personal data gone, everything in progress closed and refunded, shared records anonymised', async () => {
    const b = await busyStudent();
    const card = await PaymentMethod.findOne().lean();
    expect(card).toBeTruthy();
    const res = await api().post('/api/auth/me/delete').set(auth(b.student.user)).send({ confirm: 'DELETE', password: 'Passw0rd!' });
    expect(res.status).toBe(200);
    // signed out everywhere
    expect((await api().get('/api/auth/me').set(auth(b.student.user))).status).toBe(401);
    const u = await User.findById(b.student.user._id).select('+email +phone +passwordHash').lean();
    expect(u).toMatchObject({ name: 'Deleted user', status: 'deleted' });
    expect(u!.email).toMatch(/@deleted\.invalid$/);
    expect(u!.phone).toBeUndefined();
    expect(u!.passwordHash).toBeUndefined();
    // in progress: mentorship ended, booked session cancelled, payment refunded, pending request withdrawn
    expect((await Mentorship.findById(b.m._id).lean())!.status).toBe('ended');
    expect((await Session.findById(b.sid).lean())!.status).toBe('cancelled');
    expect((await Payment.findOne().lean())!.status).toBe('refunded'); // the payment record itself is kept
    expect((await MentorshipRequest.findById(b.pending._id).lean())!.status).toBe('withdrawn');
    // erased: saved cards and career goals
    expect(await PaymentMethod.countDocuments()).toBe(0);
    expect(await CareerGoal.countDocuments({ student: b.student.profile._id })).toBe(0);
    // the mentor still sees the conversation, from "Deleted user"
    const list = await api().get('/api/mentorships?status=all').set(auth(b.mentor.user));
    expect(list.body.mentorships[0].student.name).toBe('Deleted user');
    expect((await api().get(`/api/messages?mentorshipId=${b.m._id}`).set(auth(b.mentor.user))).body.messages).toHaveLength(1);
    // the email address is free to register again
    const again = await api().post('/api/auth/register').send({ name: 'Back Again', email: b.student.user.email, password: 'An0ther-pass!', role: 'student' });
    expect(again.status).toBe(201);
    // and an admin can't bring the deleted account back
    expect((await api().patch(`/api/admin/users/${b.student.user._id}`).set(auth(await makeStaff('admin'))).send({ status: 'active' })).status).toBe(409);
  });

  it('erases a mentor: off the search, open requests declined, verification records removed', async () => {
    const mentor = await makeMentor({ name: 'Leaving Lee' });
    const s = await makeStudent();
    const req = await pendingRequest(s.profile._id, mentor.alumnus._id);
    await VerificationRequest.create({ alumnus: mentor.alumnus._id, user: mentor.user._id, submitted: { rollNumber: 'X1', fullName: 'Leaving Lee', graduationYear: 2015, degree: 'B.Tech', department: 'Computer Science & Engineering' }, status: 'approved', documents: [] });
    // makeMentor accounts have a password
    expect((await api().post('/api/auth/me/delete').set(auth(mentor.user)).send({ confirm: 'DELETE', password: 'Passw0rd!' })).status).toBe(200);
    const search = await api().get('/api/mentors/search?hasCapacity=false').set(auth(s.user));
    expect(search.body.mentors.map((m: any) => m.name)).not.toContain('Leaving Lee');
    expect((await MentorshipRequest.findById(req._id).lean())!.status).toBe('declined');
    expect(await VerificationRequest.countDocuments({ alumnus: mentor.alumnus._id })).toBe(0);
    const a = await Alumnus.findById(mentor.alumnus._id).select('+linkedinUrl').lean();
    expect(a).toMatchObject({ mentorOptIn: false, verificationStatus: 'unverified' });
    expect(a!.linkedinUrl).toBeUndefined();
  });
});
