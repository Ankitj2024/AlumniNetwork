/** Matching, verification, engagement and session flows. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { addDays, DAY_MS } from '../src/lib/clock.js';
import { Alumnus, AuditLog, InstitutionRecord, MentorCapacity, Mentorship, Notification, Session, User } from '../src/models/index.js';
import { classify, runEngagementDecay } from '../src/services/engagement.js';
import { searchMentors } from '../src/services/matching.js';
import { normalizeName } from '../src/services/verification.js';
import { api, auth, clearDb, makeMentor, makeStaff, makeStudent, setSettings, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

describe('matching engine', () => {
  it('ranks by relevance, explains every match, and filters out full or paused mentors', async () => {
    const s = await makeStudent({ tags: ['Machine Learning', 'Python', 'Statistics'], roles: ['Data Scientist'], industries: ['Data & AI'], areas: ['interview_prep'] });
    const best = await makeMentor({ name: 'Best Fit', tags: ['Machine Learning', 'Python', 'Statistics'], role: 'Senior Data Scientist', industry: 'Data & AI', areas: ['interview_prep'], availability: 2 });
    const mid = await makeMentor({ name: 'Partial Fit', tags: ['Python'], role: 'Backend Engineer', industry: 'Software' });
    const full = await makeMentor({ name: 'Full', tags: ['Machine Learning', 'Python', 'Statistics'], role: 'Data Scientist', industry: 'Data & AI', maxMentees: 1 });
    await MentorCapacity.updateOne({ alumnus: full.alumnus._id }, { activeCount: 1 });
    const paused = await makeMentor({ name: 'Paused', tags: ['Machine Learning'], industry: 'Data & AI', paused: true });

    const { rows } = await searchMentors({}, String(s.profile._id));
    const names = rows.map((r) => (r.alumnus.user as any).name);
    expect(names[0]).toBe('Best Fit');
    expect(names).toContain('Partial Fit');
    expect(names).not.toContain('Full');
    expect(names).not.toContain('Paused');
    const top = rows[0].match!;
    expect(top.score).toBeGreaterThan(rows[1].match!.score);
    expect(top.reasons.join(' ')).toMatch(/Shares 3 of your interests/);
    expect(top.reasons.join(' ')).toMatch(/target role "Data Scientist"/);
    expect(top.reasons.join(' ')).toMatch(/Data & AI, one of your target industries/);
    for (const r of rows) expect(r.match!.reasons.length).toBeGreaterThan(0);

    const withFull = await searchMentors({ hasCapacity: false }, String(s.profile._id));
    expect(withFull.rows.map((r) => (r.alumnus.user as any).name)).toEqual(expect.arrayContaining(['Full', 'Paused']));
    void best;
    void mid;
    void paused;
  });

  it('finds mentors by name (partial, any case) without ever listing unverified alumni', async () => {
    const s = await makeStudent({ name: 'Rhea Student' }); // a student with the same name is never a result
    await makeMentor({ name: 'Rhea Kapoor', role: 'Credit Analyst', industry: 'FinTech' });
    await makeMentor({ name: 'Arjun Mehta', role: 'Platform Engineer' });
    const pending = await makeMentor({ name: 'Rhea Pending' });
    await Alumnus.updateOne({ _id: pending.alumnus._id }, { verificationStatus: 'pending' });
    const names = async (q: string) => (await searchMentors({ q, hasCapacity: false }, String(s.profile._id))).rows.map((r) => (r.alumnus.user as any).name);
    expect(await names('rhea')).toEqual(['Rhea Kapoor']);
    expect(await names('KAPOOR')).toEqual(['Rhea Kapoor']);
    expect(await names('engineer')).toEqual(['Arjun Mehta']); // role search still works
    expect(await names('rhea.*')).toEqual([]); // typed regex characters are literal
  });

  it('admin-configured weights change the ranking', async () => {
    const s = await makeStudent({ tags: ['Python'], roles: ['Data Scientist'], industries: ['FinTech'] });
    await makeMentor({ name: 'Industry match', tags: ['Go'], role: 'Accountant', industry: 'FinTech' });
    await makeMentor({ name: 'Skill match', tags: ['Python'], role: 'Accountant', industry: 'Energy' });
    await setSettings({ matchingWeights: { expertise: 0, targetRole: 0, industry: 100, mentoringAreas: 0, department: 0, availability: 0, loadBalance: 0 } });
    let r = await searchMentors({}, String(s.profile._id));
    expect((r.rows[0].alumnus.user as any).name).toBe('Industry match');
    await setSettings({ matchingWeights: { expertise: 100, targetRole: 0, industry: 0, mentoringAreas: 0, department: 0, availability: 0, loadBalance: 0 } });
    r = await searchMentors({}, String(s.profile._id));
    expect((r.rows[0].alumnus.user as any).name).toBe('Skill match');
  });
});

describe('alumni verification workflow', () => {
  async function registerAlumnus() {
    const res = await api().post('/api/auth/register').send({ name: 'Rhea Kapoor', email: 'rhea@alumni.test', password: 'Secret123', role: 'alumnus' });
    expect(res.status).toBe(201);
    return User.findOne({ email: 'rhea@alumni.test' }).lean();
  }

  it('matches institutional records, queues for review, and keeps a full audit trail on approval', async () => {
    await InstitutionRecord.create({ rollNumber: '2018CS901', fullName: 'Rhea Kapoor', normalizedName: normalizeName('Rhea Kapoor'), graduationYear: 2018, degree: 'B.Tech', department: 'Computer Science & Engineering', dateOfBirth: '1996-04-12' });
    const u = (await registerAlumnus())!;
    const aro = await makeStaff('aro');
    const sub = await api()
      .post('/api/alumni/verify')
      .set(auth(u))
      .field('fullName', 'Ms. Rhea Kapoor')
      .field('rollNumber', '2018cs901')
      .field('graduationYear', '2018')
      .field('degree', 'B.Tech')
      .field('department', 'Computer Science & Engineering')
      .field('dateOfBirth', '1996-04-12')
      .attach('documents', Buffer.from('%PDF-1.4 test'), { filename: 'degree.pdf', contentType: 'application/pdf' });
    expect(sub.status).toBe(201);
    expect(sub.body.verification.matchResult).toMatchObject({ matched: true, confidence: 1 });
    expect(sub.body.verification.status).toBe('pending');

    const queue = await api().get('/api/alumni/verify/queue').set(auth(aro));
    expect(queue.body.verifications).toHaveLength(1);
    expect(queue.body.verifications[0].institutionRecord.rollNumber).toBe('2018CS901');

    const doc = queue.body.verifications[0].documents[0];
    const file = await api().get(`/api/alumni/verify/${sub.body.verification.id}/documents/${doc.id}`).set(auth(aro));
    expect(file.status).toBe(200);

    const dec = await api().post(`/api/alumni/verify/${sub.body.verification.id}/decision`).set(auth(aro)).send({ decision: 'approve' });
    expect(dec.status).toBe(200);
    expect(dec.body.verification.history.map((h: any) => h.status)).toEqual(['submitted', 'approved']);
    const a = await Alumnus.findOne({ user: u._id }).lean();
    expect(a!.verificationStatus).toBe('verified');
    expect(await MentorCapacity.exists({ alumnus: a!._id })).toBeTruthy();
    const actions = (await AuditLog.find().lean()).map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['verification.submitted', 'verification.document_viewed', 'verification.approved']));
    expect(await Notification.exists({ user: u._id, type: 'verification_status' })).toBeTruthy();
  });

  it('flags mismatches and requires a note to reject', async () => {
    await InstitutionRecord.create({ rollNumber: '2018CS901', fullName: 'Rhea Kapoor', normalizedName: 'rhea kapoor', graduationYear: 2018, degree: 'B.Tech', department: 'Computer Science & Engineering' });
    const u = (await registerAlumnus())!;
    const aro = await makeStaff('aro');
    const sub = await api().post('/api/alumni/verify').set(auth(u)).send({ fullName: 'Rhea Kapoor', rollNumber: '2018CS901', graduationYear: 2019, degree: 'B.Tech', department: 'Computer Science & Engineering' });
    expect(sub.body.verification.matchResult.matched).toBe(false);
    expect(sub.body.verification.matchResult.mismatchedFields).toContain('graduationYear');
    expect((await api().post(`/api/alumni/verify/${sub.body.verification.id}/decision`).set(auth(aro)).send({ decision: 'reject' })).status).toBe(400);
    expect((await api().post(`/api/alumni/verify/${sub.body.verification.id}/decision`).set(auth(aro)).send({ decision: 'reject', note: 'Year does not match records' })).status).toBe(200);
  });

  it('unverified alumni never appear in discovery and cannot set capacity', async () => {
    const u = (await registerAlumnus())!;
    const s = await makeStudent();
    const res = await api().get('/api/mentors/search?hasCapacity=false').set(auth(s.user));
    expect(res.body.mentors).toHaveLength(0);
    expect((await api().put('/api/mentors/me/capacity').set(auth(u)).send({ maxMentees: 2 })).status).toBe(400);
  });

  it('students cannot reach the verification queue', async () => {
    const s = await makeStudent();
    expect((await api().get('/api/alumni/verify/queue').set(auth(s.user))).status).toBe(403);
  });
});

describe('engagement monitoring', () => {
  it('classifies health from activity', () => {
    const cfg = { atRiskDays: 14, lapsedDays: 30 };
    expect(classify({ daysSinceActivity: 2, upcoming: 1, sessionsCompleted: 1, messages: 3, actionsCompleted: 1, actionsOverdue: 0 }, cfg).health).toBe('healthy');
    expect(classify({ daysSinceActivity: 15, upcoming: 0, sessionsCompleted: 0, messages: 0, actionsCompleted: 0, actionsOverdue: 0 }, cfg).health).toBe('at_risk');
    expect(classify({ daysSinceActivity: 31, upcoming: 0, sessionsCompleted: 0, messages: 0, actionsCompleted: 0, actionsOverdue: 0 }, cfg).health).toBe('lapsed');
    expect(classify({ daysSinceActivity: 31, upcoming: 1, sessionsCompleted: 0, messages: 0, actionsCompleted: 0, actionsOverdue: 0 }, cfg).health).not.toBe('lapsed');
  });

  it('weekly job detects decay, nudges both sides once per cooldown, and records recovery', async () => {
    const T = new Date('2026-06-01T06:00:00Z');
    const s = await makeStudent();
    const m = await makeMentor();
    const ms = await Mentorship.create({ student: s.profile._id, alumnus: m.alumnus._id, status: 'active', startedAt: addDays(T, -60), lastActivityAt: addDays(T, -20) });
    const r1 = await runEngagementDecay(() => T);
    expect(r1).toMatchObject({ evaluated: 1, at_risk: 1, nudged: 1 });
    expect(await Notification.countDocuments({ type: 'inactivity_nudge', user: { $in: [s.user._id, m.user._id] } })).toBe(2);

    const r2 = await runEngagementDecay(() => addDays(T, 2));
    expect(r2.nudged).toBe(0); // cooldown

    await Mentorship.updateOne({ _id: ms._id }, { lastActivityAt: addDays(T, 8) });
    const r3 = await runEngagementDecay(() => addDays(T, 9));
    expect(r3).toMatchObject({ healthy: 1, recovered: 1 });
    expect((await Mentorship.findById(ms._id).lean())!.health).toBe('healthy');
    void DAY_MS;
  });
});

describe('sessions', () => {
  it('propose → book (other party) → ICS → complete → feedback; mentor slots never double-book', async () => {
    await setSettings({ 'throttle.maxActiveMentorshipsPerStudent': 5 });
    const m = await makeMentor({ maxMentees: 3 });
    const [s1, s2] = await Promise.all([makeStudent(), makeStudent()]);
    const ms1 = await Mentorship.create({ student: s1.profile._id, alumnus: m.alumnus._id, status: 'active' });
    const ms2 = await Mentorship.create({ student: s2.profile._id, alumnus: m.alumnus._id, status: 'active' });
    const start = new Date(Date.now() + 2 * DAY_MS);
    const slot = { start, end: new Date(start.getTime() + 3600e3) };

    const p1 = await api().post(`/api/mentorships/${ms1._id}/sessions`).set(auth(s1.user)).send({ slots: [slot] });
    expect(p1.status).toBe(201);
    expect((await api().post(`/api/mentorships/${ms1._id}/sessions/${p1.body.session.id}/book`).set(auth(s1.user)).send({ slotIndex: 0 })).status).toBe(403);
    const b1 = await api().post(`/api/mentorships/${ms1._id}/sessions/${p1.body.session.id}/book`).set(auth(m.user)).send({ slotIndex: 0 });
    expect(b1.status).toBe(200);
    expect(b1.body.session.videoLink).toMatch(/^https:\/\/meet\.jit\.si\/AMN-/);

    const ics = await api().get(`/api/mentorships/${ms1._id}/sessions/${p1.body.session.id}/ics`).set(auth(s1.user));
    expect(ics.text).toContain('BEGIN:VEVENT');
    expect(ics.text).not.toMatch(/ATTENDEE|ORGANIZER|mailto:/);

    const p2 = await api().post(`/api/mentorships/${ms2._id}/sessions`).set(auth(s2.user)).send({ slots: [slot] });
    const clash = await api().post(`/api/mentorships/${ms2._id}/sessions/${p2.body.session.id}/book`).set(auth(m.user)).send({ slotIndex: 0 });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('slot_clash');

    // complete (simulate time passing by moving the session into the past)
    await Session.updateOne({ _id: p1.body.session.id }, { scheduledStart: new Date(Date.now() - 3600e3), scheduledEnd: new Date() });
    const done = await api().post(`/api/mentorships/${ms1._id}/sessions/${p1.body.session.id}/complete`).set(auth(m.user)).send({ summary: 'Good session', mentorPrivateNotes: 'Needs work on SQL' });
    expect(done.status).toBe(200);
    const asStudent = await api().get(`/api/mentorships/${ms1._id}/sessions`).set(auth(s1.user));
    expect(JSON.stringify(asStudent.body)).not.toContain('Needs work on SQL');
    const asMentor = await api().get(`/api/mentorships/${ms1._id}/sessions`).set(auth(m.user));
    expect(JSON.stringify(asMentor.body)).toContain('Needs work on SQL');
    const fb = await api().post(`/api/mentorships/${ms1._id}/feedback`).set(auth(s1.user)).send({ rating: 5, sessionId: p1.body.session.id });
    expect(fb.status).toBe(201);
    expect((await api().post(`/api/mentorships/${ms1._id}/feedback`).set(auth(s1.user)).send({ rating: 4, sessionId: p1.body.session.id })).status).toBe(409);
  });

  it('non-participants cannot read a mentorship', async () => {
    const m = await makeMentor();
    const [s1, s2] = await Promise.all([makeStudent(), makeStudent()]);
    const ms = await Mentorship.create({ student: s1.profile._id, alumnus: m.alumnus._id, status: 'active' });
    expect((await api().get(`/api/mentorships/${ms._id}`).set(auth(s2.user))).status).toBe(403);
    expect((await api().get(`/api/messages?mentorshipId=${ms._id}`).set(auth(s2.user))).status).toBe(403);
  });
});

describe('analytics', () => {
  it('programme report is available to staff and placement, not to students', async () => {
    const placement = await makeStaff('placement');
    const s = await makeStudent();
    const rep = await api().get('/api/analytics/programme').set(auth(placement));
    expect(rep.status).toBe(200);
    expect(rep.body.report).toHaveProperty('participation');
    expect(rep.body.report).toHaveProperty('goals.completionRate');
    expect((await api().get('/api/analytics/placement').set(auth(placement))).status).toBe(200);
    expect((await api().get('/api/analytics/mentors').set(auth(placement))).status).toBe(403);
    expect((await api().get('/api/analytics/programme').set(auth(s.user))).status).toBe(403);
    const csv = await api().get('/api/analytics/programme.csv').set(auth(placement));
    expect(csv.text).toContain('participation');
  });
});
