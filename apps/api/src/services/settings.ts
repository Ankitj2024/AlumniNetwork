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
};

/** Settings live in the database so administrators can tune them without a deploy. */
export async function getSettings(): Promise<ProgrammeSettings> {
  let s = await Settings.findOne({ key: 'global' }).lean();
  if (!s) {
    await Settings.updateOne({ key: 'global' }, { $setOnInsert: { key: 'global' } }, { upsert: true });
    s = await Settings.findOne({ key: 'global' }).lean();
  }
  return s as unknown as ProgrammeSettings;
}

export function settingsView(s: ProgrammeSettings) {
  return {
    matchingWeights: s.matchingWeights,
    throttle: s.throttle,
    requestExpiryDays: s.requestExpiryDays,
    engagement: s.engagement,
    verification: s.verification,
  };
}
