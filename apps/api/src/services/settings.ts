import { Settings } from '../models/index.js';

export type ProgrammeSettings = {
  matchingWeights: Record<'expertise' | 'targetRole' | 'industry' | 'mentoringAreas' | 'department' | 'availability' | 'loadBalance', number>;
  throttle: {
    maxPendingRequests: number;
    maxRequestsPerPeriod: number;
    periodDays: number;
    reRequestCooldownDays: number;
    maxActiveMentorshipsPerStudent: number;
  };
  requestExpiryDays: number;
  engagement: { atRiskDays: number; lapsedDays: number; nudgeCooldownDays: number };
  verification: { autoApproveExactMatch: boolean };
  payments: { enabled: boolean; platformFeePercent: number; maxSessionFee: number; refundCutoffHours: number };
};

/** Defaults for settings groups added after a database was first created (lean reads skip schema defaults). */
const PAYMENT_DEFAULTS = { enabled: true, platformFeePercent: 10, maxSessionFee: 5000, refundCutoffHours: 24 };

/** Settings live in the database so administrators can tune them without a deploy. */
export async function getSettings(): Promise<ProgrammeSettings> {
  let s = await Settings.findOne({ key: 'global' }).lean();
  if (!s) {
    await Settings.updateOne({ key: 'global' }, { $setOnInsert: { key: 'global' } }, { upsert: true });
    s = await Settings.findOne({ key: 'global' }).lean();
  }
  const out = s as unknown as ProgrammeSettings;
  return { ...out, payments: { ...PAYMENT_DEFAULTS, ...(out.payments ?? {}) } };
}

export function settingsView(s: ProgrammeSettings) {
  return {
    matchingWeights: s.matchingWeights,
    throttle: s.throttle,
    requestExpiryDays: s.requestExpiryDays,
    engagement: s.engagement,
    verification: s.verification,
    payments: s.payments,
  };
}
