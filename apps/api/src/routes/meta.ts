import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ah, parse } from '../middleware/common.js';
import {
  DECLINE_REASON_LABELS,
  DEPARTMENTS,
  ExpertiseTag,
  INDUSTRIES,
  MENTORING_AREA_LABELS,
} from '../models/index.js';
import { tag } from '../serializers/index.js';

const r = Router();

r.get('/meta', (_req, res) => {
  res.json({
    mentoringAreas: Object.entries(MENTORING_AREA_LABELS).map(([value, label]) => ({ value, label })),
    industries: INDUSTRIES,
    departments: DEPARTMENTS,
    declineReasons: Object.entries(DECLINE_REASON_LABELS).map(([value, label]) => ({ value, label })),
  });
});

r.get(
  '/tags',
  requireAuth,
  ah(async (_req, res) => {
    const tags = await ExpertiseTag.find().sort({ category: 1, name: 1 }).lean();
    res.json({ tags: tags.map(tag) });
  }),
);

r.post(
  '/tags',
  requireRole('aro', 'admin'),
  ah(async (req, res) => {
    const b = parse(z.object({ name: z.string().trim().min(2).max(60), category: z.string().trim().max(40).default('General') }), req.body);
    const slug = b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const t = await ExpertiseTag.findOneAndUpdate({ slug }, { $setOnInsert: { name: b.name, slug, category: b.category } }, { upsert: true, new: true }).lean();
    res.status(201).json({ tag: tag(t) });
  }),
);

export default r;
