import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { ah, parse } from '../middleware/common.js';
import { Notification } from '../models/index.js';
import { notificationView } from '../serializers/index.js';

const r = Router();
r.use(requireAuth);

r.get(
  '/',
  ah(async (req, res) => {
    const [list, unread] = await Promise.all([
      Notification.find({ user: req.viewer!.id }).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit ?? 50), 200)).lean(),
      Notification.countDocuments({ user: req.viewer!.id, readAt: { $exists: false } }),
    ]);
    res.json({ notifications: list.map(notificationView), unread });
  }),
);

r.post(
  '/read',
  ah(async (req, res) => {
    const b = parse(z.object({ ids: z.array(z.string()).max(200).optional(), all: z.boolean().optional() }), req.body ?? {});
    const filter: Record<string, unknown> = { user: req.viewer!.id, readAt: { $exists: false } };
    if (!b.all) filter._id = { $in: b.ids ?? [] };
    const r2 = await Notification.updateMany(filter, { $set: { readAt: new Date() } });
    res.json({ marked: r2.modifiedCount });
  }),
);

export default r;
