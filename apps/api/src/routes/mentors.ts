import { Router } from 'express';
import { z } from 'zod';
import { badRequest, notFound } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ah, oid, parse } from '../middleware/common.js';
import { Alumnus, AvailabilityWindow, MENTORING_AREAS, MentorCapacity, Mentorship, MentorshipRequest, StudentProfile } from '../models/index.js';
import { availabilityView, capacityView, mentorPublic } from '../serializers/index.js';
import { audit } from '../services/audit.js';
import { isAccepting } from '../services/capacity.js';
import { matchForPair, searchMentors } from '../services/matching.js';
import { alumnusFor } from '../services/requests.js';
import { getSettings } from '../services/settings.js';

const r = Router();

const list = (v: unknown) => (typeof v === 'string' && v ? v.split(',').map((x) => x.trim()).filter(Boolean) : Array.isArray(v) ? (v as string[]) : undefined);

/* -------------------------------------------- discovery & matching (M4) */
r.get(
  '/search',
  requireAuth,
  ah(async (req, res) => {
    const q = req.query;
    const filters = {
      q: typeof q.q === 'string' ? q.q.slice(0, 100) : undefined,
      industries: list(q.industries),
      tags: list(q.tags),
      areas: list(q.areas),
      department: typeof q.department === 'string' && q.department ? q.department : undefined,
      minYears: q.minYears ? Number(q.minYears) : undefined,
      hasCapacity: q.hasCapacity === undefined ? true : q.hasCapacity !== 'false',
      sort: (['relevance', 'experience', 'capacity'] as const).find((s) => s === q.sort),
      limit: q.limit ? Number(q.limit) : 20,
      offset: q.offset ? Number(q.offset) : 0,
    };
    let studentProfileId: string | undefined;
    if (req.viewer!.role === 'student') {
      const p = await StudentProfile.findOne({ user: req.viewer!.id }).select('_id').lean();
      studentProfileId = p ? String(p._id) : undefined;
    }
    const { total, rows, facets } = await searchMentors(filters, studentProfileId);
    res.json({
      total,
      facets,
      mentors: rows.map((x) => mentorPublic(x.alumnus, { capacity: x.cap, match: x.match ? { score: x.match.score, reasons: x.match.reasons, breakdown: x.match.breakdown } : undefined })),
    });
  }),
);

/* -------------------------------------------- own capacity & availability (M2) */
r.get(
  '/me/capacity',
  requireRole('alumnus'),
  ah(async (req, res) => {
    const a = await alumnusFor(req.viewer!);
    const [cap, pending] = await Promise.all([MentorCapacity.findOne({ alumnus: a._id }).lean(), MentorshipRequest.countDocuments({ alumnus: a._id, status: 'pending' })]);
    res.json({
      capacity: cap ? { ...capacityView(cap), maxPendingRequests: cap.maxPendingRequests, pendingRequests: pending, pauseReason: cap.pauseReason ?? null, visibleInDiscovery: isAccepting(cap, pending) && a.verificationStatus === 'verified' && a.mentorOptIn } : null,
    });
  }),
);

r.put(
  '/me/capacity',
  requireRole('alumnus'),
  ah(async (req, res) => {
    const b = parse(z.object({ maxMentees: z.number().int().min(0).max(10), maxPendingRequests: z.number().int().min(1).max(20).optional() }), req.body);
    const a = await alumnusFor(req.viewer!);
    if (a.verificationStatus !== 'verified') throw badRequest('not_verified', 'Capacity can be set once your alumni status is verified');
    const cap = await MentorCapacity.findOneAndUpdate(
      { alumnus: a._id },
      { $set: { maxMentees: b.maxMentees, ...(b.maxPendingRequests ? { maxPendingRequests: b.maxPendingRequests } : {}) } },
      { new: true, upsert: true },
    ).lean();
    await audit(req.viewer!, 'capacity.updated', 'MentorCapacity', cap!._id, b);
    // Lowering below the current count is allowed: existing mentees continue, no new ones are accepted.
    res.json({ capacity: capacityView(cap), note: cap!.activeCount > cap!.maxMentees ? 'You have more active mentees than your new limit. Existing mentorships continue; no new ones will be offered.' : undefined });
  }),
);

r.post(
  '/me/pause',
  requireRole('alumnus'),
  ah(async (req, res) => {
    const b = parse(z.object({ until: z.coerce.date().optional(), reason: z.string().trim().max(200).optional() }), req.body);
    const a = await alumnusFor(req.viewer!);
    const cap = await MentorCapacity.findOneAndUpdate({ alumnus: a._id }, { $set: { paused: true, pausedUntil: b.until, pauseReason: b.reason } }, { new: true, upsert: true }).lean();
    await audit(req.viewer!, 'capacity.paused', 'MentorCapacity', cap!._id, b);
    res.json({ capacity: capacityView(cap) });
  }),
);

r.post(
  '/me/resume',
  requireRole('alumnus'),
  ah(async (req, res) => {
    const a = await alumnusFor(req.viewer!);
    const cap = await MentorCapacity.findOneAndUpdate({ alumnus: a._id }, { $set: { paused: false }, $unset: { pausedUntil: 1, pauseReason: 1 } }, { new: true }).lean();
    await audit(req.viewer!, 'capacity.resumed', 'MentorCapacity', cap?._id);
    res.json({ capacity: capacityView(cap) });
  }),
);

r.get(
  '/me/availability',
  requireRole('alumnus'),
  ah(async (req, res) => {
    const a = await alumnusFor(req.viewer!);
    const w = await AvailabilityWindow.find({ alumnus: a._id }).sort({ dayOfWeek: 1, startMinute: 1 }).lean();
    res.json({ availability: w.map(availabilityView) });
  }),
);

r.put(
  '/me/availability',
  requireRole('alumnus'),
  ah(async (req, res) => {
    const b = parse(
      z.object({
        windows: z
          .array(
            z
              .object({ dayOfWeek: z.number().int().min(0).max(6), startMinute: z.number().int().min(0).max(1439), endMinute: z.number().int().min(1).max(1440), timezone: z.string().max(60).default('Asia/Kolkata') })
              .refine((w) => w.endMinute > w.startMinute, 'End must be after start'),
          )
          .max(21),
      }),
      req.body,
    );
    const a = await alumnusFor(req.viewer!);
    await AvailabilityWindow.deleteMany({ alumnus: a._id });
    const created = await AvailabilityWindow.insertMany(b.windows.map((w) => ({ ...w, alumnus: a._id })));
    res.json({ availability: created.map((x) => availabilityView(x.toObject())) });
  }),
);

/* ------------------------------------------------------- mentor profile */
r.get(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const a = await Alumnus.findOne({ _id: oid(req.params.id, 'Mentor'), verificationStatus: 'verified' }).populate('user', 'name status').populate('expertise').lean();
    // Staff can still open a suspended mentor's profile; students and other alumni cannot.
    if (!a || ((a.user as any)?.status !== 'active' && !['aro', 'admin'].includes(req.viewer!.role))) throw notFound('Mentor');
    const [cap, windows, pending] = await Promise.all([
      MentorCapacity.findOne({ alumnus: a._id }).lean(),
      AvailabilityWindow.find({ alumnus: a._id }).sort({ dayOfWeek: 1, startMinute: 1 }).lean(),
      MentorshipRequest.countDocuments({ alumnus: a._id, status: 'pending' }),
    ]);
    let match;
    let requestState: Record<string, unknown> | undefined;
    if (req.viewer!.role === 'student') {
      const p = await StudentProfile.findOne({ user: req.viewer!.id }).lean();
      if (p) {
        const m = await matchForPair(p._id, a._id);
        match = m ? { score: m.score, reasons: m.reasons, breakdown: m.breakdown } : undefined;
        const s = await getSettings();
        const [pendingReq, active, recent] = await Promise.all([
          MentorshipRequest.findOne({ student: p._id, alumnus: a._id, status: 'pending' }).lean(),
          Mentorship.findOne({ student: p._id, alumnus: a._id, status: 'active' }).lean(),
          MentorshipRequest.findOne({ student: p._id, alumnus: a._id, status: { $in: ['declined', 'expired'] }, respondedAt: { $gt: new Date(Date.now() - s.throttle.reRequestCooldownDays * 864e5) } }).lean(),
        ]);
        requestState = {
          pendingRequestId: pendingReq ? String(pendingReq._id) : null,
          mentorshipId: active ? String(active._id) : null,
          cooldownUntil: recent?.respondedAt ? new Date(recent.respondedAt.getTime() + s.throttle.reRequestCooldownDays * 864e5).toISOString() : null,
        };
      }
    }
    res.json({
      mentor: mentorPublic(a, { capacity: cap, availability: windows, match }),
      accepting: isAccepting(cap, pending),
      requestState,
    });
  }),
);

export default r;
