import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from '../lib/errors.js';

/**
 * Payment gateways. Card numbers never reach this server: the student types them into the gateway's
 * own checkout (Razorpay Checkout), and we only receive the result, a signature to check, and
 * display details (network, last four digits) plus a token for saved cards.
 */

export type Network = 'visa' | 'mastercard' | 'rupay' | 'amex' | 'other';
export type CardType = 'credit' | 'debit' | 'prepaid';
export type MethodInfo = { kind: 'card' | 'upi' | 'netbanking' | 'wallet' | 'other'; network?: Network; last4?: string; vpa?: string };
export type TokenInfo = { id: string; customerId: string; network: Network; cardType: CardType; issuer?: string; last4: string; expMonth: number; expYear: number; holder?: string };
export type GatewayName = 'test' | 'razorpay';

export interface Gateway {
  readonly name: GatewayName;
  createOrder(o: { amount: number; receipt: string; notes: Record<string, string> }): Promise<{ orderId: string }>;
  refund(gatewayPaymentId: string, amount: number): Promise<{ refundId: string; status: 'pending' | 'processed' }>;
}

const rand = (n = 10) => crypto.randomBytes(n).toString('hex').slice(0, n * 2);

/* ------------------------------------------------------------ test gateway */
/** Development only: no money moves, orders and refunds succeed instantly. Refused in production. */
export const testGateway: Gateway = {
  name: 'test',
  async createOrder() {
    return { orderId: `order_test_${rand(8)}` };
  },
  async refund() {
    return { refundId: `rfnd_test_${rand(8)}`, status: 'processed' };
  },
};

/* --------------------------------------------------------------- Razorpay */
/** Overridable so tests can stand in for Razorpay's servers. */
let rzpFetch: typeof fetch = (...a) => fetch(...a);
export function setRazorpayFetch(f: typeof fetch | null) {
  rzpFetch = f ?? ((...a) => fetch(...a));
}

async function rzp<T = any>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`).toString('base64');
  const res = await rzpFetch(`${env.razorpay.apiBase}${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, 'gateway_error', `Payment gateway error: ${data?.error?.description ?? res.statusText}`);
  return data as T;
}

const NETWORKS: Record<string, Network> = { visa: 'visa', mastercard: 'mastercard', rupay: 'rupay', 'american express': 'amex', amex: 'amex' };
export const toNetwork = (s?: string | null): Network => NETWORKS[(s ?? '').toLowerCase()] ?? 'other';
const toCardType = (s?: string | null): CardType => (s === 'credit' || s === 'prepaid' ? s : 'debit');

export const razorpayGateway: Gateway = {
  name: 'razorpay',
  async createOrder(o) {
    const r = await rzp<{ id: string }>('POST', '/orders', { amount: o.amount, currency: 'INR', receipt: o.receipt, notes: o.notes });
    return { orderId: r.id };
  },
  async refund(gatewayPaymentId, amount) {
    const r = await rzp<{ id: string; status: string }>('POST', `/payments/${encodeURIComponent(gatewayPaymentId)}/refund`, { amount, speed: 'normal' });
    return { refundId: r.id, status: r.status === 'processed' ? 'processed' : 'pending' };
  },
};

/** Details of a Razorpay payment after checkout; captures it if the account doesn't auto-capture. */
export async function razorpayPaymentDetails(paymentId: string, expected: { orderId: string; amount: number }): Promise<{ method: MethodInfo; token?: TokenInfo }> {
  let p = await rzp<any>('GET', `/payments/${encodeURIComponent(paymentId)}`);
  if (p.order_id !== expected.orderId || p.amount !== expected.amount || p.currency !== 'INR') throw new HttpError(400, 'payment_mismatch', 'The payment does not match this order');
  if (p.status === 'authorized') p = await rzp<any>('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: expected.amount, currency: 'INR' });
  if (p.status !== 'captured') throw new HttpError(400, 'payment_not_captured', `Payment is ${p.status}`);
  const kind: MethodInfo['kind'] = ['card', 'upi', 'netbanking', 'wallet'].includes(p.method) ? p.method : 'other';
  const method: MethodInfo = { kind, network: p.card ? toNetwork(p.card.network) : undefined, last4: p.card?.last4, vpa: p.vpa ? maskVpa(p.vpa) : undefined };
  let token: TokenInfo | undefined;
  if (p.token_id && p.customer_id) {
    const t = await rzp<any>('GET', `/customers/${encodeURIComponent(p.customer_id)}/tokens/${encodeURIComponent(p.token_id)}`).catch(() => null);
    const card = t?.card ?? p.card;
    if (card?.last4) {
      token = {
        id: p.token_id,
        customerId: p.customer_id,
        network: toNetwork(card.network),
        cardType: toCardType(card.type),
        issuer: card.issuer ?? undefined,
        last4: card.last4,
        expMonth: Number(card.expiry_month) || 12,
        expYear: Number(card.expiry_year) || new Date().getFullYear() + 3,
        holder: card.name ?? undefined,
      };
    }
  }
  return { method, token };
}

/** One Razorpay customer per student, so cards they choose to save can be offered next time. */
export async function razorpayCustomer(name: string, email?: string): Promise<string> {
  const r = await rzp<{ id: string }>('POST', '/customers', { name, email, fail_existing: '0' });
  return r.id;
}

export async function razorpayDeleteToken(customerId: string, tokenId: string) {
  await rzp('DELETE', `/customers/${encodeURIComponent(customerId)}/tokens/${encodeURIComponent(tokenId)}`);
}

/* -------------------------------------------------------------- signatures */
const hmac = (data: string | Buffer, secret: string) => crypto.createHmac('sha256', secret).update(data).digest('hex');
function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Razorpay Checkout returns signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret = env.razorpay.keySecret) {
  if (!secret || !signature) return false;
  return safeEqual(hmac(`${orderId}|${paymentId}`, secret), signature);
}

/** Webhooks carry X-Razorpay-Signature = HMAC-SHA256(raw request body, webhook secret). */
export function verifyWebhookSignature(rawBody: Buffer | undefined, signature: string | undefined, secret = env.razorpay.webhookSecret) {
  if (!secret || !signature || !rawBody) return false;
  return safeEqual(hmac(rawBody, secret), signature);
}

/* -------------------------------------------------------------------- misc */
export function gatewayFor(name: GatewayName): Gateway {
  return name === 'razorpay' ? razorpayGateway : testGateway;
}

/** "aarav.sharma@okhdfc" → "aa***@okhdfc". UPI ids identify people, so only a hint is kept. */
export function maskVpa(vpa: string) {
  const [user, host] = vpa.split('@');
  return `${(user ?? '').slice(0, 2)}***@${host ?? ''}`;
}
