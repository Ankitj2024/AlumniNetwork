import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { conflict } from '../lib/errors.js';
import { maskContactDetails } from '../lib/mask.js';
import { emitToMentorship } from '../lib/realtime.js';
import { requireAuth } from '../middleware/auth.js';
import { ah, oid, parse } from '../middleware/common.js';
import { Alumnus, Message, Mentorship, StudentProfile, User } from '../models/index.js';
import { messageView } from '../serializers/index.js';
import { mentorshipAccess, touchMentorship } from '../services/access.js';
import { notify } from '../services/notify.js';

/**
 * In-platform messaging (M9). Message bodies are masked BEFORE storage, so emails, phone numbers and
 * social links typed into a message never reach the database, the counterpart, or a socket.
 */
const r = Router();
r.use(requireAuth);

export async function postMessage(viewer: { id: string; role: any }, mentorshipId: string, body: string) {
  const acc = await mentorshipAccess(viewer as any, mentorshipId, { write: true });
  if (acc.mentorship.status !== 'active') throw conflict('not_active', 'This mentorship has ended; messaging is closed');
  const { text, count } = maskContactDetails(body.trim());
  const m = await Message.create({ mentorship: acc.mentorship._id, sender: viewer.id, senderRole: acc.isMentor ? 'mentor' : 'student', body: text, maskedCount: count });
  await touchMentorship(acc.mentorship._id);
  const view = messageView(m.toObject());
  emitToMentorship(String(acc.mentorship._id), 'message', view);

  // Notify the counterpart in-app (no email per message — avoids flooding busy mentors).
  const sender = await User.findById(viewer.id).lean();
  await notify(acc.counterpartUserId, 'message', { title: `New message from ${sender?.name ?? 'your mentoring partner'}`, body: text.slice(0, 120), link: `/mentorships/${mentorshipId}?tab=messages` }, { email: false });
  return { view, masked: count };
}

r.get(
  '/',
  ah(async (req, res) => {
    const q = parse(z.object({ mentorshipId: z.string(), before: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query);
    const acc = await mentorshipAccess(req.viewer!, String(oid(q.mentorshipId, 'Mentorship')));
    const filter: Record<string, unknown> = { mentorship: acc.mentorship._id };
    if (q.before) filter.createdAt = { $lt: q.before };
    const list = await Message.find(filter).sort({ createdAt: -1 }).limit(q.limit).lean();
    res.json({ messages: list.reverse().map(messageView) });
  }),
);

r.post(
  '/',
  ah(async (req, res) => {
    const b = parse(z.object({ mentorshipId: z.string(), body: z.string().trim().min(1).max(4000) }), req.body);
    const { view, masked } = await postMessage(req.viewer!, String(oid(b.mentorshipId, 'Mentorship')), b.body);
    res.status(201).json({ message: view, notice: masked ? 'Contact details were hidden. Please keep conversations on the platform.' : undefined });
  }),
);

r.post(
  '/read',
  ah(async (req, res) => {
    const b = parse(z.object({ mentorshipId: z.string() }), req.body);
    const acc = await mentorshipAccess(req.viewer!, String(oid(b.mentorshipId, 'Mentorship')), { write: true });
    const r2 = await Message.updateMany({ mentorship: acc.mentorship._id, sender: { $ne: req.viewer!.id }, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
    res.json({ marked: r2.modifiedCount });
  }),
);

r.get(
  '/unread',
  ah(async (req, res) => {
    const v = req.viewer!;
    let ids: mongoose.Types.ObjectId[] = [];
    if (v.role === 'student') {
      const p = await StudentProfile.findOne({ user: v.id }).lean();
      ids = p ? (await Mentorship.find({ student: p._id }).select('_id').lean()).map((m) => m._id) : [];
    } else if (v.role === 'alumnus') {
      const a = await Alumnus.findOne({ user: v.id }).lean();
      ids = a ? (await Mentorship.find({ alumnus: a._id }).select('_id').lean()).map((m) => m._id) : [];
    }
    const agg = await Message.aggregate([
      { $match: { mentorship: { $in: ids }, sender: { $ne: new mongoose.Types.ObjectId(v.id) }, readAt: { $exists: false } } },
      { $group: { _id: '$mentorship', n: { $sum: 1 } } },
    ]);
    res.json({ unread: Object.fromEntries(agg.map((a: any) => [String(a._id), a.n])) });
  }),
);

export default r;
