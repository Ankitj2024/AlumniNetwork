/**
 * Acceptance criterion: "Student request throttling enforced and configurable."
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MentorshipRequest } from '../src/models/index.js';
import { api, auth, clearDb, makeMentor, makeStaff, makeStudent, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const msg = 'I would love your guidance on preparing for software engineering interviews.';
const send = (student: any, alumnusId: unknown) => api().post('/api/requests').set(auth(student)).send({ alumnusId: String(alumnusId), message: msg });

describe('request throttling', () => {
  it('default: a 4th pending request is rejected with 429 throttle_pending', async () => {
    const s = await makeStudent();
    const mentors = await Promise.all([1, 2, 3, 4].map(() => makeMentor()));
    for (let i = 0; i < 3; i++) expect((await send(s.user, mentors[i].alumnus._id)).status).toBe(201);
    const res = await send(s.user, mentors[3].alumnus._id);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('throttle_pending');
    expect(res.body.error.details).toMatchObject({ pending: 3, maxPending: 3 });
  });

  it('withdrawing frees a pending slot but still counts toward the period limit', async () => {
    const s = await makeStudent();
    const mentors = await Promise.all([1, 2, 3, 4, 5, 6].map(() => makeMentor()));
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await send(s.user, mentors[i].alumnus._id)).body.request.id);
    await api().post(`/api/requests/${ids[0]}/withdraw`).set(auth(s.user)).expect(200);
    expect((await send(s.user, mentors[3].alumnus._id)).status).toBe(201); // 4 in period
    await api().post(`/api/requests/${ids[1]}/withdraw`).set(auth(s.user)).expect(200);
    expect((await send(s.user, mentors[4].alumnus._id)).status).toBe(201); // 5 in period (default limit 5)
    await api().post(`/api/requests/${ids[2]}/withdraw`).set(auth(s.user)).expect(200);
    const res = await send(s.user, mentors[5].alumnus._id);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('throttle_period');
  });

  it('is configurable by an administrator via PUT /admin/settings', async () => {
    const admin = await makeStaff('admin');
    const s = await makeStudent();
    const mentors = await Promise.all([1, 2, 3].map(() => makeMentor()));
    const upd = await api().put('/api/admin/settings').set(auth(admin)).send({ throttle: { maxPendingRequests: 1 } });
    expect(upd.status).toBe(200);
    expect(upd.body.settings.throttle.maxPendingRequests).toBe(1);
    expect((await send(s.user, mentors[0].alumnus._id)).status).toBe(201);
    expect((await send(s.user, mentors[1].alumnus._id)).status).toBe(429);

    await api().put('/api/admin/settings').set(auth(admin)).send({ throttle: { maxPendingRequests: 10, maxRequestsPerPeriod: 2 } }).expect(200);
    expect((await send(s.user, mentors[1].alumnus._id)).status).toBe(201);
    const res = await send(s.user, mentors[2].alumnus._id);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('throttle_period');
  });

  it('only administrators can change throttle settings', async () => {
    const s = await makeStudent();
    const aro = await makeStaff('aro');
    expect((await api().put('/api/admin/settings').set(auth(s.user)).send({ throttle: { maxPendingRequests: 50 } })).status).toBe(403);
    expect((await api().put('/api/admin/settings').set(auth(aro)).send({ throttle: { maxPendingRequests: 50 } })).status).toBe(403);
  });

  it('holds under concurrency: 8 simultaneous requests with limit 3 create at most 3', async () => {
    const s = await makeStudent();
    const mentors = await Promise.all(Array.from({ length: 8 }, () => makeMentor()));
    const res = await Promise.all(mentors.map((m) => send(s.user, m.alumnus._id)));
    const created = res.filter((r) => r.status === 201).length;
    expect(created).toBeLessThanOrEqual(3);
    expect(created).toBeGreaterThanOrEqual(1);
    expect(await MentorshipRequest.countDocuments({ student: s.profile._id, status: 'pending' })).toBe(created);
  });

  it('rejects duplicate pending requests to the same mentor', async () => {
    const s = await makeStudent();
    const m = await makeMentor();
    expect((await send(s.user, m.alumnus._id)).status).toBe(201);
    const res = await send(s.user, m.alumnus._id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('duplicate_request');
  });

  it('enforces a cooldown after a decline', async () => {
    const s = await makeStudent();
    const m = await makeMentor();
    const id = (await send(s.user, m.alumnus._id)).body.request.id;
    await api().post(`/api/requests/${id}/decline`).set(auth(m.user)).send({}).expect(200);
    const res = await send(s.user, m.alumnus._id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('cooldown');
  });

  it('protects mentors: once their request inbox is full they stop accepting new requests', async () => {
    const m = await makeMentor({ maxPendingRequests: 2 });
    const students = await Promise.all([1, 2, 3].map(() => makeStudent()));
    expect((await send(students[0].user, m.alumnus._id)).status).toBe(201);
    expect((await send(students[1].user, m.alumnus._id)).status).toBe(201);
    const res = await send(students[2].user, m.alumnus._id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('mentor_unavailable');
  });

  it('mentor-side inbox limit holds under concurrency', async () => {
    const m = await makeMentor({ maxPendingRequests: 2 });
    const students = await Promise.all(Array.from({ length: 6 }, () => makeStudent()));
    await Promise.all(students.map((s) => send(s.user, m.alumnus._id)));
    expect(await MentorshipRequest.countDocuments({ alumnus: m.alumnus._id, status: 'pending' })).toBeLessThanOrEqual(2);
  });
});
