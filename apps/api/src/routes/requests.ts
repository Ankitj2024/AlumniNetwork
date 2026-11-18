import { Router } from 'express';
import { z } from 'zod';
import { forbidden } from '../lib/errors.js';
import { requireAuth, requireRole, requireVerifiedEmail } from '../middleware/auth.js';
import { ah, oid, parse } from '../middleware/common.js';
import { DECLINE_REASONS, MentorshipRequest } from '../models/index.js';
import { requestView } from '../serializers/index.js';
import {
  acceptRequest,
  alumnusFor,
  createRequest,
  declineAllPending,
  declineRequest,
  studentProfileFor,
  throttleStatus,
  withdrawRequest,
} from '../services/requests.js';

const r = Router();
r.use(requireAuth);

r.get(
  '/',
  ah(async (req, res) => {
    const v = req.viewer!;
    const status = typeof req.query.status === 'string' && req.query.status !== 'all' ? req.query.status : undefined;
    let filter: Record<string, unknown>;
    if (v.role === 'student') filter = { student: (await studentProfileFor(v))._id };
    else if (v.role === 'alumnus') filter = { alumnus: (await alumnusFor(v))._id };
    else if (v.role === 'aro' || v.role === 'admin') filter = {};
    else throw forbidden();
    if (status) filter.status = status;
    const list = await MentorshipRequest.find(filter)
      .sort({ status: 1, createdAt: -1 })
      .limit(200)
      .populate({ path: 'alumnus', populate: [{ path: 'user', select: 'name' }, { path: 'expertise' }] })
      .populate({ path: 'student', populate: [{ path: 'user', select: 'name' }, { path: 'interests' }] })
      .populate('goals')
      .lean();
    res.json({ requests: list.map((x) => requestView(x, v)) });
  }),
);

r.get(
  '/throttle',
  requireRole('student'),
  ah(async (req, res) => {
    const p = await studentProfileFor(req.viewer!);
    res.json({ throttle: await throttleStatus(p._id) });
  }),
);

r.post(
  '/',
  requireRole('student'),
  requireVerifiedEmail,
  ah(async (req, res) => {
    const b = parse(
      z.object({ alumnusId: z.string(), message: z.string().trim().min(20, 'Tell the mentor a little about what you hope to get from mentoring (20+ characters)').max(1200), goalIds: z.array(z.string()).max(5).optional() }),
      req.body,
    );
    oid(b.alumnusId, 'Mentor');
    const created = await createRequest(req.viewer!, b);
    res.status(201).json({ request: requestView(created.toObject(), req.viewer!) });
  }),
);

r.post(
  '/decline-all',
  requireRole('alumnus'),
  ah(async (req, res) => {
    const b = parse(z.object({ reason: z.enum(DECLINE_REASONS).nullable().optional() }), req.body ?? {});
    res.json({ declined: await declineAllPending(req.viewer!, b.reason) });
  }),
);

r.post(
  '/:id/accept',
  requireRole('alumnus'),
  ah(async (req, res) => {
    const m = await acceptRequest(req.viewer!, String(oid(req.params.id, 'Request')));
    res.json({ mentorshipId: String(m._id) });
  }),
);

r.post(
  '/:id/decline',
  requireRole('alumnus'),
  ah(async (req, res) => {
    const b = parse(z.object({ reason: z.enum(DECLINE_REASONS).nullable().optional(), note: z.string().trim().max(500).nullable().optional() }), req.body ?? {});
    const d = await declineRequest(req.viewer!, String(oid(req.params.id, 'Request')), b.reason, b.note);
    res.json({ request: requestView(d, req.viewer!) });
  }),
);

r.post(
  '/:id/withdraw',
  requireRole('student'),
  ah(async (req, res) => {
    const w = await withdrawRequest(req.viewer!, String(oid(req.params.id, 'Request')));
    res.json({ request: requestView(w, req.viewer!) });
  }),
);

export default r;
