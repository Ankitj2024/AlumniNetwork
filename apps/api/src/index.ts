import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { assertProductionConfig } from './config/validate.js';
import { connectDb, disconnectDb } from './db.js';
import { startJobs } from './jobs/index.js';
import { logger } from './lib/logger.js';
import { User } from './models/index.js';
import { attachSocket } from './socket.js';

async function main() {
  assertProductionConfig(); // no-op outside production
  await connectDb();

  if (env.seedOnEmpty && !env.isProd && (await User.countDocuments({})) === 0) {
    // No users at all: safe to clear any partial leftovers and load the demo data set.
    logger.info('No users found — loading demo seed data');
    const { runSeed } = await import('./seed/seed.js');
    await runSeed({ reset: true });
  }

  const app = createApp();
  const server = http.createServer(app);
  attachSocket(server);
  if (env.jobsInProcess) startJobs();

  server.listen(env.port, () => logger.info(`API listening on http://localhost:${env.port}`));

  const shutdown = async () => {
    logger.info('Shutting down');
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  logger.error('Fatal startup error', { e: e?.stack ?? String(e) });
  process.exit(1);
});
