import { DAY_MS, HOUR_MS, type Clock, startOfWeek, systemClock } from '../lib/clock.js';
import { ActionItem, Alumnus, EngagementSnapshot, Message, Mentorship, Session, StudentProfile, User } from '../models/index.js';
import { notify } from './notify.js';
import { getSettings } from './settings.js';

export type Health = 'healthy' | 'at_risk' | 'lapsed';

/**
 * Relationship health from recent activity.
 * Score starts at 100, loses 3 points per idle day, and gains for upcoming sessions,
 * recent sessions, messages and completed actions; overdue actions cost points.
 */
export function classify(
  input: { daysSinceActivity: number; upcoming: number; sessionsCompleted: number; messages: number; actionsCompleted: number; actionsOverdue: number },
  cfg: { atRiskDays: number; lapsedDays: number },
): { health: Health; score: number } {
  const raw =
    100 -
    input.daysSinceActivity * 3 +
    Math.min(input.upcoming, 1) * 20 +
    Math.min(input.sessionsCompleted, 3) * 8 +
    Math.min(input.messages, 10) * 1 +
    Math.min(input.actionsCompleted, 5) * 3 -
    Math.min(input.actionsOverdue, 5) * 6;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  let health: Health = 'healthy';
  if (input.upcoming === 0 && input.daysSinceActivity >= cfg.lapsedDays) health = 'lapsed';
  else if ((input.upcoming === 0 && input.daysSinceActivity >= cfg.atRiskDays) || input.actionsOverdue >= 3) health = 'at_risk';
  return { health, score };
}

/** Weekly engagement-decay job: snapshot every active mentorship, detect decay/recovery, nudge. */
export async function runEngagementDecay(clock: Clock = systemClock) {
  const now = clock();
  const cfg = (await getSettings()).engagement;
  const weekStart = startOfWeek(now);
  const since = new Date(now.getTime() - 28 * DAY_MS);
  const active = await Mentorship.find({ status: 'active' }).lean();
  const summary = { evaluated: 0, healthy: 0, at_risk: 0, lapsed: 0, nudged: 0, recovered: 0 };
  const lapsedList: string[] = [];

  for (const m of active) {
    const [sessionsCompleted, upcoming, messages, actionsCompleted, actionsOverdue] = await Promise.all([
      Session.countDocuments({ mentorship: m._id, status: 'completed', completedAt: { $gte: since } }),
      Session.countDocuments({ mentorship: m._id, status: { $in: ['scheduled', 'proposed'] }, $or: [{ scheduledStart: { $gt: now } }, { status: 'proposed' }] }),
      Message.countDocuments({ mentorship: m._id, createdAt: { $gte: since } }),
      ActionItem.countDocuments({ mentorship: m._id, status: 'done', completedAt: { $gte: since } }),
      ActionItem.countDocuments({ mentorship: m._id, status: 'open', dueDate: { $lt: now } }),
    ]);
    const last = m.lastActivityAt ?? m.startedAt ?? now;
    const daysSinceActivity = Math.max(0, Math.floor((now.getTime() - new Date(last).getTime()) / DAY_MS));
    const { health, score } = classify({ daysSinceActivity, upcoming, sessionsCompleted, messages, actionsCompleted, actionsOverdue }, cfg);
    const previousHealth = m.health ?? 'healthy';
    const recovered = previousHealth !== 'healthy' && health === 'healthy';

    const canNudge = !m.lastNudgedAt || now.getTime() - new Date(m.lastNudgedAt).getTime() >= cfg.nudgeCooldownDays * DAY_MS;
    const nudge = health !== 'healthy' && canNudge;

    await EngagementSnapshot.findOneAndUpdate(
      { mentorship: m._id, weekStart },
      { $set: { sessionsCompleted, sessionsUpcoming: upcoming, messages, actionsCompleted, actionsOverdue, daysSinceActivity, healthScore: score, health, previousHealth, recovered, nudged: nudge } },
      { upsert: true },
    );
    await Mentorship.updateOne({ _id: m._id }, { $set: { health, healthScore: score, ...(nudge ? { lastNudgedAt: now } : {}) } });

    if (nudge) {
      await sendNudge(m, health, daysSinceActivity);
      summary.nudged++;
    }
    if (health === 'lapsed') lapsedList.push(String(m._id));
    summary.evaluated++;
    summary[health]++;
    if (recovered) summary.recovered++;
  }

  if (summary.lapsed + summary.at_risk > 0) {
    const officers = await User.find({ role: 'aro', status: 'active' }).select('_id').lean();
    for (const o of officers) {
      await notify(o._id, 'inactivity_nudge', {
        title: `Engagement check: ${summary.at_risk} at risk, ${summary.lapsed} lapsed`,
        body: `${summary.nudged} participants were nudged automatically this week. ${summary.recovered} mentorships recovered.`,
        link: '/admin/engagement',
      }, { email: false });
    }
  }
  return summary;
}

export async function sendNudge(m: any, health: Health, days: number) {
  const [student, alumnus] = await Promise.all([StudentProfile.findById(m.student).populate('user', 'name').lean(), Alumnus.findById(m.alumnus).populate('user', 'name').lean()]);
  const sName = (student?.user as any)?.name ?? 'your mentee';
  const aName = (alumnus?.user as any)?.name ?? 'your mentor';
  const link = `/mentorships/${m._id}`;
  if (student) {
    await notify((student.user as any)._id, 'inactivity_nudge', {
      title: health === 'lapsed' ? `It's been ${days} days — reconnect with ${aName}?` : `Keep momentum with ${aName}`,
      body: 'Students drive mentorships. Propose a short session or share an update on your action items.',
      link,
      actions: [{ label: 'Propose a session', href: `${link}?tab=sessions` }],
    });
  }
  if (alumnus) {
    await notify((alumnus.user as any)._id, 'inactivity_nudge', {
      title: `Quiet week with ${sName}`,
      body: 'No action needed if things are fine. If you can no longer continue, you can end the mentorship gracefully from the mentorship page.',
      link,
    }, { email: health === 'lapsed' });
  }
}

/** Hourly job: remind assignees of action items due within 24h. */
export async function sendActionItemReminders(clock: Clock = systemClock): Promise<number> {
  const now = clock();
  const due = await ActionItem.find({ status: 'open', dueDate: { $gt: now, $lte: new Date(now.getTime() + 24 * HOUR_MS) }, dueReminderSentAt: { $exists: false } }).lean();
  let n = 0;
  for (const a of due) {
    const claimed = await ActionItem.findOneAndUpdate({ _id: a._id, dueReminderSentAt: { $exists: false } }, { $set: { dueReminderSentAt: now } });
    if (!claimed) continue;
    const m = await Mentorship.findById(a.mentorship).populate('student', 'user').populate('alumnus', 'user').lean();
    if (!m || m.status !== 'active') continue;
    const uid = a.assignee === 'mentor' ? (m.alumnus as any)?.user : (m.student as any)?.user;
    await notify(uid, 'action_item_due', { title: 'Action item due soon', body: a.title, link: `/mentorships/${m._id}?tab=goals` }, { email: false });
    n++;
  }
  return n;
}
