import { Router } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../middleware/common.js';
import { CalendarConnection } from '../models/index.js';
import { authUrl, handleCallback, providerConfigured, type Provider } from '../services/calendar.js';

const r = Router();
const isProvider = (p: string): p is Provider => p === 'google' || p === 'outlook';

r.get(
  '/status',
  requireAuth,
  ah(async (req, res) => {
    const conns = await CalendarConnection.find({ user: req.viewer!.id }).lean();
    res.json({
      providers: (['google', 'outlook'] as Provider[]).map((p) => ({
        provider: p,
        configured: providerConfigured(p),
        connected: conns.some((c) => c.provider === p),
      })),
      videoProvider: env.videoProvider,
    });
  }),
);

r.get(
  '/:provider/connect',
  requireAuth,
  ah(async (req, res) => {
    const p = req.params.provider;
    if (!isProvider(p)) throw new HttpError(404, 'not_found', 'Unknown provider');
    if (!providerConfigured(p)) throw new HttpError(501, 'not_configured', `${p === 'google' ? 'Google' : 'Outlook'} calendar is not configured on this server. Use the .ics download instead.`);
    res.json({ url: authUrl(p, req.viewer!.id) });
  }),
);

r.get('/:provider/callback', async (req, res) => {
  const p = req.params.provider;
  try {
    if (!isProvider(p) || typeof req.query.code !== 'string' || typeof req.query.state !== 'string') throw new Error('Invalid callback');
    await handleCallback(p, req.query.code, req.query.state);
    res.redirect(`${env.webOrigin}/settings?calendar=connected`);
  } catch (e) {
    logger.warn('Calendar OAuth callback failed', { e: String(e) });
    res.redirect(`${env.webOrigin}/settings?calendar=error`);
  }
});

r.delete(
  '/:provider',
  requireAuth,
  ah(async (req, res) => {
    await CalendarConnection.deleteOne({ user: req.viewer!.id, provider: req.params.provider });
    res.json({ ok: true });
  }),
);

export default r;
