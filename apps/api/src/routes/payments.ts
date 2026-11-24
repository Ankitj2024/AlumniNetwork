import { Router, type Request } from 'express';
import { z } from 'zod';
import { badRequest } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ah, oid, parse } from '../middleware/common.js';
import { methodView, paymentView, sessionView } from '../serializers/index.js';
import { verifyWebhookSignature } from '../services/gateway.js';
import {
  addTestCard,
  completeTestCheckout,
  handleRazorpayEvent,
  listMethods,
  listPayments,
  paymentConfig,
  paymentDetail,
  removeMethod,
  staffRefund,
  startCheckout,
  updateMethod,
  verifyRazorpayCheckout,
} from '../services/payments.js';
import { Session } from '../models/index.js';

const r = Router();

/* Razorpay calls this server-to-server; it is authenticated by its signature, not a session. */
r.post(
  '/webhook/razorpay',
  ah(async (req, res) => {
    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!verifyWebhookSignature(raw, req.header('x-razorpay-signature'))) throw badRequest('bad_signature', 'Invalid webhook signature');
    const result = await handleRazorpayEvent(req.body);
    logger.info('razorpay webhook', { event: req.body?.event, result });
    res.json({ ok: true });
  }),
);

r.use(requireAuth);

r.get(
  '/config',
  ah(async (_req, res) => {
    res.json({ config: await paymentConfig() });
  }),
);

/* -------------------------------------------------------------- saved cards (students) */
const network = z.enum(['visa', 'mastercard', 'rupay', 'amex', 'other']);
const finish = z.enum(['metal', 'black', 'glass', 'color']);
/** Card details the server may receive: never the full number or CVV. */
const cardMeta = z
  .object({
    network,
    cardType: z.enum(['credit', 'debit', 'prepaid']).default('debit'),
    last4: z.string().regex(/^\d{4}$/, 'Only the last four digits'),
    expMonth: z.number().int().min(1).max(12),
    expYear: z.number().int().min(new Date().getFullYear()).max(new Date().getFullYear() + 20),
    holder: z.string().trim().max(80).optional(),
    issuer: z.string().trim().max(60).optional(),
    nickname: z.string().trim().max(40).optional(),
  })
  .strict(); // rejects extra fields such as `number` or `cvv` outright

r.get(
  '/methods',
  requireRole('student'),
  ah(async (req, res) => {
    const rows = await listMethods(req.viewer!);
    res.json({ methods: rows.map((x) => methodView(x.method, { totalPaid: x.totalPaid, recent: x.recent })) });
  }),
);

r.post(
  '/methods',
  requireRole('student'),
  ah(async (req, res) => {
    const b = parse(cardMeta.extend({ makeDefault: z.boolean().optional(), finish: finish.optional() }).strict(), req.body);
    const m = await addTestCard(req.viewer!, b);
    res.status(201).json({ method: methodView(m.toObject()) });
  }),
);

r.patch(
  '/methods/:id',
  requireRole('student'),
  ah(async (req, res) => {
    const b = parse(z.object({ nickname: z.string().trim().max(40).nullable().optional(), finish: finish.optional(), isDefault: z.boolean().optional() }).strict(), req.body);
    const m = await updateMethod(req.viewer!, String(oid(req.params.id, 'Saved card')), b);
    res.json({ method: methodView(m.toObject()) });
  }),
);

r.delete(
  '/methods/:id',
  requireRole('student'),
  ah(async (req, res) => {
    await removeMethod(req.viewer!, String(oid(req.params.id, 'Saved card')));
    res.json({ ok: true });
  }),
);

/* ----------------------------------------------------------------- checkout (students) */
r.post(
  '/checkout',
  requireRole('student'),
  ah(async (req, res) => {
    const b = parse(z.object({ sessionId: z.string() }), req.body);
    const { checkout } = await startCheckout(req.viewer!, String(oid(b.sessionId, 'Session')));
    res.status(201).json({ checkout });
  }),
);

r.post(
  '/test/complete',
  requireRole('student'),
  ah(async (req, res) => {
    const method = z.discriminatedUnion('type', [
      z.object({ type: z.literal('saved'), methodId: z.string() }),
      cardMeta.extend({ type: z.literal('card'), save: z.boolean().optional() }).strict(),
      z.object({ type: z.literal('upi'), vpa: z.string().trim().regex(/^[\w.-]{2,64}@[a-zA-Z]{2,32}$/, 'Enter a UPI id like name@bank') }),
    ]);
    const b = parse(z.object({ paymentId: z.string(), method }), req.body);
    if (b.method.type === 'saved') oid(b.method.methodId, 'Saved card');
    const { payment, ok } = await completeTestCheckout(req.viewer!, String(oid(b.paymentId, 'Payment')), b.method);
    const session = await Session.findById(payment.session).lean();
    res.json({ ok, payment: paymentView(payment.toObject(), req.viewer!), session: sessionView(session, req.viewer!) });
  }),
);

r.post(
  '/razorpay/verify',
  requireRole('student'),
  ah(async (req, res) => {
    const b = parse(
      z.object({ paymentId: z.string(), razorpay_order_id: z.string().max(64), razorpay_payment_id: z.string().max(64), razorpay_signature: z.string().max(256) }),
      req.body,
    );
    const p = await verifyRazorpayCheckout(req.viewer!, { paymentId: String(oid(b.paymentId, 'Payment')), orderId: b.razorpay_order_id, gatewayPaymentId: b.razorpay_payment_id, signature: b.razorpay_signature });
    const session = await Session.findById(p.session).lean();
    res.json({ ok: p.status === 'paid', payment: paymentView(p.toObject(), req.viewer!), session: sessionView(session, req.viewer!) });
  }),
);

/* ---------------------------------------------------------------------- history / earnings */
r.get(
  '/',
  requireRole('student', 'alumnus', 'admin', 'aro'),
  ah(async (req, res) => {
    const rows = await listPayments(req.viewer!);
    res.json({ payments: rows.map((p: any) => paymentView(p, req.viewer!)) });
  }),
);

r.get(
  '/:id',
  ah(async (req, res) => {
    const p = await paymentDetail(req.viewer!, String(oid(req.params.id, 'Payment')));
    res.json({ payment: paymentView(p, req.viewer!) });
  }),
);

r.post(
  '/:id/refund',
  requireRole('admin', 'aro'),
  ah(async (req, res) => {
    const b = parse(z.object({ reason: z.string().trim().max(200).optional() }), req.body ?? {});
    const { payment, refund, sessionCancelled } = await staffRefund(req.viewer!, String(oid(req.params.id, 'Payment')), b.reason ?? '');
    res.json({ payment: paymentView(payment.toObject(), req.viewer!), refund, sessionCancelled });
  }),
);

export default r;
