/** The session pass: the next meeting (with its link) on each mentorship, for participants only. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Mentorship, Session } from '../src/models/index.js';
import { api, auth, clearDb, makeMentor, makeStaff, makeStudent, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

async function setup() {
  const mentor = await makeMentor({ maxMentees: 5 });
  const student = await makeStudent();
  const m = await Mentorship.create({ student: student.profile._id, alumnus: mentor.alumnus._id });
  proposer = mentor.user._id;
  return { mentor, student, m };
}

let proposer: unknown;
function session(mentorship: unknown, startOffsetMin: number, minutes: number, extra: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + startOffsetMin * 60e3);
  return Session.create({ mentorship, proposedBy: proposer, status: 'scheduled', scheduledStart: start, scheduledEnd: new Date(start.getTime() + minutes * 60e3), videoLink: `https://meet.jit.si/AMN-test-${startOffsetMin}`, title: 'Mock interview', ...extra });
}

describe('next meeting on the mentorship list', () => {
  it('student and mentor both get the soonest meeting, with its link', async () => {
    const { mentor, student, m } = await setup();
    await session(m._id, 3 * 24 * 60, 45);
    const soon = await session(m._id, 60, 45);
    for (const user of [student.user, mentor.user]) {
      const res = await api().get('/api/mentorships').set(auth(user));
      expect(res.status).toBe(200);
      expect(res.body.mentorships[0].nextMeeting).toMatchObject({ id: String(soon._id), title: 'Mock interview', videoLink: 'https://meet.jit.si/AMN-test-60' });
    }
  });

  it('a meeting already in progress still counts until it ends', async () => {
    const { student, m } = await setup();
    const live = await session(m._id, -10, 45); // started 10 minutes ago
    const res = await api().get('/api/mentorships').set(auth(student.user));
    expect(res.body.mentorships[0].nextMeeting.id).toBe(String(live._id));
    // nextSessionAt keeps its meaning: the next one that hasn't started yet
    expect(res.body.mentorships[0].nextSessionAt).toBeNull();
  });

  it('ended, cancelled and unconfirmed sessions are not meetings to join', async () => {
    const { student, m } = await setup();
    await session(m._id, -120, 45); // ended
    await session(m._id, 60, 45, { status: 'cancelled' });
    await session(m._id, 90, 45, { status: 'proposed' });
    const res = await api().get('/api/mentorships').set(auth(student.user));
    expect(res.body.mentorships[0].nextMeeting).toBeNull();
  });

  it('staff never receive meeting links', async () => {
    const { m } = await setup();
    await session(m._id, 60, 45);
    const aro = await makeStaff('aro');
    const res = await api().get('/api/mentorships').set(auth(aro));
    expect(res.status).toBe(200);
    expect(res.body.mentorships[0]).not.toHaveProperty('nextMeeting');
    expect(JSON.stringify(res.body)).not.toContain('meet.jit.si');
  });
});
