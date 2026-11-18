/**
 * First-run setup for a real (production or staging) database. Safe to run more than once.
 *
 *   npm run bootstrap -w apps/api -- --admin-email you@college.edu --admin-name "Your Name"
 *   (after a build: node dist/seed/bootstrap.js --admin-email ...)
 *
 * It:
 *  1. creates the programme settings with their defaults,
 *  2. loads the default expertise-tag list if there are no tags yet,
 *  3. creates the first administrator (no password) and emails them a link to choose one.
 *
 * Demo data is never loaded here. Import the alumni register afterwards from Admin → Records.
 */
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { connectDb, disconnectDb } from '../db.js';
import { ExpertiseTag, Settings, User } from '../models/index.js';
import { sendInviteEmail } from '../services/account.js';
import { TAGS } from './data.js';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export async function bootstrap(opts: { adminEmail?: string; adminName?: string }) {
  const log: string[] = [];
  await Settings.updateOne({ key: 'global' }, { $setOnInsert: { key: 'global' } }, { upsert: true });
  log.push('Programme settings: ready');

  if ((await ExpertiseTag.countDocuments()) === 0) {
    const docs = Object.entries(TAGS).flatMap(([category, names]) => names.map((name) => ({ name, slug: slug(name), category })));
    await ExpertiseTag.insertMany(docs);
    log.push(`Expertise tags: loaded ${docs.length}`);
  } else {
    log.push('Expertise tags: already present, left unchanged');
  }

  let inviteLink: string | null = null;
  if (opts.adminEmail) {
    const email = opts.adminEmail.trim().toLowerCase();
    const existing = await User.findOne({ email }).select('+email');
    if (existing) {
      log.push(`Administrator: ${email} already exists (role: ${existing.role}), nothing changed`);
    } else {
      const admin = await User.create({ name: opts.adminName?.trim() || 'Administrator', email, role: 'admin', emailVerifiedAt: new Date() });
      inviteLink = await sendInviteEmail(admin, 'an administrator');
      log.push(`Administrator: created ${email} and emailed a link to choose a password`);
    }
  } else if ((await User.countDocuments({ role: 'admin' })) === 0) {
    log.push('No administrator yet: re-run with --admin-email you@college.edu');
  }
  return { log, inviteLink };
}

// CLI entry
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { values } = parseArgs({ options: { 'admin-email': { type: 'string' }, 'admin-name': { type: 'string' } } });
  await connectDb();
  const { log, inviteLink } = await bootstrap({ adminEmail: values['admin-email'], adminName: values['admin-name'] });
  for (const line of log) console.log(`• ${line}`);
  if (inviteLink) console.log(`\nIf the email doesn't arrive, open this link (valid for 72 hours, works once):\n${inviteLink}\n`);
  await disconnectDb();
  process.exit(0);
}
