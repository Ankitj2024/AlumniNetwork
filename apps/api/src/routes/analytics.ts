import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { ah } from '../middleware/common.js';
import { mentorEffectiveness, placementCorrelation, programmeReport, reportToCsv } from '../services/analytics.js';

const r = Router();

const range = (q: any) => ({
  from: typeof q.from === 'string' && q.from ? new Date(q.from) : undefined,
  to: typeof q.to === 'string' && q.to ? new Date(`${q.to}T23:59:59.999Z`) : undefined,
});

r.get(
  '/programme',
  requireRole('aro', 'admin', 'placement'),
  ah(async (req, res) => {
    res.json({ report: await programmeReport(range(req.query)) });
  }),
);

r.get(
  '/programme.csv',
  requireRole('aro', 'admin', 'placement'),
  ah(async (req, res) => {
    const rep = await programmeReport(range(req.query));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="programme-report-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(reportToCsv(rep));
  }),
);

r.get(
  '/placement',
  requireRole('placement', 'aro', 'admin'),
  ah(async (_req, res) => {
    res.json({ correlation: await placementCorrelation() });
  }),
);

r.get(
  '/mentors',
  requireRole('aro', 'admin'),
  ah(async (_req, res) => {
    res.json({ mentors: await mentorEffectiveness() });
  }),
);

export default r;
