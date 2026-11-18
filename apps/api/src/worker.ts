/**
 * Dedicated background worker for production deployments (set JOBS_IN_PROCESS=false on the API).
 * Requires a real MONGODB_URI shared with the API.
 */
import { env } from './config/env.js';
import { assertProductionConfig } from './config/validate.js';
import { connectDb } from './db.js';
import { startJobs } from './jobs/index.js';
import { logger } from './lib/logger.js';

try {
  assertProductionConfig(); // no-op outside production
} catch (e) {
  logger.error(String((e as Error).message));
  process.exit(1);
}

if (!env.mongoUri) {
  logger.warn('Worker needs MONGODB_URI. In local development jobs run inside the API process (JOBS_IN_PROCESS=true).');
  process.exit(0);
}

connectDb()
  .then(() => startJobs())
  .catch((e) => {
    logger.error('Worker failed to start', { e: String(e) });
    process.exit(1);
  });
