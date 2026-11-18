/**
 * Acceptance criterion: "Mentor capacity limits cannot be exceeded, including under concurrent acceptance."
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MentorCapacity, Mentorship, MentorshipRequest } from '../src/models/index.js';
import { acceptRequest } from '../src/services/requests.js';
import { api, auth, clearDb, makeMentor, makeStudent, pendingRequest, setSettings, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  await setSettings({ 'throttle.maxActiveMentorshipsPerStudent': 5 });
});

async function scenario(maxMentees: number, students: number) {
  const mentor = await makeMentor({ maxMentees, maxPendingRequests: 30 });
  const reqs = [];
  for (let i = 0; i < students; i++) {
    const s = await makeStudent();
    reqs.push(await pendingRequest(s.profile._id, mentor.alumnus._id));
  }
  return { mentor, reqs };
}

describe('capacity under concurrent acceptance', () => {
  it('service layer: exactly maxMentees of N simultaneous accepts succeed (repeated 10 rounds)', async () => {
    for (let round = 0; round < 10; round++) {
      await clearDb();
      await setSettings({ 'throttle.maxActiveMentorshipsPerStudent': 5 });
      const max = (round % 3) + 1; // 1, 2 or 3
      const { mentor, reqs } = await scenario(max, 8);
      const viewer = { id: String(mentor.user._id), role: 'alumnus' as const };
      const results = await Promise.allSettled(reqs.map((r) => acceptRequest(viewer, String(r._id))));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      expect(ok).toBe(max);
      const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      for (const r of rejected) expect(['capacity_full', 'not_pending']).toContain(r.reason.code);
      const cap = await MentorCapacity.findOne({ alumnus: mentor.alumnus._id }).lean();
      expect(cap!.activeCount).toBe(max);
      expect(await Mentorship.countDocuments({ alumnus: mentor.alumnus._id, status: 'active' })).toBe(max);
      expect(await MentorshipRequest.countDocuments({ alumnus: mentor.alumnus._id, status: 'accepted' })).toBe(max);
      expect(await MentorshipRequest.countDocuments({ alumnus: mentor.alumnus._id, status: 'pending' })).toBe(8 - max);
    }
  });

  it('HTTP layer: 10 parallel POST /requests/:id/accept with limit 2 → exactly two 200s', async () => {
    const { mentor, reqs } = await scenario(2, 10);
    const responses = await Promise.all(reqs.map((r) => api().post(`/api/requests/${r._id}/accept`).set(auth(mentor.user))));
    const codes = responses.map((r) => r.status);
    expect(codes.filter((c) => c === 200)).toHaveLength(2);
    expect(codes.filter((c) => c === 409)).toHaveLength(8);
    const cap = await MentorCapacity.findOne({ alumnus: mentor.alumnus._id }).lean();
    expect(cap!.activeCount).toBe(2);
  });

  it('the same request accepted twice concurrently creates only one mentorship and one slot', async () => {
    const { mentor, reqs } = await scenario(3, 1);
    const viewer = { id: String(mentor.user._id), role: 'alumnus' as const };
    const results = await Promise.allSettled([1, 2, 3, 4, 5].map(() => acceptRequest(viewer, String(reqs[0]._id))));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const cap = await MentorCapacity.findOne({ alumnus: mentor.alumnus._id }).lean();
    expect(cap!.activeCount).toBe(1);
    expect(await Mentorship.countDocuments({ alumnus: mentor.alumnus._id })).toBe(1);
  });

  it('a paused mentor cannot accept', async () => {
    const { mentor, reqs } = await scenario(2, 1);
    await MentorCapacity.updateOne({ alumnus: mentor.alumnus._id }, { paused: true });
    const res = await api().post(`/api/requests/${reqs[0]._id}/accept`).set(auth(mentor.user));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('capacity_full');
  });

  it('ending a mentorship frees a slot, which can then be used exactly once', async () => {
    const { mentor, reqs } = await scenario(1, 3);
    const first = await api().post(`/api/requests/${reqs[0]._id}/accept`).set(auth(mentor.user));
    expect(first.status).toBe(200);
    expect((await api().post(`/api/requests/${reqs[1]._id}/accept`).set(auth(mentor.user))).status).toBe(409);
    const end = await api().post(`/api/mentorships/${first.body.mentorshipId}/end`).set(auth(mentor.user)).send({ outcome: 'completed' });
    expect(end.status).toBe(200);
    const both = await Promise.all([reqs[1], reqs[2]].map((r) => api().post(`/api/requests/${r._id}/accept`).set(auth(mentor.user))));
    expect(both.filter((r) => r.status === 200)).toHaveLength(1);
    const cap = await MentorCapacity.findOne({ alumnus: mentor.alumnus._id }).lean();
    expect(cap!.activeCount).toBe(1);
  });

  it('lowering capacity below the active count blocks new acceptances without breaking existing ones', async () => {
    const { mentor, reqs } = await scenario(2, 3);
    await api().post(`/api/requests/${reqs[0]._id}/accept`).set(auth(mentor.user)).expect(200);
    await api().post(`/api/requests/${reqs[1]._id}/accept`).set(auth(mentor.user)).expect(200);
    const res = await api().put('/api/mentors/me/capacity').set(auth(mentor.user)).send({ maxMentees: 1 });
    expect(res.status).toBe(200);
    expect(res.body.note).toMatch(/Existing mentorships continue/);
    expect((await api().post(`/api/requests/${reqs[2]._id}/accept`).set(auth(mentor.user))).status).toBe(409);
    expect(await Mentorship.countDocuments({ alumnus: mentor.alumnus._id, status: 'active' })).toBe(2);
  });
});
