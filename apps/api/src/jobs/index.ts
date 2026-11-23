import cron from 'node-cron';
import { logger } from '../lib/logger.js';
import { autoResumeExpiredPauses } from '../services/capacity.js';
import { runEngagementDecay, sendActionItemReminders } from '../services/engagement.js';
import { expireRequests } from '../services/requests.js';
import { releaseExpiredHolds } from '../services/payments.js';
import { sendSessionReminders } from '../services/sessions.js';

type Job = { name: string; schedule: string; run: () => Promise<unknown> };

export const JOBS: Job[] = [
  { name: 'request-expiry', schedule: '*/10 * * * *', run: () => expireRequests() },
  { name: 'session-reminders', schedule: '*/5 * * * *', run: () => sendSessionReminders() },
  { name: 'payment-holds', schedule: '*/2 * * * *', run: () => releaseExpiredHolds() },
  { name: 'action-item-reminders', schedule: '15 * * * *', run: () => sendActionItemReminders() },
  { name: 'auto-resume-pauses', schedule: '30 * * * *', run: () => autoResumeExpiredPauses() },
  // Weekly engagement-decay job: Mondays 06:00 server time
  { name: 'engagement-decay', schedule: '0 6 * * 1', run: () => runEngagementDecay() },
];

const running = new Set<string>();

export function startJobs() {
  for (const job of JOBS) {
    cron.schedule(job.schedule, async () => {
      if (running.has(job.name)) return; // no overlapping runs
      running.add(job.name);
      const t = Date.now();
      try {
        const result = await job.run();
        logger.info(`job ${job.name} done`, { ms: Date.now() - t, result });
      } catch (e) {
        logger.error(`job ${job.name} failed`, { e: String(e) });
      } finally {
        running.delete(job.name);
      }
    });
  }
  logger.info(`Scheduled ${JOBS.length} background jobs`);
}
