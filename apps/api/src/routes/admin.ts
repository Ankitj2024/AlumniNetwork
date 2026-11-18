import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/errors.js';
import { requireRole } from '../middleware/auth.js';
import { ah, oid, parse } from '../middleware/common.js';
import { Alumnus, AuditLog, MentorCapacity, Mentorship, MentorshipRequest, Settings, StudentProfile, User, VerificationRequest } from '../models/index.js';
import { capacityView, mentorshipView, staffUser } from '../serializers/index.js';
import { audit } from '../services/audit.js';
import { runEngagementDecay } from '../services/engagement.js';
import { expireRequests } from '../services/requests.js';
import { getSettings, settingsView } from '../services/settings.js';

const r = Router();

/* --------------------------------------------- programme settings (admin) */
r.get(
  '/settings',
  requireRole('admin', 'aro'),
  ah(async (_req, res) => {
    res.json({ settings: settingsView(await getSettings()) });
  }),
);

const weight = z.number().min(0).max(100);
r.put(
  '/settings',
  requireRole('admin'),
  ah(async (req, res) => {
    const b = parse(
      z.object({
        matchingWeights: z.object({ expertise: weight, targetRole: weight, industry: weight, mentoringAreas: weight, department: weight, availability: weight, loadBalance: weight }).partial().optional(),
        throttle: z
          .object({
            maxPendingRequests: z.number().int().min(1).max(20),
            maxRequestsPerPeriod: z.number().int().min(1).max(50),
            periodDays: z.number().int().min(1).max(90),
            reRequestCooldownDays: z.number().int().min(0).max(365),
            maxActiveMentorshipsPerStudent: z.number().int().min(1).max(10),
          })
          .partial()
          .optional(),
        requestExpiryDays: z.number().int().min(1).max(60).optional(),
        engagement: z.object({ atRiskDays: z.number().int().min(3).max(90), lapsedDays: z.number().int().min(7).max(180), nudgeCooldownDays: z.number().int().min(1).max(60) }).partial().optional(),
        verification: z.object({ autoApproveExactMatch: z.boolean() }).partial().optional(),
      }),
      req.body,
    );
    const set: Record<string, unknown> = { updatedBy: req.viewer!.id };
    for (const [group, val] of Object.entries(b)) {
      if (val && typeof val === 'object') for (const [k, v] of Object.entries(val)) set[`${group}.${k}`] = v;
      else if (val !== undefined) set[group] = val;
    }
    await getSettings();
    await Settings.updateOne({ key: 'global' }, { $set: set });
    await audit(req.viewer!, 'settings.updated', 'Settings', null, b as Record<string, unknown>);
    res.json({ settings: settingsView(await getSettings()) });
  }),
);

/* ------------------------------------------------------------ overview */
r.get(
  '/overview',
  requireRole('aro', 'admin'),
  ah(async (_req, res) => {
    const [pendingVerifications, verifiedMentors, students, activeMentorships, pendingRequests, atRisk, lapsed, overloaded] = await Promise.all([
      VerificationRequest.countDocuments({ status: { $in: ['pending', 'needs_info'] } }),
      Alumnus.countDocuments({ verificationStatus: 'verified' }),
      StudentProfile.countDocuments(),
      Mentorship.countDocuments({ status: 'active' }),
      MentorshipRequest.countDocuments({ status: 'pending' }),
      Mentorship.countDocuments({ status: 'active', health: 'at_risk' }),
      Mentorship.countDocuments({ status: 'active', health: 'lapsed' }),
      MentorCapacity.countDocuments({ $expr: { $gte: ['$activeCount', '$maxMentees'] }, maxMentees: { $gt: 0 } }),
    ]);
    res.json({ pendingVerifications, verifiedMentors, students, activeMentorships, pendingRequests, atRisk, lapsed, mentorsAtCapacity: overloaded });
  }),
);

/* ---------------------------------------------- capacity overview (M2) */
r.get(
  '/capacity',
  requireRole('aro', 'admin'),
  ah(async (_req, res) => {
    const mentors = await Alumnus.find({ verificationStatus: 'verified' }).populate('user', 'name').lean();
    const ids = mentors.map((m) => m._id);
    const [caps, pending] = await Promise.all([
      MentorCapacity.find({ alumnus: { $in: ids } }).lean(),
      MentorshipRequest.aggregate([{ $match: { alumnus: { $in: ids }, status: 'pending' } }, { $group: { _id: '$alumnus', n: { $sum: 1 } } }]),
    ]);
    const capBy = new Map(caps.map((c) => [String(c.alumnus), c]));
    const pendBy = new Map(pending.map((p: any) => [String(p._id), p.n]));
    const rows = mentors.map((m) => {
      const cap = capBy.get(String(m._id));
      const pend = pendBy.get(String(m._id)) ?? 0;
      const c = capacityView(cap);
      const warnings: string[] = [];
      if (cap && cap.activeCount > cap.maxMentees) warnings.push('Over limit');
      else if (cap && cap.maxMentees > 0 && cap.activeCount >= cap.maxMentees) warnings.push('At capacity');
      if (cap && pend >= (cap.maxPendingRequests ?? 5)) warnings.push('Request inbox full');
      if (cap && cap.maxMentees > 0 && cap.activeCount + pend > cap.maxMentees * 2) warnings.push('High demand');
      if (c.paused) warnings.push('Paused');
      return {
        mentorId: String(m._id),
        name: (m.user as any)?.name ?? 'Mentor',
        industry: m.industry ?? null,
        capacity: c,
        pendingRequests: pend,
        maxPendingRequests: cap?.maxPendingRequests ?? 5,
        utilisation: cap?.maxMentees ? Math.round((cap.activeCount / cap.maxMentees) * 100) : 0,
        warnings,
      };
    });
    rows.sort((a, b) => b.warnings.length - a.warnings.length || b.utilisation - a.utilisation);
    res.json({ mentors: rows });
  }),
);

/* ------------------------------------------- engagement health board (M8) */
r.get(
  '/engagement',
  requireRole('aro', 'admin'),
  ah(async (req, res) => {
    const filter: Record<string, unknown> = { status: 'active' };
    if (typeof req.query.health === 'string' && req.query.health !== 'all') filter.health = req.query.health;
    const list = await Mentorship.find(filter)
      .sort({ healthScore: 1 })
      .limit(300)
      .populate([
        { path: 'alumnus', populate: { path: 'user', select: 'name' } },
        { path: 'student', populate: { path: 'user', select: 'name' } },
      ])
      .lean();
    res.json({
      mentorships: list.map((m) => ({
        ...mentorshipView(m, req.viewer!)!,
        daysSinceActivity: Math.floor((Date.now() - new Date(m.lastActivityAt ?? m.startedAt!).getTime()) / 864e5),
        lastNudgedAt: m.lastNudgedAt?.toISOString() ?? null,
      })),
    });
  }),
);

r.post(
  '/jobs/:job/run',
  requireRole('admin', 'aro'),
  ah(async (req, res) => {
    const job = req.params.job;
    let result: unknown;
    if (job === 'engagement') result = await runEngagementDecay();
    else if (job === 'expiry') result = { expired: await expireRequests() };
    else throw notFound('Job');
    await audit(req.viewer!, `job.${job}.manual_run`, 'Job', null, { result });
    res.json({ result });
  }),
);

/* ------------------------------------------------------- users & audit */
r.get(
  '/users',
  requireRole('admin'),
  ah(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.role === 'string' && req.query.role) filter.role = req.query.role;
    if (typeof req.query.q === 'string' && req.query.q) filter.name = { $regex: req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const users = await User.find(filter).select('+email +phone').sort({ createdAt: -1 }).limit(200).lean();
    res.json({ users: users.map(staffUser) });
  }),
);

r.patch(
  '/users/:id',
  requireRole('admin'),
  ah(async (req, res) => {
    const b = parse(z.object({ status: z.enum(['active', 'suspended']).optional(), role: z.enum(['student', 'alumnus', 'aro', 'placement', 'admin']).optional() }), req.body);
    const u = await User.findByIdAndUpdate(oid(req.params.id, 'User'), { $set: b }, { new: true }).select('+email +phone').lean();
    if (!u) throw notFound('User');
    await audit(req.viewer!, 'user.updated', 'User', u._id, b);
    res.json({ user: staffUser(u) });
  }),
);

r.get(
  '/audit',
  requireRole('admin', 'aro'),
  ah(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.action === 'string' && req.query.action) filter.action = { $regex: `^${req.query.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` };
    if (typeof req.query.entityId === 'string' && req.query.entityId) filter.entityId = oid(req.query.entityId);
    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(200).populate('actor', 'name role').lean();
    res.json({
      logs: logs.map((l) => ({ id: String(l._id), action: l.action, entityType: l.entityType, entityId: l.entityId ? String(l.entityId) : null, actor: l.actor ? { name: (l.actor as any).name, role: (l.actor as any).role } : { name: 'System', role: 'system' }, details: l.details ?? null, at: (l as any).createdAt })),
    });
  }),
);

export default r;
