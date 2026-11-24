import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { type Clock, systemClock } from '../lib/clock.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { Alumnus, Mentorship, Payment, PaymentMethod, Session, User } from '../models/index.js';
import type { Viewer } from '../serializers/index.js';
import { mentorshipAccess } from './access.js';
import { audit } from './audit.js';
import {
  gatewayFor,
  maskVpa,
  razorpayCustomer,
  razorpayDeleteToken,
  razorpayGateway,
  razorpayPaymentDetails,
  testGateway,
  verifyCheckoutSignature,
  type CardType,
  type Gateway,
  type MethodInfo,
  type Network,
  type TokenInfo,
} from './gateway.js';
import { notify } from './notify.js';
import { cancelBookedSession, confirmSession } from './sessions.js';
import { getSettings, type ProgrammeSettings } from './settings.js';

/** "₹499" / "₹449.10" from paise, for notification text. */
export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function paymentsActive(s: ProgrammeSettings) {
  return env.paymentGateway !== 'off' && s.payments?.enabled !== false;
}

export function activeGateway(): Gateway {
  if (env.paymentGateway === 'razorpay') return razorpayGateway;
  if (env.paymentGateway === 'test') return testGateway;
  throw conflict('payments_off', 'Paid sessions are switched off');
}

/** What a session with this mentor costs right now, in paise (0 = free). */
export async function sessionFeeFor(alumnusId: unknown): Promise<number> {
  const s = await getSettings();
  if (!paymentsActive(s)) return 0;
  const a = await Alumnus.findById(alumnusId).select('sessionFee').lean();
  const fee = Math.min(a?.sessionFee ?? 0, s.payments?.maxSessionFee ?? 0);
  return fee >= 1 ? Math.round(fee * 100) : 0;
}

export async function paymentConfig() {
  const s = await getSettings();
  return {
    enabled: paymentsActive(s),
    gateway: env.paymentGateway,
    currency: 'INR' as const,
    keyId: env.paymentGateway === 'razorpay' ? env.razorpay.keyId || null : null,
    maxSessionFee: s.payments?.maxSessionFee ?? 0,
    platformFeePercent: s.payments?.platformFeePercent ?? 0,
    refundCutoffHours: s.payments?.refundCutoffHours ?? 24,
  };
}

const receiptNo = (now: Date) => `AMN-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

/* ------------------------------------------------------------- checkout */
export async function startCheckout(viewer: Viewer, sessionId: string, clock: Clock = systemClock) {
  const s = await Session.findById(sessionId);
  if (!s) throw notFound('Session');
  const acc = await mentorshipAccess(viewer, String(s.mentorship), { write: true });
  if (acc.role !== 'student') throw forbidden('Only the student pays for a session');
  if (acc.mentorship.status !== 'active') throw conflict('not_active', 'This mentorship has ended');
  if (s.status !== 'awaiting_payment' || !s.fee) throw conflict('not_awaiting_payment', 'This session does not need a payment');
  const now = clock();
  if (s.paymentDueAt && s.paymentDueAt <= now) throw conflict('hold_expired', 'The hold on this slot has lapsed — pick a time again');

  const settings = await getSettings();
  const gw = activeGateway();
  const amount = s.fee;
  const platformFee = Math.round((amount * (settings.payments?.platformFeePercent ?? 0)) / 100);
  const no = receiptNo(now);
  const { orderId } = await gw.createOrder({ amount, receipt: no, notes: { sessionId: String(s._id), mentorshipId: String(acc.mentorship._id) } });
  const p = await Payment.create({
    payer: viewer.id,
    student: acc.mentorship.student,
    alumnus: acc.mentorship.alumnus,
    mentorship: acc.mentorship._id,
    session: s._id,
    amount,
    platformFee,
    mentorShare: amount - platformFee,
    gateway: gw.name,
    orderId,
    receiptNo: no,
  });

  const [me, mentor] = await Promise.all([User.findById(viewer.id).select('+email +razorpayCustomerId'), User.findById(acc.mentorUserId).select('name').lean()]);
  let customerId: string | null = null;
  if (gw.name === 'razorpay' && me) {
    customerId = me.razorpayCustomerId ?? null;
    if (!customerId) {
      customerId = await razorpayCustomer(me.name, me.email);
      me.razorpayCustomerId = customerId;
      await me.save();
    }
  }
  await audit(viewer, 'payment.created', 'Payment', p._id, { amount, sessionId: String(s._id) });
  return {
    payment: p,
    checkout: {
      gateway: gw.name,
      paymentId: String(p._id),
      orderId,
      amount,
      currency: 'INR' as const,
      keyId: gw.name === 'razorpay' ? env.razorpay.keyId : null,
      customerId,
      name: env.appName,
      description: `${s.title ?? 'Mentoring session'} with ${mentor?.name ?? 'your mentor'}`,
      // The student's own details, so the gateway form is pre-filled for them.
      prefill: { name: me?.name ?? '', email: me?.email ?? '' },
      holdExpiresAt: s.paymentDueAt?.toISOString() ?? null,
    },
  };
}

type TestMethodInput =
  | { type: 'saved'; methodId: string }
  | { type: 'card'; network: Network; cardType: CardType; last4: string; expMonth: number; expYear: number; holder?: string; save?: boolean; nickname?: string; issuer?: string }
  | { type: 'upi'; vpa: string };

/** Test gateway only: stands in for the checkout a real gateway would host. */
export async function completeTestCheckout(viewer: Viewer, paymentId: string, input: TestMethodInput, clock: Clock = systemClock) {
  if (env.paymentGateway !== 'test') throw badRequest('test_gateway_off', 'The test gateway is not enabled');
  const p = await Payment.findOne({ _id: paymentId, payer: viewer.id });
  if (!p) throw notFound('Payment');
  if (p.gateway !== 'test') throw badRequest('wrong_gateway', 'This payment uses a different gateway');
  if (p.status === 'paid') return { payment: p, ok: true };
  if (p.status !== 'created') throw conflict('payment_closed', 'This payment can no longer be completed');

  let method: MethodInfo & { savedMethod?: unknown };
  let declined = false;
  if (input.type === 'saved') {
    const m = await PaymentMethod.findOne({ _id: input.methodId, user: viewer.id }).lean();
    if (!m) throw notFound('Saved card');
    method = { kind: 'card', network: m.network as Network, last4: m.last4, savedMethod: m._id };
    declined = m.last4 === '0002';
  } else if (input.type === 'card') {
    declined = input.last4 === '0002'; // test card 4000 0000 0000 0002 is always declined
    method = { kind: 'card', network: input.network, last4: input.last4 };
    if (!declined && input.save) {
      const saved = await saveMethod(viewer, {
        gateway: 'test',
        token: `tok_test_${crypto.randomBytes(6).toString('hex')}`,
        network: input.network,
        cardType: input.cardType,
        issuer: input.issuer,
        last4: input.last4,
        expMonth: input.expMonth,
        expYear: input.expYear,
        holder: input.holder,
        nickname: input.nickname,
      });
      method.savedMethod = saved._id;
    }
  } else {
    declined = input.vpa.toLowerCase().startsWith('failure@');
    method = { kind: 'upi', vpa: maskVpa(input.vpa) };
  }

  if (declined) {
    p.status = 'failed';
    p.failureReason = input.type === 'upi' ? 'The UPI request was declined (test id)' : 'The card was declined by the bank (test card)';
    p.method = method as any;
    await p.save();
    return { payment: p, ok: false };
  }
  return { payment: await markPaid(String(p._id), { gatewayPaymentId: `pay_test_${crypto.randomBytes(7).toString('hex')}`, method }, clock), ok: true };
}

/** Razorpay Checkout success handler: check the signature, then confirm with Razorpay itself. */
export async function verifyRazorpayCheckout(viewer: Viewer, input: { paymentId: string; orderId: string; gatewayPaymentId: string; signature: string }, clock: Clock = systemClock) {
  if (env.paymentGateway !== 'razorpay') throw badRequest('razorpay_off', 'Razorpay is not enabled');
  const p = await Payment.findOne({ _id: input.paymentId, payer: viewer.id });
  if (!p) throw notFound('Payment');
  if (p.orderId !== input.orderId) throw badRequest('order_mismatch', 'The payment does not belong to this order');
  if (!verifyCheckoutSignature(input.orderId, input.gatewayPaymentId, input.signature)) throw badRequest('bad_signature', 'The payment could not be verified');
  if (p.status === 'paid') return p;
  return applyRazorpayPayment(p, input.gatewayPaymentId, clock);
}

/** Webhook path (payment.captured / order.paid): the same confirmation, keyed by order id. */
export async function handleRazorpayEvent(event: any, clock: Clock = systemClock) {
  const ent = event?.payload?.payment?.entity;
  if (event?.event === 'payment.captured' || event?.event === 'order.paid') {
    if (!ent?.order_id || !ent?.id) return 'ignored';
    const p = await Payment.findOne({ orderId: ent.order_id });
    if (!p || !['created', 'failed'].includes(p.status)) return 'noop';
    await applyRazorpayPayment(p, ent.id, clock);
    return 'paid';
  }
  if (event?.event === 'payment.failed' && ent?.order_id) {
    // Razorpay Checkout lets the student try another method on the same order, so only note the reason.
    await Payment.updateOne({ orderId: ent.order_id, status: 'created' }, { $set: { failureReason: ent.error_description ?? 'Payment failed' } });
    return 'failed';
  }
  const rf = event?.payload?.refund?.entity;
  if (event?.event === 'refund.processed' && rf?.id) {
    await Payment.updateOne({ 'refund.gatewayRefundId': rf.id }, { $set: { 'refund.status': 'processed' } });
    return 'refund';
  }
  return 'ignored';
}

async function applyRazorpayPayment(p: InstanceType<typeof Payment>, gatewayPaymentId: string, clock: Clock) {
  const { method, token } = await razorpayPaymentDetails(gatewayPaymentId, { orderId: p.orderId, amount: p.amount });
  const m: MethodInfo & { savedMethod?: unknown } = { ...method };
  if (token) {
    const saved = await saveMethod({ id: String(p.payer), role: 'student' }, tokenToMethod(token));
    m.savedMethod = saved._id;
  }
  return markPaid(String(p._id), { gatewayPaymentId, method: m }, clock);
}

const tokenToMethod = (t: TokenInfo) => ({ gateway: 'razorpay' as const, token: t.id, customerId: t.customerId, network: t.network, cardType: t.cardType, issuer: t.issuer, last4: t.last4, expMonth: t.expMonth, expYear: t.expYear, holder: t.holder });

/**
 * Records a successful payment exactly once (concurrent checkout + webhook can't double-apply) and
 * confirms the session. If the hold lapsed or the session was cancelled meanwhile, the money goes back.
 */
export async function markPaid(paymentId: string, details: { gatewayPaymentId: string; method: MethodInfo & { savedMethod?: unknown } }, clock: Clock = systemClock) {
  const now = clock();
  const p = await Payment.findOneAndUpdate(
    // 'failed' too: a hold can lapse (or an attempt be closed) while the gateway window is still open;
    // if the money arrives anyway it is recorded, then refunded below when the slot is gone.
    { _id: paymentId, status: { $in: ['created', 'failed'] } },
    { $set: { status: 'paid', paidAt: now, gatewayPaymentId: details.gatewayPaymentId, method: details.method }, $unset: { failureReason: 1 } },
    { new: true },
  );
  if (!p) return (await Payment.findById(paymentId))!;

  const payer: Viewer = { id: String(p.payer), role: 'student' };
  await audit(payer, 'payment.paid', 'Payment', p._id, { amount: p.amount, gateway: p.gateway });
  const s = await Session.findOneAndUpdate({ _id: p.session, status: 'awaiting_payment' }, { $set: { payment: p._id }, $unset: { paymentDueAt: 1 } }, { new: true });
  if (!s) {
    await refundPayment(p, 'The slot was no longer held when the payment arrived', now);
    return p;
  }
  const acc = await mentorshipAccess(payer, String(s.mentorship), { write: true });
  await confirmSession(payer, acc, s, clock);
  await notify(p.payer, 'payment_received', { title: `Payment received — ${rupees(p.amount)}`, body: `Receipt ${p.receiptNo} for “${s.title}”. Your session is confirmed.`, link: `/payments/${p._id}` }, { email: true });
  return p;
}

/* -------------------------------------------------------------- refunds */
export async function refundPayment(p: InstanceType<typeof Payment>, reason: string, now: Date) {
  if (p.status !== 'paid' || !p.gatewayPaymentId) return null;
  try {
    const r = await gatewayFor(p.gateway as 'test' | 'razorpay').refund(p.gatewayPaymentId, p.amount);
    p.status = 'refunded';
    p.refund = { amount: p.amount, status: r.status, gatewayRefundId: r.refundId, reason, at: now } as any;
    await p.save();
    await audit(null, 'payment.refunded', 'Payment', p._id, { amount: p.amount, reason });
    await notify(p.payer, 'refund_issued', {
      title: `Refund of ${rupees(p.amount)} ${r.status === 'processed' ? 'issued' : 'started'}`,
      body: `${reason}. ${p.gateway === 'razorpay' ? 'Banks usually take 5–7 working days to show it.' : ''}`.trim(),
      link: `/payments/${p._id}`,
    });
    return { refunded: true, amount: p.amount, status: r.status };
  } catch (e) {
    // The cancellation still stands; staff can retry the refund from the payments list.
    logger.error('refund failed', { payment: String(p._id), e: String(e) });
    p.refund = { amount: p.amount, status: 'failed', reason, at: now } as any;
    await p.save();
    return { refunded: false, amount: p.amount, status: 'failed' as const };
  }
}

/** Refund rules on cancellation: the mentor (or staff) cancelling always refunds; a student only up to the cutoff. */
export async function refundOnCancel(s: InstanceType<typeof Session>, by: 'student' | 'mentor', now: Date) {
  if (!s.payment) return null;
  const p = await Payment.findById(s.payment);
  if (!p || p.status !== 'paid') return null;
  if (by === 'student') {
    const cutoff = (await getSettings()).payments?.refundCutoffHours ?? 24;
    const hoursBefore = ((s.scheduledStart?.getTime() ?? 0) - now.getTime()) / 3_600_000;
    if (hoursBefore < cutoff) return { refunded: false, amount: 0, status: 'late' as const, cutoffHours: cutoff };
  }
  return refundPayment(p, by === 'student' ? 'You cancelled the session in time' : 'Your mentor cancelled the session', now);
}

/** Staff refund (disputes, no-shows). */
export async function staffRefund(viewer: Viewer, paymentId: string, reason: string, clock: Clock = systemClock) {
  const p = await Payment.findById(paymentId);
  if (!p) throw notFound('Payment');
  if (p.status !== 'paid') throw conflict('not_refundable', 'Only paid payments can be refunded');
  const r = await refundPayment(p, reason || 'Refunded by the alumni office', clock());
  await audit(viewer, 'payment.staff_refund', 'Payment', p._id, { reason });
  // Refunding a session that hasn't happened yet cancels it, so it isn't held for free.
  const s = r?.refunded ? await Session.findOne({ _id: p.session, status: 'scheduled', scheduledStart: { $gt: clock() } }) : null;
  if (s) await cancelBookedSession(s, viewer.id, `${reason || 'Refunded by the alumni office'}. The session is cancelled.`);
  return { payment: p, refund: r, sessionCancelled: !!s };
}

/** Unpaid attempts for a session are closed when the session is cancelled or its hold lapses. */
export async function failOpenPayments(sessionId: unknown, reason: string) {
  await Payment.updateMany({ session: sessionId, status: 'created' }, { $set: { status: 'failed', failureReason: reason } });
}

/** Job (every 5 minutes): unpaid holds go back to "proposed" so the slot is free again. */
export async function releaseExpiredHolds(clock: Clock = systemClock): Promise<number> {
  const now = clock();
  const due = await Session.find({ status: 'awaiting_payment', paymentDueAt: { $lte: now } }).select('_id mentorship title').lean();
  let released = 0;
  for (const d of due) {
    // paymentDueAt in the filter: a payment being confirmed right now has already removed it.
    const s = await Session.findOneAndUpdate({ _id: d._id, status: 'awaiting_payment', paymentDueAt: { $lte: now } }, { $set: { status: 'proposed' }, $unset: { scheduledStart: 1, scheduledEnd: 1, paymentDueAt: 1, fee: 1 } });
    if (!s) continue;
    await failOpenPayments(s._id, 'The payment window closed');
    const p = await Payment.findOne({ session: s._id }).sort({ createdAt: -1 }).select('payer').lean();
    const m = await Mentorship.findById(s.mentorship).populate('student', 'user').lean();
    const studentUser = p?.payer ?? (m?.student as any)?.user;
    if (studentUser) await notify(studentUser, 'payment_due', { title: 'Session slot released', body: `“${s.title}” wasn't paid for in time, so the slot was released. Pick a time again to book it.`, link: `/mentorships/${s.mentorship}?tab=sessions` });
    released++;
  }
  return released;
}

/* --------------------------------------------------------- saved cards */
type SaveInput = { gateway: 'test' | 'razorpay'; token: string; customerId?: string; network: Network; cardType: CardType; issuer?: string; last4: string; expMonth: number; expYear: number; holder?: string; nickname?: string; finish?: string };

const FINISH_BY_NETWORK: Record<string, string> = { visa: 'metal', mastercard: 'black', rupay: 'color', amex: 'glass', other: 'glass' };

async function saveMethod(viewer: Viewer, m: SaveInput) {
  // The same gateway token saved twice (e.g. paying again with "save card" ticked) stays one card.
  const existing = await PaymentMethod.findOne({ user: viewer.id, gateway: m.gateway, token: m.token });
  if (existing) return existing;
  const count = await PaymentMethod.countDocuments({ user: viewer.id });
  return PaymentMethod.create({ user: viewer.id, ...m, finish: m.finish ?? FINISH_BY_NETWORK[m.network] ?? 'metal', isDefault: count === 0 });
}

export async function addTestCard(viewer: Viewer, input: Omit<SaveInput, 'gateway' | 'token' | 'customerId'> & { makeDefault?: boolean }) {
  if (env.paymentGateway !== 'test') throw badRequest('use_checkout', 'Cards are saved through the payment gateway when you pay — tick "Save this card" at checkout');
  const { makeDefault, ...rest } = input;
  const m = await saveMethod(viewer, { ...rest, gateway: 'test', token: `tok_test_${crypto.randomBytes(6).toString('hex')}` });
  if (makeDefault && !m.isDefault) await setDefault(viewer, String(m._id));
  await audit(viewer, 'payment_method.added', 'PaymentMethod', m._id);
  return (await PaymentMethod.findById(m._id))!;
}

async function setDefault(viewer: Viewer, methodId: string) {
  await PaymentMethod.updateMany({ user: viewer.id, _id: { $ne: methodId } }, { $set: { isDefault: false } });
  await PaymentMethod.updateOne({ _id: methodId, user: viewer.id }, { $set: { isDefault: true } });
}

export async function updateMethod(viewer: Viewer, methodId: string, input: { nickname?: string | null; finish?: string; isDefault?: boolean }) {
  const m = await PaymentMethod.findOne({ _id: methodId, user: viewer.id });
  if (!m) throw notFound('Saved card');
  if (input.nickname !== undefined) m.nickname = input.nickname || undefined;
  if (input.finish) m.finish = input.finish as any;
  await m.save();
  if (input.isDefault) await setDefault(viewer, methodId);
  return (await PaymentMethod.findById(methodId))!;
}

export async function removeMethod(viewer: Viewer, methodId: string) {
  const m = await PaymentMethod.findOne({ _id: methodId, user: viewer.id }).select('+token +customerId');
  if (!m) throw notFound('Saved card');
  if (m.gateway === 'razorpay' && m.customerId) await razorpayDeleteToken(m.customerId, m.token).catch((e) => logger.warn('token delete failed', { e: String(e) }));
  await m.deleteOne();
  if (m.isDefault) {
    const next = await PaymentMethod.findOne({ user: viewer.id }).sort({ createdAt: 1 });
    if (next) await setDefault(viewer, String(next._id));
  }
  await audit(viewer, 'payment_method.removed', 'PaymentMethod', m._id);
}

/** Saved cards with what was paid on each this year, and their latest payments (for the wallet). */
export async function listMethods(viewer: Viewer) {
  const methods = await PaymentMethod.find({ user: viewer.id }).sort({ isDefault: -1, createdAt: 1 }).lean();
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const pays = await Payment.find({ payer: viewer.id, 'method.savedMethod': { $in: methods.map((m) => m._id) }, status: { $in: ['paid', 'refunded'] } })
    .sort({ paidAt: -1 })
    .populate('session', 'title scheduledStart')
    .populate({ path: 'alumnus', select: 'user', populate: { path: 'user', select: 'name' } })
    .lean();
  return methods.map((m) => {
    const mine = pays.filter((p) => String(p.method?.savedMethod) === String(m._id));
    const totalPaid = mine.filter((p) => p.status === 'paid' && p.paidAt && p.paidAt >= yearStart).reduce((a, p) => a + p.amount, 0);
    return { method: m, totalPaid, recent: mine.slice(0, 3) };
  });
}

/* ------------------------------------------------------------ listings */
const populateNames = (q: any) =>
  q
    .populate('session', 'title scheduledStart')
    .populate('payer', 'name')
    .populate({ path: 'alumnus', select: 'user', populate: { path: 'user', select: 'name' } });

/** Students: their payments. Alumni: their earnings. Admin / Alumni Relations: everything. */
export async function listPayments(viewer: Viewer) {
  if (viewer.role === 'student') return populateNames(Payment.find({ payer: viewer.id, status: { $ne: 'created' } }).sort({ createdAt: -1 }).limit(200)).lean();
  if (viewer.role === 'alumnus') {
    const a = await Alumnus.findOne({ user: viewer.id }).select('_id').lean();
    if (!a) return [];
    return populateNames(Payment.find({ alumnus: a._id, status: { $in: ['paid', 'refunded'] } }).sort({ paidAt: -1 }).limit(200)).lean();
  }
  if (viewer.role === 'admin' || viewer.role === 'aro') return populateNames(Payment.find({ status: { $ne: 'created' } }).sort({ createdAt: -1 }).limit(300)).lean();
  throw forbidden();
}

export async function paymentDetail(viewer: Viewer, id: string) {
  const p = await populateNames(Payment.findById(id)).lean();
  if (!p) throw notFound('Payment');
  const isPayer = String(p.payer?._id ?? p.payer) === viewer.id;
  const isMentor = viewer.role === 'alumnus' && String(p.alumnus?.user?._id ?? '') === viewer.id;
  if (!isPayer && !isMentor && viewer.role !== 'admin' && viewer.role !== 'aro') throw forbidden();
  return p;
}
