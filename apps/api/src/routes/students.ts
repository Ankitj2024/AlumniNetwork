import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/errors.js';
import { maskContactDetails } from '../lib/mask.js';
import { requireRole } from '../middleware/auth.js';
import { ah, oid, parse } from '../middleware/common.js';
import { CareerGoal, DEPARTMENTS, MENTORING_AREAS, User } from '../models/index.js';
import { careerGoal, studentSelf } from '../serializers/index.js';
import { studentProfileFor, throttleStatus } from '../services/requests.js';

const r = Router();
r.use(requireRole('student'));

r.get(
  '/me',
  ah(async (req, res) => {
    const p = await studentProfileFor(req.viewer!);
    await p.populate([{ path: 'interests' }, { path: 'user', select: 'name' }]);
    const [u, goals, throttle] = await Promise.all([
      User.findById(req.viewer!.id).select('+email +phone').lean(),
      CareerGoal.find({ student: p._id }).sort({ priority: 1, createdAt: 1 }).lean(),
      throttleStatus(p._id),
    ]);
    res.json({ profile: studentSelf(p.toObject(), u, goals), throttle });
  }),
);

r.put(
  '/me',
  ah(async (req, res) => {
    const b = parse(
      z.object({
        rollNumber: z.string().trim().max(30).optional(),
        program: z.string().trim().max(80).optional(),
        department: z.enum(DEPARTMENTS).optional(),
        graduationYear: z.number().int().min(2000).max(2100).optional(),
        bio: z.string().trim().max(1500).optional(),
        interests: z.array(z.string()).max(15).optional(),
        targetRoles: z.array(z.string().trim().min(2).max(80)).max(6).optional(),
        targetIndustries: z.array(z.string().trim().max(60)).max(6).optional(),
        mentoringAreasWanted: z.array(z.enum(MENTORING_AREAS)).max(9).optional(),
      }),
      req.body,
    );
    const p = await studentProfileFor(req.viewer!);
    Object.assign(p, {
      ...b,
      bio: b.bio !== undefined ? maskContactDetails(b.bio).text : p.bio,
      interests: b.interests ? b.interests.map((x) => oid(x, 'Tag')) : p.interests,
    });
    await p.save();
    res.json({ ok: true });
  }),
);

const goalSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1500).optional(),
  targetRole: z.string().trim().max(80).optional(),
  targetIndustry: z.string().trim().max(60).optional(),
  timeframe: z.enum(['3_months', '6_months', '1_year', '2_years_plus']).optional(),
  priority: z.number().int().min(1).max(3).optional(),
});

r.post(
  '/me/goals',
  ah(async (req, res) => {
    const b = parse(goalSchema, req.body);
    const p = await studentProfileFor(req.viewer!);
    if ((await CareerGoal.countDocuments({ student: p._id })) >= 10) throw notFound('Goal slot');
    const g = await CareerGoal.create({ ...b, student: p._id });
    res.status(201).json({ goal: careerGoal(g.toObject()) });
  }),
);

r.put(
  '/me/goals/:id',
  ah(async (req, res) => {
    const b = parse(goalSchema.partial(), req.body);
    const p = await studentProfileFor(req.viewer!);
    const g = await CareerGoal.findOneAndUpdate({ _id: oid(req.params.id), student: p._id }, { $set: b }, { new: true }).lean();
    if (!g) throw notFound('Goal');
    res.json({ goal: careerGoal(g) });
  }),
);

r.delete(
  '/me/goals/:id',
  ah(async (req, res) => {
    const p = await studentProfileFor(req.viewer!);
    await CareerGoal.deleteOne({ _id: oid(req.params.id), student: p._id });
    res.json({ ok: true });
  }),
);

export default r;
