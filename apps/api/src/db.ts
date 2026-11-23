import fs from 'node:fs';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

let embedded: { stop: (o?: { doCleanup?: boolean }) => Promise<boolean> } | null = null;

/**
 * Connects to MongoDB.
 * - If MONGODB_URI is set, uses it (production / docker-compose path).
 * - Otherwise starts (or re-uses) an embedded MongoDB persisted under LOCALAPPDATA,
 *   so the platform runs with zero external setup during development.
 */
export async function connectDb(uri?: string): Promise<string> {
  mongoose.set('strictQuery', true);
  let target = uri ?? env.mongoUri;

  if (!target) {
    const embeddedUri = `mongodb://127.0.0.1:${env.embeddedMongoPort}/amn`;
    // Re-use an embedded instance already started by another process (API vs seed script).
    try {
      await mongoose.connect(embeddedUri, { serverSelectionTimeoutMS: 1200 });
      logger.info(`Connected to existing embedded MongoDB at ${embeddedUri}`);
      return embeddedUri;
    } catch {
      await mongoose.disconnect().catch(() => undefined);
    }
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    fs.mkdirSync(env.embeddedMongoDir, { recursive: true });
    const server = await MongoMemoryServer.create({
      instance: {
        port: env.embeddedMongoPort,
        dbPath: env.embeddedMongoDir,
        storageEngine: 'wiredTiger',
      },
    });
    embedded = server;
    target = embeddedUri;
    logger.info(`Started embedded MongoDB (data: ${env.embeddedMongoDir})`);
  }

  await mongoose.connect(target);
  logger.info('MongoDB connected');
  return target;
}

export async function disconnectDb(): Promise<void> {
  // The embedded server is stopped abruptly (on Windows there is no graceful signal), which drops
  // writes not yet flushed to disk. Flush first so e.g. `npm run seed` keeps everything it wrote.
  if (embedded) await mongoose.connection.db?.admin().command({ fsync: 1 }).catch((e) => logger.warn('fsync before shutdown failed', { e: String(e) }));
  await mongoose.disconnect();
  if (embedded) {
    await embedded.stop({ doCleanup: false }); // keep the persisted data directory
    embedded = null;
  }
}
