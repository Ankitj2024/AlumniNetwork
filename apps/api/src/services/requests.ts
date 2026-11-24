import { addDays, DAY_MS, type Clock, systemClock } from '../lib/clock.js';
import { badRequest, conflict, forbidden, notFound, tooMany } from '../lib/errors.js';
import { maskContactDetails } from '../lib/mask.js';
import {
  Alumnus,
  CareerGoal,
  DECLINE_REASON_LABELS,
  MentorCapacity,
  Mentorship,
  MentorshipRequest,
  StudentProfile,
  User,
} from '../models/index.js';
import type { Viewer } from '../serializers/index.js';
import { audit } from './audit.js';
import { claimSlot, isAccepting, releaseSlot } from './capacity.js';
import { matchForPair } from './matching.js';
import { notify } from './notify.js';
import { closeUpcomingSessions } from './sessions.js';
import { getSettings } from './settings.js';

export async function studentProfileFor(viewer: Viewer) {
  const p = await StudentProfile.findOne({ user: viewer.id });
  if (!p) throw notFound('Student profile');
  return p;
}
export async function alumnusFor(viewer: Viewer) {
  const a = await Alumnus.findOne({ user: viewer.id });
  if (!a) throw notFound('Alumnus profile');
  return a;
}

/** Current throttle usage for a student — shown in the UI so limits are never a surprise. */
export async function throttleStatus(studentId: unknown, now = new Date()) {
  const s = await getSettings();
  const since = new Date(now.getTime() - s.throttle.periodDays * DAY_MS);
  const [pending, inPeriod, oldestInPeriod, active] = await Promise.all([
    MentorshipRequest.countDocuments({ student: studentId, status: 'pending' }),
    MentorshipRequest.countDocuments({ student: studentId, createdAt: { $gt: since } }),
    MentorshipRequest.findOne({ student: studentId, createdAt: { $gt: since } }).sort({ createdAt: 1 }).lean(),
    Mentorship.countDocuments({ student: studentId, status: 'active' }),
  ]);
  return {
    pending,
    maxPending: s.throttle.maxPendingRequests,
    inPeriod,
    maxPerPeriod: s.throttle.maxRequestsPerPeriod,
    periodDays: s.throttle.periodDays,
    nextSlotAt: inPeriod >= s.throttle.maxRequestsPerPeriod && oldestInPeriod ? new Date(oldestInPeriod.createdAt!.getTime() + s.throttle.periodDays * DAY_MS).toISOString() : null,
    activeMentorships: active,
    maxActiveMentorships: s.throttle.maxActiveMentorshipsPerStudent,
  };
}

export async function createRequest(viewer: Viewer, input: { alumnusId: string; message: string; goalIds?: string[] }, clock: Clock = systemClock) {
  const now = clock();
  const student = await studentProfileFor(viewer);
  const s = await getSettings();

  const goalsCount = await CareerGoal.countDocuments({ student: student._id });
  if (!goalsCount && !(student.targetRoles?.length || student.interests?.length)) {
    throw badRequest('profile_incomplete', 'Add at least one career goal or target role before requesting a mentor, so mentors can see how they can help');
  }

  const alumnus = await Alumnus.findById(input.alumnusId).lean();
  if (!alumnus || alumnus.verificationStatus !== 'verified' || !alumnus.mentorOptIn) throw notFound('Mentor');
  if (!(await User.exists({ _id: alumnus.user, status: 'active' }))) throw notFound('Mentor'); // suspended accounts take no requests

  // --- Student-side throttling (configurable by administrators)
  const t = await throttleStatus(student._id, now);
  if (t.activeMentorships >= t.maxActiveMentorships) {
    throw tooMany('throttle_active', `You already have ${t.activeMentorships} active mentorships (the programme limit is ${t.maxActiveMentorships}).`, t);
  }
  if (t.pending >= t.maxPending) {
    throw tooMany('throttle_pending', `You have ${t.pending} requests awaiting a reply. Wait for a response or withdraw one before sending another.`, t);
  }
  if (t.inPeriod >= t.maxPerPeriod) {
    throw tooMany('throttle_period', `You can send ${t.maxPerPeriod} requests every ${t.periodDays} days. Your next request opens on ${t.nextSlotAt?.slice(0, 10)}.`, t);
  }

  // --- Duplicate / cooldown / already-mentored checks
  const dup = await MentorshipRequest.findOne({ student: student._id, alumnus: alumnus._id, status: 'pending' }).lean();
  if (dup) throw conflict('duplicate_request', 'You already have a pending request with this mentor');
  const recentDecline = await MentorshipRequest.findOne({
    student: student._id,
    alumnus: alumnus._id,
    status: { $in: ['declined', 'expired'] },
    respondedAt: { $gt: new Date(now.getTime() - s.throttle.reRequestCooldownDays * DAY_MS) },
  }).lean();
  if (recentDecline) throw conflict('cooldown', `This mentor wasn't available recently. You can ask them again after ${s.throttle.reRequestCooldownDays} days — try another match meanwhile.`);
  const already = await Mentorship.findOne({ student: student._id, alumnus: alumnus._id, status: 'active' }).lean();
  if (already) throw conflict('already_mentored', 'This mentor is already mentoring you');

  // --- Mentor-side protection
  const cap = await MentorCapacity.findOne({ alumnus: alumnus._id }).lean();
  const mentorPending = await MentorshipRequest.countDocuments({ alumnus: alumnus._id, status: 'pending' });
  if (!isAccepting(cap, mentorPending, now)) throw conflict('mentor_unavailable', 'This mentor is not accepting new requests right now');

  const goalIds = input.goalIds?.length ? (await CareerGoal.find({ _id: { $in: input.goalIds }, student: student._id }).select('_id').lean()).map((g) => g._id) : [];
  const match = await matchForPair(student._id, alumnus._id);
  const { text } = maskContactDetails(input.message);

  const req = await MentorshipRequest.create({
    student: student._id,
    alumnus: alumnus._id,
    message: text,
    goals: goalIds,
    status: 'pending',
    expiresAt: addDays(now, s.requestExpiryDays),
    matchScore: match?.score,
    matchReasons: match?.reasons ?? [],
    createdAt: now,
  });

  // --- Concurrency-safe re-check: if parallel requests slipped past the counts above,
  // keep only the earliest ones within each limit and roll back this one.
  const since = new Date(now.getTime() - s.throttle.periodDays * DAY_MS);
  const [pendingIds, periodIds, mentorPendingIds] = await Promise.all([
    MentorshipRequest.find({ student: student._id, status: 'pending' }).sort({ _id: 1 }).select('_id').lean(),
    MentorshipRequest.find({ student: student._id, createdAt: { $gt: since } }).sort({ _id: 1 }).select('_id').lean(),
    MentorshipRequest.find({ alumnus: alumnus._id, status: 'pending' }).sort({ _id: 1 }).select('_id').lean(),
  ]);
  const idx = (list: any[]) => list.findIndex((x) => String(x._id) === String(req._id));
  if (idx(pendingIds) >= s.throttle.maxPendingRequests || idx(periodIds) >= s.throttle.maxRequestsPerPeriod) {
    await MentorshipRequest.deleteOne({ _id: req._id });
    throw tooMany('throttle_pending', 'Request limit reached. Please wait for a response before sending more.', await throttleStatus(student._id, now));
  }
  if (cap && idx(mentorPendingIds) >= (cap.maxPendingRequests ?? 5)) {
    await MentorshipRequest.deleteOne({ _id: req._id });
    throw conflict('mentor_unavailable', 'This mentor is not accepting new requests right now');
  }

  await audit(viewer, 'request.created', 'MentorshipRequest', req._id, { alumnus: String(alumnus._id) });
  const studentUser = await User.findById(viewer.id).lean();
  await notify(alumnus.user, 'request_new', {
    title: `${studentUser?.name ?? 'A student'} would like you as a mentor`,
    body: `${text.slice(0, 180)}${text.length > 180 ? '…' : ''}\n\nNo pressure — declining takes one click and the student is pointed to other mentors.`,
    link: `/mentor?request=${req._id}`,
    actions: [
      { label: 'Review & accept', href: `/mentor?request=${req._id}` },
      { label: 'Decline', href: `/mentor?request=${req._id}&decline=1` },
    ],
  });
  return req;
}

/** Marks a pending request expired. Returns true if this call did the transition. */
async function expireOne(reqId: unknown, now: Date): Promise<boolean> {
  const r = await MentorshipRequest.findOneAndUpdate(
    { _id: reqId, status: 'pending', expiresAt: { $lte: now } },
    { $set: { status: 'expired', respondedAt: now } },
    { new: true },
  ).lean();
  if (!r) return false;
  const [student, alumnus] = await Promise.all([StudentProfile.findById(r.student).lean(), Alumnus.findById(r.alumnus).populate('user', 'name').lean()]);
  if (student) {
    await notify(student.user, 'request_expired', {
      title: 'A mentor request expired',
      body: `${(alumnus?.user as any)?.name ?? 'The mentor'} wasn't able to respond in time. Mentors are busy professionals — this isn't a judgement on you. Here are other good matches.`,
      link: '/mentors',
    });
  }
  return true;
}

export async function acceptRequest(viewer: Viewer, requestId: string, clock: Clock = systemClock) {
  const now = clock();
  const alumnus = await alumnusFor(viewer);
  const req = await MentorshipRequest.findById(requestId).lean();
  if (!req) throw notFound('Request');
  if (String(req.alumnus) !== String(alumnus._id)) throw forbidden();
  if (req.status !== 'pending') throw conflict('not_pending', `This request is already ${req.status}`);
  // Expiry is enforced at accept time too, so an expired-but-not-yet-swept request can never be accepted.
  if (req.expiresAt <= now) {
    await expireOne(req._id, now);
    throw conflict('expired', 'This request has expired');
  }

  const s = await getSettings();
  const studentActive = await Mentorship.countDocuments({ student: req.student, status: 'active' });
  if (studentActive >= s.throttle.maxActiveMentorshipsPerStudent) {
    throw conflict('student_at_limit', 'This student has since reached the limit of active mentorships');
  }

  // 1) Claim a capacity slot atomically (fails when the mentor is already full or paused).
  if (!(await claimSlot(alumnus._id, now))) {
    throw conflict('capacity_full', 'You are at your mentee limit. Raise your capacity or end a mentorship to accept new mentees.');
  }

  // 2) Transition the request; roll the slot back if someone else changed it first.
  const accepted = await MentorshipRequest.findOneAndUpdate(
    { _id: req._id, status: 'pending', expiresAt: { $gt: now } },
    { $set: { status: 'accepted', respondedAt: now } },
    { new: true },
  ).lean();
  if (!accepted) {
    await releaseSlot(alumnus._id);
    throw conflict('not_pending', 'This request is no longer pending');
  }

  // 3) Create the mentorship; roll everything back on failure.
  let mentorship;
  try {
    mentorship = await Mentorship.create({ student: req.student, alumnus: alumnus._id, request: req._id, status: 'active', startedAt: now, lastActivityAt: now });
  } catch (e) {
    await releaseSlot(alumnus._id);
    await MentorshipRequest.updateOne({ _id: req._id }, { $set: { status: 'pending' }, $unset: { respondedAt: 1 } });
    throw e;
  }

  // Concurrency-safe re-check (as for new requests): two mentors accepting the same student at the
  // same moment both pass the count above. The earliest mentorships within the limit stand; a later
  // one is rolled back, its slot returned, and its request withdrawn like the student's other ones.
  const activeIds = await Mentorship.find({ student: req.student, status: 'active' }).sort({ _id: 1 }).select('_id').lean();
  if (activeIds.findIndex((x) => String(x._id) === String(mentorship._id)) >= s.throttle.maxActiveMentorshipsPerStudent) {
    await Mentorship.deleteOne({ _id: mentorship._id });
    await releaseSlot(alumnus._id);
    await MentorshipRequest.updateOne({ _id: req._id }, { $set: { status: 'withdrawn', respondedAt: now } });
    throw conflict('student_at_limit', 'This student has since reached the limit of active mentorships');
  }

  await audit(viewer, 'request.accepted', 'MentorshipRequest', req._id, { mentorship: String(mentorship._id) });
  const [student, mentorUser] = await Promise.all([StudentProfile.findById(req.student).lean(), User.findById(viewer.id).lean()]);
  if (student) {
    await notify(student.user, 'request_accepted', {
      title: `${mentorUser?.name ?? 'Your mentor'} accepted your request`,
      body: 'Say hello in the mentorship space and propose a first session.',
      link: `/mentorships/${mentorship._id}`,
    });
    // Protect other mentors: once a student reaches their limit, their other open requests are withdrawn.
    const nowActive = studentActive + 1;
    if (nowActive >= s.throttle.maxActiveMentorshipsPerStudent) {
      await MentorshipRequest.updateMany({ student: req.student, status: 'pending' }, { $set: { status: 'withdrawn', respondedAt: now } });
    }
  }
  const cap = await MentorCapacity.findOne({ alumnus: alumnus._id }).lean();
  if (cap && cap.activeCount >= cap.maxMentees) {
    await notify(viewer.id, 'capacity_warning', {
      title: "You're now at full capacity",
      body: "You won't appear in student searches until a slot opens. Any remaining requests can be declined in one click.",
      link: '/mentor',
    }, { email: false });
  }
  return mentorship;
}

export async function declineRequest(viewer: Viewer, requestId: string, reason?: string | null, note?: string | null, clock: Clock = systemClock) {
  const now = clock();
  const alumnus = await alumnusFor(viewer);
  const r = await MentorshipRequest.findOneAndUpdate(
    { _id: requestId, alumnus: alumnus._id, status: 'pending' },
    { $set: { status: 'declined', respondedAt: now, declineReason: reason ?? null, declineNote: note ? maskContactDetails(note).text : undefined } },
    { new: true },
  ).lean();
  if (!r) throw conflict('not_pending', 'This request is no longer pending');
  await audit(viewer, 'request.declined', 'MentorshipRequest', r._id, { reason });
  const student = await StudentProfile.findById(r.student).lean();
  const mentorUser = await User.findById(viewer.id).lean();
  if (student) {
    const why = reason ? ` (${(DECLINE_REASON_LABELS as any)[reason] ?? reason})` : '';
    await notify(student.user, 'request_declined', {
      title: `${mentorUser?.name ?? 'The mentor'} can't take this on right now${why}`,
      body: `${r.declineNote ? `“${r.declineNote}”\n\n` : ''}Your request slot is free again — here are other mentors who match your goals.`,
      link: '/mentors',
    });
  }
  return r;
}

/** One-click "decline all" for mentors who are full or stepping back. */
export async function declineAllPending(viewer: Viewer, reason?: string | null) {
  const alumnus = await alumnusFor(viewer);
  const pending = await MentorshipRequest.find({ alumnus: alumnus._id, status: 'pending' }).select('_id').lean();
  let n = 0;
  for (const p of pending) {
    try {
      await declineRequest(viewer, String(p._id), reason ?? 'at_capacity', null);
      n++;
    } catch {
      /* already handled concurrently */
    }
  }
  return n;
}

export async function withdrawRequest(viewer: Viewer, requestId: string) {
  const student = await studentProfileFor(viewer);
  const r = await MentorshipRequest.findOneAndUpdate(
    { _id: requestId, student: student._id, status: 'pending' },
    { $set: { status: 'withdrawn', respondedAt: new Date() } },
    { new: true },
  ).lean();
  if (!r) throw conflict('not_pending', 'This request is no longer pending');
  await audit(viewer, 'request.withdrawn', 'MentorshipRequest', r._id);
  return r;
}

/** Sweep job (every 10 minutes): expire pending requests whose expiresAt has passed. Idempotent. */
export async function expireRequests(clock: Clock = systemClock): Promise<number> {
  const now = clock();
  const due = await MentorshipRequest.find({ status: 'pending', expiresAt: { $lte: now } }).select('_id').lean();
  let n = 0;
  for (const d of due) if (await expireOne(d._id, now)) n++;
  return n;
}

export async function endMentorship(viewer: Viewer, mentorshipId: string, outcome: 'completed' | 'ended', reason?: string) {
  const m = await Mentorship.findOneAndUpdate(
    { _id: mentorshipId, status: 'active' },
    { $set: { status: outcome, endedAt: new Date(), endReason: reason, endedBy: viewer.id } },
    { new: true },
  ).lean();
  if (!m) throw conflict('not_active', 'This mentorship is not active');
  await releaseSlot(m.alumnus);
  // Nothing in a closed mentorship can go ahead: open proposals, holds and booked sessions are cancelled (paid ones refunded).
  await closeUpcomingSessions(m._id, viewer.id, 'The mentorship ended');
  await audit(viewer, `mentorship.${outcome}`, 'Mentorship', m._id, { reason });
  const [student, alumnus] = await Promise.all([StudentProfile.findById(m.student).lean(), Alumnus.findById(m.alumnus).lean()]);
  for (const uid of [student?.user, alumnus?.user].filter(Boolean)) {
    await notify(uid, 'feedback_request', {
      title: outcome === 'completed' ? 'Mentorship completed — share closing feedback' : 'Mentorship ended — share closing feedback',
      body: 'Two minutes of feedback helps the programme improve.',
      link: `/mentorships/${m._id}?tab=feedback`,
    });
  }
  return m;
}
