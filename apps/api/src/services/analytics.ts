import { DAY_MS } from '../lib/clock.js';
import {
  ActionItem,
  Alumnus,
  EngagementSnapshot,
  Feedback,
  Goal,
  MentorCapacity,
  Mentorship,
  MentorshipRequest,
  PlacementOutcome,
  Session,
  StudentProfile,
} from '../models/index.js';

/**
 * Programme analytics (M10). Everything here is aggregate, or identifies mentors by name only.
 * No contact data is read or returned.
 */
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);

export async function programmeReport(range?: { from?: Date; to?: Date }) {
  const to = range?.to ?? new Date();
  const from = range?.from ?? new Date(to.getTime() - 365 * DAY_MS);
  const inRange = { $gte: from, $lte: to };

  const [students, mentorsVerified, mentorsPending, activeMentorships, allMentorships, studentsMentored, mentorsActive] = await Promise.all([
    StudentProfile.countDocuments(),
    Alumnus.countDocuments({ verificationStatus: 'verified' }),
    Alumnus.countDocuments({ verificationStatus: 'pending' }),
    Mentorship.countDocuments({ status: 'active' }),
    Mentorship.countDocuments({ startedAt: inRange }),
    Mentorship.distinct('student', { startedAt: inRange }),
    Mentorship.distinct('alumnus', { status: 'active' }),
  ]);

  // Requests
  const reqAgg = await MentorshipRequest.aggregate([{ $match: { createdAt: inRange } }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
  const reqBy = Object.fromEntries(reqAgg.map((r: any) => [r._id, r.n])) as Record<string, number>;
  const reqTotal = Object.values(reqBy).reduce((a, b) => a + b, 0);
  const decided = (reqBy.accepted ?? 0) + (reqBy.declined ?? 0) + (reqBy.expired ?? 0);
  const responseTimes = await MentorshipRequest.aggregate([
    { $match: { createdAt: inRange, status: { $in: ['accepted', 'declined'] }, respondedAt: { $exists: true } } },
    { $project: { h: { $divide: [{ $subtract: ['$respondedAt', '$createdAt'] }, 3600000] } } },
    { $sort: { h: 1 } },
  ]);
  const medianResponseHours = responseTimes.length ? Math.round(responseTimes[Math.floor(responseTimes.length / 2)].h * 10) / 10 : null;
  const declineReasons = await MentorshipRequest.aggregate([
    { $match: { createdAt: inRange, status: 'declined' } },
    { $group: { _id: { $ifNull: ['$declineReason', 'no_reason_given'] }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);

  // Sessions
  const sessAgg = await Session.aggregate([{ $match: { createdAt: inRange } }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
  const sessBy = Object.fromEntries(sessAgg.map((r: any) => [r._id, r.n])) as Record<string, number>;
  const sessionsHeld = sessBy.completed ?? 0;
  const sessionsDue = sessionsHeld + (sessBy.no_show ?? 0) + (sessBy.cancelled ?? 0);
  const monthsActive = Math.max(1, (to.getTime() - from.getTime()) / (30 * DAY_MS));

  // Goals & actions
  const [goalsTotal, goalsAchieved, actionsTotal, actionsDone] = await Promise.all([
    Goal.countDocuments({ createdAt: inRange }),
    Goal.countDocuments({ createdAt: inRange, status: 'achieved' }),
    ActionItem.countDocuments({ createdAt: inRange }),
    ActionItem.countDocuments({ createdAt: inRange, status: 'done' }),
  ]);

  // Utilisation
  const caps = await MentorCapacity.aggregate([
    { $lookup: { from: Alumnus.collection.name, localField: 'alumnus', foreignField: '_id', as: 'a' } },
    { $match: { 'a.verificationStatus': 'verified' } },
    { $group: { _id: null, used: { $sum: '$activeCount' }, total: { $sum: '$maxMentees' }, full: { $sum: { $cond: [{ $gte: ['$activeCount', '$maxMentees'] }, 1, 0] } }, paused: { $sum: { $cond: ['$paused', 1, 0] } } } },
  ]);
  const cap = caps[0] ?? { used: 0, total: 0, full: 0, paused: 0 };

  // Engagement
  const healthAgg = await Mentorship.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$health', n: { $sum: 1 } } }]);
  const health = Object.fromEntries(healthAgg.map((r: any) => [r._id, r.n])) as Record<string, number>;
  const [decayEvents, recoveries] = await Promise.all([
    EngagementSnapshot.countDocuments({ weekStart: inRange, previousHealth: 'healthy', health: { $in: ['at_risk', 'lapsed'] } }),
    EngagementSnapshot.countDocuments({ weekStart: inRange, recovered: true }),
  ]);

  // Satisfaction
  const sat = await Feedback.aggregate([{ $match: { createdAt: inRange } }, { $group: { _id: '$fromRole', avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  const satBy = Object.fromEntries(sat.map((r: any) => [r._id, { avg: Math.round(r.avg * 100) / 100, responses: r.n }]));

  // Trends (per month)
  const monthly = await Mentorship.aggregate([
    { $match: { startedAt: inRange } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$startedAt' } }, n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const monthlySessions = await Session.aggregate([
    { $match: { status: 'completed', completedAt: inRange } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$completedAt' } }, n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    participation: {
      students,
      studentsMentored: studentsMentored.length,
      participationRate: pct(studentsMentored.length, students),
      mentorsVerified,
      mentorsPendingVerification: mentorsPending,
      mentorsActive: mentorsActive.length,
      mentorParticipationRate: pct(mentorsActive.length, mentorsVerified),
      activeMentorships,
      mentorshipsStarted: allMentorships,
    },
    requests: {
      total: reqTotal,
      byStatus: reqBy,
      acceptanceRate: pct(reqBy.accepted ?? 0, decided),
      expiryRate: pct(reqBy.expired ?? 0, decided),
      medianResponseHours,
      declineReasons: declineReasons.map((d: any) => ({ reason: d._id, count: d.n })),
    },
    sessions: {
      byStatus: sessBy,
      completed: sessionsHeld,
      completionRate: pct(sessionsHeld, sessionsDue),
      perMentorshipPerMonth: allMentorships ? Math.round((sessionsHeld / Math.max(1, allMentorships) / monthsActive) * 100) / 100 : 0,
    },
    goals: { total: goalsTotal, achieved: goalsAchieved, completionRate: pct(goalsAchieved, goalsTotal), actionItems: actionsTotal, actionItemsDone: actionsDone, actionCompletionRate: pct(actionsDone, actionsTotal) },
    utilisation: { slotsUsed: cap.used, slotsTotal: cap.total, utilisationRate: pct(cap.used, cap.total), mentorsAtCapacity: cap.full, mentorsPaused: cap.paused },
    engagement: { healthy: health.healthy ?? 0, atRisk: health.at_risk ?? 0, lapsed: health.lapsed ?? 0, decayEvents, recoveries },
    satisfaction: { studentRatingOfMentors: satBy.student ?? null, mentorRatingOfStudents: satBy.mentor ?? null },
    trends: { mentorshipsStarted: monthly.map((m: any) => ({ month: m._id, count: m.n })), sessionsCompleted: monthlySessions.map((m: any) => ({ month: m._id, count: m.n })) },
  };
}

/** Mentoring participation vs placement outcomes (aggregate only). */
export async function placementCorrelation() {
  const outcomes = await PlacementOutcome.find({ status: { $ne: 'opted_out' } }).lean();
  const sessionsByStudent = await Session.aggregate([
    { $match: { status: 'completed' } },
    { $lookup: { from: Mentorship.collection.name, localField: 'mentorship', foreignField: '_id', as: 'm' } },
    { $unwind: '$m' },
    { $group: { _id: '$m.student', n: { $sum: 1 } } },
  ]);
  const mentoredIds = new Set((await Mentorship.distinct('student')).map(String));
  const sBy = new Map(sessionsByStudent.map((s: any) => [String(s._id), s.n as number]));

  const bucket = (n: number) => (n === 0 ? '0 sessions' : n <= 2 ? '1–2 sessions' : n <= 5 ? '3–5 sessions' : '6+ sessions');
  const groups: Record<string, { total: number; placed: number; higherStudies: number }> = {};
  const add = (k: string, o: any) => {
    groups[k] ??= { total: 0, placed: 0, higherStudies: 0 };
    groups[k].total++;
    if (o.status === 'placed') groups[k].placed++;
    if (o.status === 'higher_studies') groups[k].higherStudies++;
  };
  const byBucket: Record<string, { total: number; placed: number; higherStudies: number }> = {};
  for (const o of outcomes) {
    const sid = String(o.student);
    add(mentoredIds.has(sid) ? 'mentored' : 'not_mentored', o);
    const b = bucket(sBy.get(sid) ?? 0);
    byBucket[b] ??= { total: 0, placed: 0, higherStudies: 0 };
    byBucket[b].total++;
    if (o.status === 'placed') byBucket[b].placed++;
    if (o.status === 'higher_studies') byBucket[b].higherStudies++;
  }
  const fmt = (g?: { total: number; placed: number; higherStudies: number }) =>
    g ? { students: g.total, placed: g.placed, placementRate: pct(g.placed, g.total), positiveOutcomeRate: pct(g.placed + g.higherStudies, g.total) } : { students: 0, placed: 0, placementRate: 0, positiveOutcomeRate: 0 };
  const order = ['0 sessions', '1–2 sessions', '3–5 sessions', '6+ sessions'];
  return {
    mentored: fmt(groups.mentored),
    notMentored: fmt(groups.not_mentored),
    bySessions: order.map((k) => ({ bucket: k, ...fmt(byBucket[k]) })),
    note: 'Correlation, not causation: students who seek mentoring may differ in other ways.',
  };
}

/** Mentor effectiveness ranking for alumni relations (names only, no contact data). */
export async function mentorEffectiveness() {
  const mentors = await Alumnus.find({ verificationStatus: 'verified' }).populate('user', 'name').lean();
  const rows = [];
  for (const a of mentors) {
    const ms = await Mentorship.find({ alumnus: a._id }).select('_id status').lean();
    if (!ms.length) continue;
    const ids = ms.map((m) => m._id);
    const [ratings, sessionsDone, sessionsAll, goalsAll, goalsDone, reqs] = await Promise.all([
      Feedback.find({ mentorship: { $in: ids }, fromRole: 'student' }).select('rating').lean(),
      Session.countDocuments({ mentorship: { $in: ids }, status: 'completed' }),
      Session.countDocuments({ mentorship: { $in: ids }, status: { $in: ['completed', 'no_show', 'cancelled'] } }),
      Goal.countDocuments({ mentorship: { $in: ids } }),
      Goal.countDocuments({ mentorship: { $in: ids }, status: 'achieved' }),
      MentorshipRequest.find({ alumnus: a._id, respondedAt: { $exists: true }, status: { $in: ['accepted', 'declined'] } }).select('createdAt respondedAt').lean(),
    ]);
    const rating = avg(ratings.map((r) => r.rating));
    const goalRate = goalsAll ? goalsDone / goalsAll : 0;
    const sessionRate = sessionsAll ? sessionsDone / sessionsAll : 0;
    const respH = reqs.length ? reqs.reduce((acc, r) => acc + (r.respondedAt!.getTime() - r.createdAt!.getTime()) / 3600000, 0) / reqs.length : null;
    const responsiveness = respH == null ? 0.5 : Math.max(0, 1 - respH / (7 * 24));
    const score = Math.round(((rating ?? 3) / 5) * 40 + goalRate * 25 + sessionRate * 20 + responsiveness * 15);
    rows.push({
      mentorId: String(a._id),
      name: (a.user as any)?.name ?? 'Mentor',
      industry: a.industry ?? null,
      mentorships: ms.length,
      activeMentorships: ms.filter((m) => m.status === 'active').length,
      avgStudentRating: rating,
      ratings: ratings.length,
      sessionsCompleted: sessionsDone,
      sessionCompletionRate: pct(sessionsDone, sessionsAll),
      goalCompletionRate: pct(goalsDone, goalsAll),
      avgResponseHours: respH == null ? null : Math.round(respH * 10) / 10,
      effectivenessScore: score,
    });
  }
  return rows.sort((a, b) => b.effectivenessScore - a.effectivenessScore);
}

export function reportToCsv(r: Awaited<ReturnType<typeof programmeReport>>): string {
  const lines: string[][] = [['Section', 'Metric', 'Value']];
  const push = (section: string, obj: Record<string, any>) => {
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) push(`${section}.${k}`, v);
      else if (Array.isArray(v)) lines.push([section, k, JSON.stringify(v)]);
      else lines.push([section, k, String(v ?? '')]);
    }
  };
  for (const [k, v] of Object.entries(r)) if (k !== 'range') push(k, v as any);
  lines.unshift(['Report range', r.range.from, r.range.to]);
  return lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
