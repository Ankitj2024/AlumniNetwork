import type { NextFunction, Request, RequestHandler, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { HttpError, badRequest, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { findPrivacyViolations } from '../serializers/index.js';

/** Wraps async handlers so rejected promises reach the error middleware (Express 4). */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw badRequest('validation_error', 'Some fields are invalid', r.error.flatten());
  return r.data;
}

export function oid(v: string, what = 'Resource'): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(v)) throw notFound(what);
  return new mongoose.Types.ObjectId(v);
}

/**
 * Privacy leak guard (defence in depth on top of the serializers).
 * Every JSON response is scanned; if a forbidden field would reach the viewer the response is
 * blocked with a 500 and the incident is logged. A correct serializer never triggers this.
 */
export function leakGuard(req: Request, res: Response, next: NextFunction) {
  const original = res.json.bind(res);
  res.json = (body: unknown) => {
    const violations = findPrivacyViolations(body, req.viewer ?? null);
    if (violations.length) {
      logger.error('PRIVACY VIOLATION BLOCKED', { path: req.originalUrl, role: req.viewer?.role, violations });
      res.status(500);
      return original({ error: { code: 'privacy_guard', message: 'Response blocked by privacy guard' } });
    }
    return original(body);
  };
  next();
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: 'validation_error', message: 'Invalid input', details: err.flatten() } });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: { code: 'validation_error', message: err.message } });
  }
  if ((err as any)?.code === 11000) {
    return res.status(409).json({ error: { code: 'duplicate', message: 'This record already exists' } });
  }
  if ((err as any)?.name === 'MulterError') {
    return res.status(400).json({ error: { code: 'upload_error', message: (err as Error).message } });
  }
  logger.error('Unhandled error', { path: req.originalUrl, err: (err as Error)?.stack ?? String(err) });
  res.status(500).json({ error: { code: 'internal', message: 'Something went wrong' } });
}
