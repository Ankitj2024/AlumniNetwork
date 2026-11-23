/**
 * Paid sessions: holds, checkout through the test gateway and a stubbed Razorpay, refunds,
 * hold expiry, saved cards, and the rule that card numbers never reach the server.
 */
import crypto from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { Alumnus, Mentorship, Payment, PaymentMethod, Session } from '../src/models/index.js';
import { maskVpa, setRazorpayFetch, verifyCheckoutSignature, verifyWebhookSignature } from '../src/services/gateway.js';
import { releaseExpiredHolds } from '../src/services/payments.js';
import { api, auth, clearDb, makeMentor, makeStaff, makeStudent, setSettings, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const YEAR = new Date().getFullYear();
const CARD = { type: 'card', network: 'visa', cardType: 'credit', last4: '4242', expMonth: 12, expYear: YEAR + 2, holder: 'Test Student' } as const;

async function pair(fee = 499) {
  const mentor = await makeMentor();
  await Alumnus.updateOne({ _id: mentor.alumnus._id }, { $set: { sessionFee: fee } });
  const student = await makeStudent();
  const m = await Mentorship.create({ student: student.profile._id, alumnus: mentor.alumnus._id });
  return { mu: mentor.user, su: student.user, alumnus: mentor.alumnus, m };
}

/** Mentor proposes one slot `hoursAhead` from now; the student books it. */
async function book(p: Awaited<ReturnType<typeof pair>>, hoursAhead = 72) {
  const start = new Date(Date.now() + hoursAhead * 3600e3);
  const prop = await api().post(`/api/mentorships/${p.m._id}/sessions`).set(auth(p.mu)).send({ slots: [{ start, end: new Date(start.getTime() + 3600e3) }], title: 'Mock interview' });
  expect(prop.status).toBe(201);
  const res = await api().post(`/api/mentorships/${p.m._id}/sessions/${prop.body.session.id}/book`).set(auth(p.su)).send({ slotIndex: 0 });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.session;
}

async function payWith(p: Awaited<ReturnType<typeof pair>>, sessionId: string, method: object = { ...CARD, save: true }) {
  const co = await api().post('/api/payments/checkout').set(auth(p.su)).send({ sessionId });
  expect(co.status, JSON.stringify(co.body)).toBe(201);
  const done = await api().post('/api/payments/test/complete').set(auth(p.su)).send({ paymentId: co.body.checkout.paymentId, method });
  expect(done.status, JSON.stringify(done.body)).toBe(200);
  return { checkout: co.body.checkout, ...done.body };
}

describe('paid sessions', () => {
  it('a free mentor’s session is confirmed straight away', async () => {
    const p = await pair(0);
    const s = await book(p);
    expect(s.status).toBe('scheduled');
    expect(s.videoLink).toBeTruthy();
    expect(s.fee).toBe(0);
    expect(await Payment.countDocuments()).toBe(0);
  });

  it('a paid session is held, paid, then confirmed — and each side sees the right details', async () => {
    const p = await pair(499);
    const held = await book(p);
    expect(held.status).toBe('awaiting_payment');
    expect(held.fee).toBe(49900);
    expect(held.videoLink).toBeNull();
    const due = new Date(held.paymentDueAt).getTime() - Date.now();
    expect(due).toBeGreaterThan(25 * 60e3);
    expect(due).toBeLessThanOrEqual(30 * 60e3 + 5e3);

    const r = await payWith(p, held.id);
    expect(r.checkout).toMatchObject({ gateway: 'test', amount: 49900, currency: 'INR' });
    expect(r.ok).toBe(true);
    expect(r.session.status).toBe('scheduled');
    expect(r.session.videoLink).toBeTruthy();
    expect(r.session.paid).toBe(true);
    expect(r.payment).toMatchObject({ status: 'paid', amount: 49900, method: { kind: 'card', last4: '4242', label: 'Visa •••• 4242' } });
    expect(r.payment.receiptNo).toMatch(/^AMN-\d{8}-[0-9A-F]{6}$/);

    const db = await Payment.findOne().lean();
    expect(db).toMatchObject({ platformFee: 4990, mentorShare: 44910, gateway: 'test' });

    // the saved card: shown to its owner with this year's total; the gateway token never leaves
    const methods = await api().get('/api/payments/methods').set(auth(p.su));
    expect(methods.body.methods).toHaveLength(1);
    expect(methods.body.methods[0]).toMatchObject({ last4: '4242', network: 'visa', isDefault: true, totalPaid: 49900 });
    expect(methods.body.methods[0].recent[0]).toMatchObject({ amount: -49900, title: 'Mock interview' });
    expect(JSON.stringify(methods.body)).not.toContain('tok_test_');

    // the mentor sees their share, not the student's card
    const mine = await api().get('/api/payments').set(auth(p.mu));
    expect(mine.body.payments[0]).toMatchObject({ amount: 49900, platformFee: 4990, mentorShare: 44910 });
    expect(mine.body.payments[0].method).toBeUndefined();
    const one = await api().get(`/api/payments/${r.payment.id}`).set(auth(p.mu));
    expect(one.status).toBe(200);
    expect(one.body.payment.method).toBeUndefined();
    // the student sees how they paid, not the split
    const hist = await api().get('/api/payments').set(auth(p.su));
    expect(hist.body.payments[0].method.last4).toBe('4242');
    expect(hist.body.payments[0].mentorShare).toBeUndefined();
    // a stranger sees nothing
    const other = await makeStudent();
    expect((await api().get(`/api/payments/${r.payment.id}`).set(auth(other.user))).status).toBe(403);
  });

  it('a declined test card keeps the slot held, and paying again works', async () => {
    const p = await pair();
    const held = await book(p);
    const bad = await payWith(p, held.id, { ...CARD, last4: '0002' });
    expect(bad.ok).toBe(false);
    expect(bad.payment.status).toBe('failed');
    expect(bad.payment.failureReason).toMatch(/declined/);
    expect(bad.session.status).toBe('awaiting_payment');
    const good = await payWith(p, held.id, { type: 'upi', vpa: 'aarav.sharma@okhdfc' });
    expect(good.ok).toBe(true);
    expect(good.payment.method).toMatchObject({ kind: 'upi', vpa: 'aa***@okhdfc' });
    expect(good.session.status).toBe('scheduled');
  });

  it('only the student in the mentorship can pay', async () => {
    const p = await pair();
    const held = await book(p);
    expect((await api().post('/api/payments/checkout').set(auth(p.mu)).send({ sessionId: held.id })).status).toBe(403);
    const other = await makeStudent();
    expect((await api().post('/api/payments/checkout').set(auth(other.user)).send({ sessionId: held.id })).status).toBe(403);
  });

  it('an unpaid hold is released by the job and the attempt closed', async () => {
    const p = await pair();
    const held = await book(p);
    await api().post('/api/payments/checkout').set(auth(p.su)).send({ sessionId: held.id });
    expect(await releaseExpiredHolds(() => new Date(Date.now() + 31 * 60e3))).toBe(1);
    const s = await Session.findById(held.id).lean();
    expect(s!.status).toBe('proposed');
    expect(s!.scheduledStart).toBeUndefined();
    expect((await Payment.findOne().lean())!.status).toBe('failed');
    // the slot can be booked (and paid) again
    const again = await api().post(`/api/mentorships/${p.m._id}/sessions/${held.id}/book`).set(auth(p.su)).send({ slotIndex: 0 });
    expect(again.body.session.status).toBe('awaiting_payment');
  });

  it('refund rules: mentor cancels → refunded; student cancels late → kept; student cancels early → refunded', async () => {
    const p = await pair();
    const a = await book(p, 72);
    await payWith(p, a.id);
    const c1 = await api().post(`/api/mentorships/${p.m._id}/sessions/${a.id}/cancel`).set(auth(p.mu)).send({ reason: 'Travel' });
    expect(c1.body.refund).toMatchObject({ refunded: true, amount: 49900, status: 'processed' });
    expect((await Payment.findOne({ session: a.id }).lean())!.status).toBe('refunded');

    const b = await book(p, 10); // inside the 24-hour cutoff
    await payWith(p, b.id, { type: 'saved', methodId: String((await PaymentMethod.findOne().lean())!._id) });
    const c2 = await api().post(`/api/mentorships/${p.m._id}/sessions/${b.id}/cancel`).set(auth(p.su)).send({});
    expect(c2.body.refund).toMatchObject({ refunded: false, status: 'late', cutoffHours: 24 });
    expect((await Payment.findOne({ session: b.id }).lean())!.status).toBe('paid');

    const c = await book(p, 96);
    await payWith(p, c.id);
    const c3 = await api().post(`/api/mentorships/${p.m._id}/sessions/${c.id}/cancel`).set(auth(p.su)).send({});
    expect(c3.body.refund.refunded).toBe(true);

    // staff can refund the late one (e.g. a dispute)
    const admin = await makeStaff('admin');
    const late = await Payment.findOne({ session: b.id }).lean();
    const sr = await api().post(`/api/payments/${late!._id}/refund`).set(auth(admin)).send({ reason: 'Goodwill refund' });
    expect(sr.body.payment.status).toBe('refunded');
  });

  it('card numbers and CVVs are refused; only display details are stored', async () => {
    const p = await pair();
    const withNumber = await api().post('/api/payments/methods').set(auth(p.su)).send({ ...CARD, type: undefined, number: '4242424242424242', cvv: '123' });
    expect(withNumber.status).toBe(400);
    const held = await book(p);
    const co = await api().post('/api/payments/checkout').set(auth(p.su)).send({ sessionId: held.id });
    const sneaky = await api().post('/api/payments/test/complete').set(auth(p.su)).send({ paymentId: co.body.checkout.paymentId, method: { ...CARD, number: '4242424242424242' } });
    expect(sneaky.status).toBe(400);
    const ok = await api().post('/api/payments/methods').set(auth(p.su)).send({ network: 'rupay', cardType: 'debit', last4: '6521', expMonth: 3, expYear: YEAR + 3, nickname: 'SBI' });
    expect(ok.status).toBe(201);
    const docs = await PaymentMethod.find().select('+token').lean();
    expect(JSON.stringify(docs)).not.toMatch(/\d{12,19}/);
  });

  it('turning paid sessions off makes booking free; mentors can’t exceed the fee cap', async () => {
    const p = await pair(499);
    await setSettings({ 'payments.enabled': false });
    expect((await book(p)).status).toBe('scheduled');
    expect((await api().get('/api/payments/config').set(auth(p.su))).body.config.enabled).toBe(false);
    await setSettings({ 'payments.enabled': true, 'payments.maxSessionFee': 300 });
    const tooHigh = await api().put('/api/alumni/me').set(auth(p.mu)).send({ sessionFee: 500 });
    expect(tooHigh.status).toBe(400);
    expect(tooHigh.body.error.code).toBe('fee_too_high');
    expect((await api().put('/api/alumni/me').set(auth(p.mu)).send({ sessionFee: 250 })).status).toBe(200);
    // an old, higher fee is capped at booking time
    await Alumnus.updateOne({ _id: p.alumnus._id }, { $set: { sessionFee: 900 } });
    expect((await book(p, 120)).fee).toBe(30000); // a different time: the first session already holds 72h ahead
  });
});

describe('Razorpay', () => {
  const saved = { gateway: env.paymentGateway, rz: { ...env.razorpay } };
  afterEach(() => {
    env.paymentGateway = saved.gateway;
    Object.assign(env.razorpay, saved.rz);
    setRazorpayFetch(null);
  });

  it('checks checkout and webhook signatures', () => {
    const sig = crypto.createHmac('sha256', 'shh').update('order_1|pay_1').digest('hex');
    expect(verifyCheckoutSignature('order_1', 'pay_1', sig, 'shh')).toBe(true);
    expect(verifyCheckoutSignature('order_1', 'pay_2', sig, 'shh')).toBe(false);
    expect(verifyCheckoutSignature('order_1', 'pay_1', sig, '')).toBe(false);
    const body = Buffer.from('{"event":"payment.captured"}');
    const wsig = crypto.createHmac('sha256', 'wh').update(body).digest('hex');
    expect(verifyWebhookSignature(body, wsig, 'wh')).toBe(true);
    expect(verifyWebhookSignature(Buffer.from('{"event":"x"}'), wsig, 'wh')).toBe(false);
    expect(maskVpa('aarav.sharma@okhdfc')).toBe('aa***@okhdfc');
  });

  /** Switches the app to Razorpay and answers Razorpay's API with canned responses. */
  function stubRazorpay() {
    env.paymentGateway = 'razorpay';
    Object.assign(env.razorpay, { keyId: 'rzp_test_key', keySecret: 'key_secret', webhookSecret: 'hook_secret' });
    const calls: string[] = [];
    const payment = (status: string) => ({ id: 'pay_rzp_1', order_id: 'order_rzp_1', amount: 49900, currency: 'INR', status, method: 'card', card: { last4: '1111', network: 'Visa', type: 'debit' }, token_id: 'token_1', customer_id: 'cust_1' });
    setRazorpayFetch((async (url: string, init?: RequestInit) => {
      const path = String(url).replace(env.razorpay.apiBase, '');
      calls.push(`${init?.method} ${path}`);
      const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
      if (path === '/orders') return json({ id: 'order_rzp_1' });
      if (path === '/customers') return json({ id: 'cust_1' });
      if (path === '/payments/pay_rzp_1') return json(payment('authorized'));
      if (path === '/payments/pay_rzp_1/capture') return json(payment('captured'));
      if (path === '/payments/pay_rzp_1/refund') return json({ id: 'rfnd_rzp_1', status: 'processed' });
      if (path === '/customers/cust_1/tokens/token_1') return json({ id: 'token_1', card: { last4: '1111', network: 'Visa', type: 'debit', issuer: 'HDFC', expiry_month: '12', expiry_year: String(YEAR + 4), name: 'Test Student' } });
      return new Response('{}', { status: 404 });
    }) as typeof fetch);
    return calls;
  }
  const signed = (body: object) => {
    const raw = JSON.stringify(body);
    return { raw, sig: crypto.createHmac('sha256', 'hook_secret').update(raw).digest('hex') };
  };
  const goodSignature = crypto.createHmac('sha256', 'key_secret').update('order_rzp_1|pay_rzp_1').digest('hex');

  it('a failed card on the Razorpay window, then a working one on the same order, confirms the session', async () => {
    stubRazorpay();
    const p = await pair();
    const held = await book(p);
    const co = await api().post('/api/payments/checkout').set(auth(p.su)).send({ sessionId: held.id });
    const failed = signed({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_rzp_0', order_id: 'order_rzp_1', error_description: 'Card declined' } } } });
    expect((await api().post('/api/payments/webhook/razorpay').set('content-type', 'application/json').set('x-razorpay-signature', failed.sig).send(failed.raw)).status).toBe(200);
    expect((await Payment.findOne().lean())!.status).toBe('created'); // still payable
    const ok = await api().post('/api/payments/razorpay/verify').set(auth(p.su)).send({ paymentId: co.body.checkout.paymentId, razorpay_order_id: 'order_rzp_1', razorpay_payment_id: 'pay_rzp_1', razorpay_signature: goodSignature });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.session.status).toBe('scheduled');
  });

  it('money that arrives after the hold lapsed is recorded and refunded, never dropped', async () => {
    const calls = stubRazorpay();
    const p = await pair();
    const held = await book(p);
    const co = await api().post('/api/payments/checkout').set(auth(p.su)).send({ sessionId: held.id });
    expect(await releaseExpiredHolds(() => new Date(Date.now() + 31 * 60e3))).toBe(1);
    expect((await Payment.findOne().lean())!.status).toBe('failed');
    // the student finishes paying in the still-open Razorpay window (or the webhook arrives)
    const late = signed({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_rzp_1', order_id: 'order_rzp_1' } } } });
    expect((await api().post('/api/payments/webhook/razorpay').set('content-type', 'application/json').set('x-razorpay-signature', late.sig).send(late.raw)).status).toBe(200);
    const pay = await Payment.findOne().lean();
    expect(pay).toMatchObject({ status: 'refunded', gatewayPaymentId: 'pay_rzp_1', refund: { status: 'processed', amount: 49900 } });
    expect(calls).toContain('POST /payments/pay_rzp_1/refund');
    expect((await Session.findById(held.id).lean())!.status).toBe('proposed');
    // a duplicate verify afterwards changes nothing
    const again = await api().post('/api/payments/razorpay/verify').set(auth(p.su)).send({ paymentId: co.body.checkout.paymentId, razorpay_order_id: 'order_rzp_1', razorpay_payment_id: 'pay_rzp_1', razorpay_signature: goodSignature });
    expect(again.status).toBe(200);
    expect(await Payment.countDocuments({ status: 'refunded' })).toBe(1);
  });

  it('pays through a stubbed Razorpay: order → checkout signature → capture → saved card; webhook is idempotent', async () => {
    const calls = stubRazorpay();
    const p = await pair();
    const held = await book(p);
    const co = await api().post('/api/payments/checkout').set(auth(p.su)).send({ sessionId: held.id });
    expect(co.status, JSON.stringify(co.body)).toBe(201);
    expect(co.body.checkout).toMatchObject({ gateway: 'razorpay', orderId: 'order_rzp_1', keyId: 'rzp_test_key', customerId: 'cust_1', amount: 49900 });

    const bad = await api().post('/api/payments/razorpay/verify').set(auth(p.su)).send({ paymentId: co.body.checkout.paymentId, razorpay_order_id: 'order_rzp_1', razorpay_payment_id: 'pay_rzp_1', razorpay_signature: 'forged' });
    expect(bad.status).toBe(400);

    const signature = crypto.createHmac('sha256', 'key_secret').update('order_rzp_1|pay_rzp_1').digest('hex');
    const ok = await api().post('/api/payments/razorpay/verify').set(auth(p.su)).send({ paymentId: co.body.checkout.paymentId, razorpay_order_id: 'order_rzp_1', razorpay_payment_id: 'pay_rzp_1', razorpay_signature: signature });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.session.status).toBe('scheduled');
    expect(calls).toContain('POST /payments/pay_rzp_1/capture');
    const card = await PaymentMethod.findOne().select('+token +customerId').lean();
    expect(card).toMatchObject({ gateway: 'razorpay', token: 'token_1', customerId: 'cust_1', last4: '1111', network: 'visa', issuer: 'HDFC' });

    // the webhook for the same payment arriving later changes nothing
    const event = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_rzp_1', order_id: 'order_rzp_1' } } } };
    const raw = JSON.stringify(event);
    const hook = await api().post('/api/payments/webhook/razorpay').set('content-type', 'application/json').set('x-razorpay-signature', crypto.createHmac('sha256', 'hook_secret').update(raw).digest('hex')).send(raw);
    expect(hook.status).toBe(200);
    expect(await Payment.countDocuments({ status: 'paid' })).toBe(1);
    const forged = await api().post('/api/payments/webhook/razorpay').set('content-type', 'application/json').set('x-razorpay-signature', 'nope').send(raw);
    expect(forged.status).toBe(400);
  });
});
