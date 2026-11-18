import { env } from '../config/env.js';
import { HOUR_MS, type Clock, systemClock } from '../lib/clock.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { CalendarConnection, Mentorship, Session } from '../models/index.js';
import type { Viewer } from '../serializers/index.js';
import { mentorshipAccess, touchMentorship } from './access.js';
import { audit } from './audit.js';
import { createExternalEvent, deleteExternalEvent, jitsiLink, type Provider } from './calendar.js';
import { notify } from './notify.js';

type Slot = { start: Date; end: Date };

function validateSlots(slots: Slot[], now: Date) {
  if (!slots.length || slots.length > 5) throw badRequest('invalid_slots', 'Propose between 1 and 5 time slots');
  for (const s of slots) {
    if (!(s.start instanceof Date) || isNaN(s.start.getTime()) || isNaN(s.end.getTime())) throw badRequest('invalid_slots', 'Invalid slot time');
    if (s.start <= now) throw badRequest('invalid_slots', 'Slots must be in the future');
    const mins = (s.end.getTime() - s.start.getTime()) / 60000;
    if (mins < 15 || mins > 180) throw badRequest('invalid_slots', 'Sessions must be between 15 minutes and 3 hours');
  }
}

/** Mentor's time is protected: no two scheduled sessions may overlap across all their mentorships. */
async function assertNoMentorClash(alumnusId: unknown, slot: Slot, excludeSessionId?: unknown) {
  const ms = await Mentorship.find({ alumnus: alumnusId }).select('_id').lean();
  const clash = await Session.findOne({
    mentorship: { $in: ms.map((m) => m._id) },
    status: 'scheduled',
    _id: { $ne: excludeSessionId },
    scheduledStart: { $lt: slot.end },
    scheduledEnd: { $gt: slot.start },
  }).lean();
  if (clash) throw conflict('slot_clash', 'The mentor already has a session booked at that time');
}

export async function proposeSession(viewer: Viewer, mentorshipId: string, input: { slots: Slot[]; title?: string; agenda?: string }, clock: Clock = systemClock) {
  const acc = await mentorshipAccess(viewer, mentorshipId, { write: true });
  if (acc.mentorship.status !== 'active') throw conflict('not_active', 'This mentorship is not active');
  validateSlots(input.slots, clock());
  const s = await Session.create({
    mentorship: acc.mentorship._id,
    proposedBy: viewer.id,
    proposedSlots: input.slots,
    title: input.title || 'Mentoring session',
    agenda: input.agenda,
    status: 'proposed',
  });
  await touchMentorship(acc.mentorship._id, clock());
  await notify(acc.counterpartUserId, 'session_proposed', {
    title: 'New session times proposed',
    body: `${input.slots.length} time option${input.slots.length > 1 ? 's' : ''} — pick the one that works for you.`,
    link: `/mentorships/${mentorshipId}?tab=sessions`,
  });
  return s;
}

export async function bookSession(viewer: Viewer, mentorshipId: string, sessionId: string, slotIndex: number, clock: Clock = systemClock) {
  const acc = await mentorshipAccess(viewer, mentorshipId, { write: true });
  const s = await Session.findOne({ _id: sessionId, mentorship: acc.mentorship._id });
  if (!s) throw notFound('Session');
  if (s.status !== 'proposed') throw conflict('not_proposed', 'This session is not awaiting a booking');
  if (String(s.proposedBy) === viewer.id) throw forbidden('The other participant picks a slot from your proposal');
  const slot = s.proposedSlots[slotIndex];
  if (!slot?.start || !slot.end) throw badRequest('invalid_slot', 'Choose one of the proposed slots');
  if (slot.start <= clock()) throw badRequest('slot_past', 'That slot is already in the past — ask for new times');
  await assertNoMentorClash(acc.mentorship.alumnus, { start: slot.start, end: slot.end }, s._id);

  s.status = 'scheduled';
  s.scheduledStart = slot.start;
  s.scheduledEnd = slot.end;
  s.videoLink = jitsiLink();

  // Calendar sync for each participant who connected a calendar (own calendar, no attendee list).
  const ev = { title: s.title ?? 'Mentoring session', description: s.agenda ?? 'Alumni mentoring session', start: slot.start, end: slot.end, videoLink: s.videoLink, wantMeet: env.videoProvider === 'google_meet' };
  const conns = await CalendarConnection.find({ user: { $in: [acc.mentorUserId, acc.studentUserId] } }).lean();
  const external: any[] = [];
  for (const c of conns) {
    const r = await createExternalEvent(String(c.user), c.provider as Provider, ev);
    if (r) {
      external.push({ provider: c.provider, userId: c.user, eventId: r.eventId });
      if (r.meetLink && env.videoProvider === 'google_meet') s.videoLink = r.meetLink;
    }
  }
  s.externalEvents = external as any;
  await s.save();
  await touchMentorship(acc.mentorship._id, clock());
  await audit(viewer, 'session.scheduled', 'Session', s._id);

  const when = slot.start.toUTCString();
  for (const uid of [acc.mentorUserId, acc.studentUserId]) {
    await notify(uid, 'session_scheduled', {
      title: 'Mentoring session confirmed',
      body: `${s.title} — ${when}. Video link and calendar file are on the session page.`,
      link: `/mentorships/${mentorshipId}?tab=sessions`,
    });
  }
  return s;
}

export async function cancelSession(viewer: Viewer, mentorshipId: string, sessionId: string, reason?: string) {
  const acc = await mentorshipAccess(viewer, mentorshipId, { write: true });
  const s = await Session.findOne({ _id: sessionId, mentorship: acc.mentorship._id });
  if (!s) throw notFound('Session');
  if (!['proposed', 'scheduled'].includes(s.status)) throw conflict('not_cancellable', 'Only upcoming sessions can be cancelled');
  s.status = 'cancelled';
  s.cancelledBy = viewer.id as any;
  s.cancelReason = reason;
  for (const e of s.externalEvents ?? []) await deleteExternalEvent(String(e.userId), e.provider as Provider, String(e.eventId));
  await s.save();
  await notify(acc.counterpartUserId, 'session_cancelled', { title: 'A session was cancelled', body: reason ?? undefined, link: `/mentorships/${mentorshipId}?tab=sessions` });
  return s;
}

export async function completeSession(
  viewer: Viewer,
  mentorshipId: string,
  sessionId: string,
  input: { outcome: 'completed' | 'no_show'; summary?: string; mentorPrivateNotes?: string },
  clock: Clock = systemClock,
) {
  const acc = await mentorshipAccess(viewer, mentorshipId, { write: true });
  const s = await Session.findOne({ _id: sessionId, mentorship: acc.mentorship._id }).select('+mentorPrivateNotes');
  if (!s) throw notFound('Session');
  if (s.status !== 'scheduled') throw conflict('not_scheduled', 'Only scheduled sessions can be logged');
  if (s.scheduledStart && s.scheduledStart.getTime() > clock().getTime() + HOUR_MS / 4) throw badRequest('too_early', 'You can log a session once it has started');
  s.status = input.outcome;
  s.summary = input.summary;
  if (acc.isMentor && input.mentorPrivateNotes !== undefined) s.mentorPrivateNotes = input.mentorPrivateNotes;
  s.completedAt = clock();
  await s.save();
  await touchMentorship(acc.mentorship._id, clock());
  await audit(viewer, `session.${input.outcome}`, 'Session', s._id);
  if (input.outcome === 'completed') {
    for (const uid of [acc.mentorUserId, acc.studentUserId]) {
      await notify(uid, 'feedback_request', {
        title: 'How did the session go?',
        body: 'Rate the session in under a minute — it helps both of you and the programme.',
        link: `/mentorships/${mentorshipId}?tab=feedback&session=${s._id}`,
      }, { email: false });
    }
  }
  return s;
}

/** Reminder job (every 5 minutes): 24h and 1h reminders for scheduled sessions. */
export async function sendSessionReminders(clock: Clock = systemClock): Promise<number> {
  const now = clock();
  let sent = 0;
  const windows: { field: 'reminder24hSentAt' | 'reminder1hSentAt'; ahead: number; label: string }[] = [
    { field: 'reminder24hSentAt', ahead: 24 * HOUR_MS, label: 'tomorrow' },
    { field: 'reminder1hSentAt', ahead: HOUR_MS, label: 'in about an hour' },
  ];
  for (const w of windows) {
    const due = await Session.find({ status: 'scheduled', scheduledStart: { $gt: now, $lte: new Date(now.getTime() + w.ahead) }, [w.field]: { $exists: false } }).lean();
    for (const s of due) {
      const claimed = await Session.findOneAndUpdate({ _id: s._id, [w.field]: { $exists: false } }, { $set: { [w.field]: now } });
      if (!claimed) continue;
      const m = await Mentorship.findById(s.mentorship).populate('student', 'user').populate('alumnus', 'user').lean();
      if (!m) continue;
      for (const uid of [(m.student as any)?.user, (m.alumnus as any)?.user]) {
        await notify(uid, 'session_reminder', {
          title: `Reminder: mentoring session ${w.label}`,
          body: `${s.title} at ${s.scheduledStart!.toUTCString()}`,
          link: `/mentorships/${m._id}?tab=sessions`,
        });
      }
      sent++;
    }
  }
  return sent;
}
