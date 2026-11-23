'use client';
import { useEffect, useState } from 'react';
import { get } from './api';

export type PaymentConfig = {
  /** Paid sessions are switched on (gateway configured and allowed in programme settings). */
  enabled: boolean;
  gateway: 'test' | 'razorpay' | 'off';
  currency: 'INR';
  /** Razorpay public key id (safe to expose); null for the test gateway. */
  keyId: string | null;
  maxSessionFee: number;
  platformFeePercent: number;
  refundCutoffHours: number;
};

export type SavedMethod = {
  id: string;
  network: 'visa' | 'mastercard' | 'rupay' | 'amex' | 'other';
  cardType: 'credit' | 'debit' | 'prepaid';
  issuer: string | null;
  nickname: string | null;
  last4: string;
  expMonth: number;
  expYear: number;
  holder: string | null;
  finish: 'metal' | 'black' | 'glass' | 'color';
  isDefault: boolean;
  totalPaid: number; // paise, this calendar year
  recent: { id: string; mentorName: string; title: string; amount: number; status: string; at: string }[];
};

export type PaymentRow = {
  id: string;
  receiptNo: string;
  status: 'created' | 'paid' | 'failed' | 'refunded';
  amount: number;
  platformFee?: number;
  mentorShare?: number;
  currency: 'INR';
  sessionId: string | null;
  sessionTitle: string | null;
  sessionStart: string | null;
  mentorshipId: string | null;
  mentorName?: string | null;
  studentName?: string | null;
  method?: { kind: string; network: string | null; last4: string | null; vpa: string | null; label: string } | null;
  refund?: { amount: number; status: string; reason: string | null; at: string | null } | null;
  failureReason?: string | null;
  paidAt: string | null;
  createdAt: string;
};

let cache: Promise<PaymentConfig> | null = null;
const OFF: PaymentConfig = { enabled: false, gateway: 'off', currency: 'INR', keyId: null, maxSessionFee: 0, platformFeePercent: 0, refundCutoffHours: 24 };

export function loadPaymentConfig(force = false): Promise<PaymentConfig> {
  if (!cache || force) cache = get<{ config: PaymentConfig }>('/payments/config').then((r) => r.config).catch(() => ((cache = null), OFF));
  return cache;
}

/** Payment settings, fetched once per page load and shared by every component. */
export function usePaymentConfig(): PaymentConfig | null {
  const [c, setC] = useState<PaymentConfig | null>(null);
  useEffect(() => {
    let alive = true;
    loadPaymentConfig().then((v) => alive && setC(v));
    return () => {
      alive = false;
    };
  }, []);
  return c;
}

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
/** ₹ amount from paise. Whole rupees show without decimals (₹499), others with two (₹449.10). */
export function inr(paise: number) {
  const r = paise / 100;
  return Number.isInteger(r) ? INR.format(r) : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(r);
}

export const NETWORK_LABEL: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', rupay: 'RuPay', amex: 'Amex', other: 'Card' };

/* Card helpers for the card forms. The full number never leaves the browser: only the network,
   last four digits and expiry are sent (the real gateway, Razorpay, collects cards in its own checkout). */
export const digits = (s: string) => s.replace(/\D/g, '');
export function detectNetwork(num: string): SavedMethod['network'] {
  const d = digits(num);
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'mastercard';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^(60|65|81|82|508)/.test(d)) return 'rupay';
  return 'other';
}
export function luhn(num: string) {
  const d = digits(num);
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return d.length >= 12 && sum % 10 === 0;
}
export const formatCard = (s: string) => digits(s).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
/** "MM/YY" → { month, year } when valid and not in the past. */
export function parseExpiry(exp: string): { month: number; year: number } | null {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(exp.trim());
  if (!m) return null;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  const now = new Date();
  if (month < 1 || month > 12 || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return null;
  return { month, year };
}
