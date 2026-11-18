import { MentorCapacity } from '../models/index.js';

/**
 * Capacity enforcement (spec §8, Track J): a single conditional update that only succeeds while
 * activeCount < maxMentees and the mentor is not paused. MongoDB applies the filter and the $inc
 * atomically on one document, so N concurrent acceptances can never push activeCount past the limit.
 */
export async function claimSlot(alumnusId: unknown, now = new Date()): Promise<boolean> {
  const updated = await MentorCapacity.findOneAndUpdate(
    {
      alumnus: alumnusId,
      $or: [{ paused: false }, { paused: true, pausedUntil: { $lte: now } }],
      $expr: { $lt: ['$activeCount', '$maxMentees'] },
    },
    { $inc: { activeCount: 1 } },
    { new: true },
  ).lean();
  return !!updated;
}

/** Releases a slot (mentorship ended, or rollback after a failed acceptance). Never goes below zero. */
export async function releaseSlot(alumnusId: unknown): Promise<void> {
  await MentorCapacity.updateOne({ alumnus: alumnusId, activeCount: { $gt: 0 } }, { $inc: { activeCount: -1 } });
}

/** A mentor is "accepting" when not paused, below their mentee limit and below their open-request limit. */
export function isAccepting(cap: any, pendingCount: number, now = new Date()): boolean {
  if (!cap) return false;
  const paused = cap.paused && !(cap.pausedUntil && new Date(cap.pausedUntil) <= now);
  return !paused && cap.activeCount < cap.maxMentees && pendingCount < (cap.maxPendingRequests ?? 5);
}

export async function autoResumeExpiredPauses(now = new Date()): Promise<number> {
  const r = await MentorCapacity.updateMany(
    { paused: true, pausedUntil: { $lte: now } },
    { $set: { paused: false }, $unset: { pausedUntil: 1, pauseReason: 1 } },
  );
  return r.modifiedCount;
}
