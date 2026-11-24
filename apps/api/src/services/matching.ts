import mongoose from 'mongoose';
import { escapeRegex } from '../lib/regex.js';
import {
  Alumnus,
  AvailabilityWindow,
  CareerGoal,
  MatchScore,
  MENTORING_AREA_LABELS,
  MentorCapacity,
  Mentorship,
  MentorshipRequest,
  StudentProfile,
  User,
} from '../models/index.js';
import { isAccepting } from './capacity.js';
import { getSettings, type ProgrammeSettings } from './settings.js';

type W = ProgrammeSettings['matchingWeights'];
export type Breakdown = Record<keyof W, number>;

const STOP = new Set(['and', 'of', 'the', 'a', 'an', 'in', 'at', 'for', 'to', 'with', 'senior', 'junior', 'sr', 'jr', 'lead', 'associate', 'ii', 'iii', 'i']);
const tokens = (s?: string | null) =>
  new Set(
    (s ?? '')
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );

export interface StudentContext {
  profileId: string;
  interestIds: Set<string>;
  interestNames: Map<string, string>;
  targetRoles: string[];
  targetIndustries: Set<string>;
  areas: Set<string>;
  department?: string | null;
}

export async function loadStudentContext(profileId: unknown): Promise<StudentContext | null> {
  const p = await StudentProfile.findById(profileId).populate('interests').lean();
  if (!p) return null;
  const goals = await CareerGoal.find({ student: p._id }).lean();
  const interestNames = new Map<string, string>();
  for (const t of (p.interests ?? []) as any[]) interestNames.set(String(t._id), t.name);
  const roles = [...(p.targetRoles ?? []), ...goals.map((g) => g.targetRole).filter(Boolean)] as string[];
  const inds = [...(p.targetIndustries ?? []), ...goals.map((g) => g.targetIndustry).filter(Boolean)] as string[];
  return {
    profileId: String(p._id),
    interestIds: new Set(interestNames.keys()),
    interestNames,
    targetRoles: [...new Set(roles)],
    targetIndustries: new Set(inds.map((s) => s.toLowerCase())),
    areas: new Set(p.mentoringAreasWanted ?? []),
    department: p.department,
  };
}

/** Scores one mentor for one student. Every component is 0..1; reasons explain the strongest components. */
export function scoreMentor(
  ctx: StudentContext,
  m: any,
  cap: any,
  availabilityCount: number,
  weights: W,
): { score: number; breakdown: Breakdown; reasons: string[] } {
  const reasons: { w: number; text: string }[] = [];

  // Expertise overlap with the student's interests (3 shared tags = full marks)
  const mentorTags: any[] = m.expertise ?? [];
  const shared = mentorTags.filter((t) => ctx.interestIds.has(String(t._id ?? t)));
  const expertise = ctx.interestIds.size ? Math.min(1, shared.length / Math.min(3, ctx.interestIds.size)) : 0;
  if (shared.length) {
    const names = shared.map((t) => t.name ?? ctx.interestNames.get(String(t._id ?? t))).filter(Boolean);
    reasons.push({ w: weights.expertise * expertise, text: `Shares ${shared.length} of your interests: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}` });
  }

  // Target role similarity against current role + headline
  const mentorRoleTokens = new Set([...tokens(m.currentRole), ...tokens(m.headline)]);
  let targetRole = 0;
  let bestRole = '';
  for (const r of ctx.targetRoles) {
    const rt = tokens(r);
    if (!rt.size) continue;
    let inter = 0;
    rt.forEach((t) => mentorRoleTokens.has(t) && inter++);
    const s = inter / rt.size;
    if (s > targetRole) {
      targetRole = s;
      bestRole = r;
    }
  }
  if (targetRole >= 0.5 && m.currentRole) {
    reasons.push({ w: weights.targetRole * targetRole, text: `Works as ${m.currentRole}${m.currentCompany ? ` at ${m.currentCompany}` : ''}, close to your target role "${bestRole}"` });
  }

  // Industry
  const industry = m.industry && ctx.targetIndustries.has(String(m.industry).toLowerCase()) ? 1 : 0;
  if (industry) reasons.push({ w: weights.industry, text: `Works in ${m.industry}, one of your target industries` });

  // Mentoring areas
  const areasShared = (m.mentoringAreas ?? []).filter((a: string) => ctx.areas.has(a));
  const mentoringAreas = ctx.areas.size ? Math.min(1, areasShared.length / Math.min(2, ctx.areas.size)) : 0;
  if (areasShared.length) {
    const labels = areasShared.map((a: string) => (MENTORING_AREA_LABELS as any)[a] ?? a).slice(0, 3);
    reasons.push({ w: weights.mentoringAreas * mentoringAreas, text: `Offers the help you asked for: ${labels.join(', ').toLowerCase()}` });
  }

  // Same department
  const department = ctx.department && m.department === ctx.department ? 1 : 0;
  if (department) reasons.push({ w: weights.department, text: `Graduated from your department${m.graduationYear ? ` (class of ${m.graduationYear})` : ''}` });

  // Availability published
  const availability = Math.min(1, availabilityCount / 2);
  if (availabilityCount) reasons.push({ w: weights.availability * availability, text: `Has ${availabilityCount} weekly availability window${availabilityCount > 1 ? 's' : ''} published` });

  // Load balancing: spread students across mentors so goodwill is not concentrated on a few people
  const max = cap?.maxMentees ?? 0;
  const open = Math.max(0, max - (cap?.activeCount ?? 0));
  const loadBalance = max ? open / max : 0;

  const breakdown: Breakdown = { expertise, targetRole, industry, mentoringAreas, department, availability, loadBalance };
  const totalW = Object.values(weights).reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const raw = (Object.keys(breakdown) as (keyof W)[]).reduce((acc, k) => acc + Math.max(0, weights[k]) * breakdown[k], 0);
  const score = Math.round((raw / totalW) * 100);

  const ordered = reasons.sort((a, b) => b.w - a.w).map((r) => r.text);
  if (!ordered.length) ordered.push(`Verified alumnus${m.industry ? ` working in ${m.industry}` : ''}${m.yearsExperience ? ` with ${m.yearsExperience} years of experience` : ''}`);
  ordered.push(`${open} of ${max} mentee slot${max === 1 ? '' : 's'} open`);
  return { score, breakdown, reasons: ordered };
}

export interface SearchFilters {
  q?: string;
  industries?: string[];
  tags?: string[];
  areas?: string[];
  department?: string;
  minYears?: number;
  hasCapacity?: boolean;
  sort?: 'relevance' | 'experience' | 'capacity';
  limit?: number;
  offset?: number;
}


/**
 * Mentor discovery + ranked matching, computed on demand.
 * Capacity filtering happens here, so mentors who are full, paused or flooded with open requests
 * are not shown as available (spec design constraint: protect the mentor's time).
 */
export async function searchMentors(filters: SearchFilters, studentProfileId?: string, now = new Date()) {
  const settings = await getSettings();
  const ctx = studentProfileId ? await loadStudentContext(studentProfileId) : null;

  const base: Record<string, any> = { verificationStatus: 'verified', mentorOptIn: true };
  if (filters.q) {
    const re = new RegExp(escapeRegex(filters.q.trim()), 'i');
    // Names live on the user record: match alumni users by name, then include their profiles.
    const named = await User.find({ role: 'alumnus', name: re }).select('_id').lean();
    base.$or = [{ user: { $in: named.map((u) => u._id) } }, { headline: re }, { currentRole: re }, { currentCompany: re }, { industry: re }, { bio: re }];
  }
  // Suspended accounts are never offered to students.
  const all = (await Alumnus.find(base).populate('user', 'name status').populate('expertise').lean()).filter((a) => (a.user as any)?.status === 'active');

  const ids = all.map((a) => a._id);
  const [caps, pending, avail, activeWithStudent] = await Promise.all([
    MentorCapacity.find({ alumnus: { $in: ids } }).lean(),
    MentorshipRequest.aggregate([{ $match: { alumnus: { $in: ids }, status: 'pending' } }, { $group: { _id: '$alumnus', n: { $sum: 1 } } }]),
    AvailabilityWindow.aggregate([{ $match: { alumnus: { $in: ids } } }, { $group: { _id: '$alumnus', n: { $sum: 1 } } }]),
    studentProfileId
      ? Mentorship.find({ student: new mongoose.Types.ObjectId(studentProfileId), status: 'active' }).select('alumnus').lean()
      : Promise.resolve([] as any[]),
  ]);
  const capBy = new Map(caps.map((c) => [String(c.alumnus), c]));
  const pendingBy = new Map(pending.map((p: any) => [String(p._id), p.n as number]));
  const availBy = new Map(avail.map((p: any) => [String(p._id), p.n as number]));
  const mine = new Set(activeWithStudent.map((m: any) => String(m.alumnus)));

  // Facet counts are computed over the text-matched set before facet filters, so users can see alternatives.
  const facetCount = (vals: (string | undefined | null)[]) => {
    const m = new Map<string, number>();
    vals.forEach((v) => v && m.set(v, (m.get(v) ?? 0) + 1));
    return [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
  };
  const facets = {
    industries: facetCount(all.map((a) => a.industry)),
    departments: facetCount(all.map((a) => a.department)),
    areas: facetCount(all.flatMap((a) => a.mentoringAreas ?? [])),
    tags: facetCount(all.flatMap((a) => (a.expertise as any[]).map((t) => t.name))).slice(0, 30),
  };

  const tagSet = new Set((filters.tags ?? []).map((t) => t.toLowerCase()));
  const hasCapacity = filters.hasCapacity ?? true;
  let rows = all
    .filter((a) => !mine.has(String(a._id)))
    .filter((a) => !filters.industries?.length || filters.industries.includes(a.industry ?? ''))
    .filter((a) => !filters.department || a.department === filters.department)
    .filter((a) => !filters.areas?.length || filters.areas.some((x) => (a.mentoringAreas ?? []).includes(x as any)))
    .filter((a) => !tagSet.size || (a.expertise as any[]).some((t) => tagSet.has(String(t.name).toLowerCase()) || tagSet.has(String(t._id))))
    .filter((a) => !filters.minYears || (a.yearsExperience ?? 0) >= filters.minYears)
    .map((a) => {
      const cap = capBy.get(String(a._id));
      const pendingCount = pendingBy.get(String(a._id)) ?? 0;
      const accepting = isAccepting(cap, pendingCount, now);
      const match = ctx ? scoreMentor(ctx, a, cap, availBy.get(String(a._id)) ?? 0, settings.matchingWeights) : undefined;
      return { alumnus: a, cap, accepting, match };
    })
    .filter((r) => !hasCapacity || r.accepting);

  const sort = filters.sort ?? (ctx ? 'relevance' : 'experience');
  rows.sort((x, y) => {
    if (sort === 'relevance' && x.match && y.match) return y.match.score - x.match.score;
    if (sort === 'capacity') return (y.cap?.maxMentees ?? 0) - (y.cap?.activeCount ?? 0) - ((x.cap?.maxMentees ?? 0) - (x.cap?.activeCount ?? 0));
    return (y.alumnus.yearsExperience ?? 0) - (x.alumnus.yearsExperience ?? 0);
  });

  const total = rows.length;
  const offset = filters.offset ?? 0;
  const limit = Math.min(filters.limit ?? 20, 100);
  rows = rows.slice(offset, offset + limit);

  // Persist the shown scores (MatchScore) for explainability and programme analytics.
  if (ctx && rows.length) {
    await MatchScore.bulkWrite(
      rows.map((r) => ({
        updateOne: {
          filter: { student: ctx.profileId, alumnus: r.alumnus._id },
          update: { $set: { score: r.match!.score, breakdown: r.match!.breakdown, reasons: r.match!.reasons, computedAt: now } },
          upsert: true,
        },
      })),
    );
  }
  return { total, rows, facets };
}

export async function matchForPair(studentProfileId: unknown, alumnusId: unknown) {
  const settings = await getSettings();
  const ctx = await loadStudentContext(studentProfileId);
  const a = await Alumnus.findById(alumnusId).populate('expertise').lean();
  if (!ctx || !a) return null;
  const [cap, availabilityCount] = await Promise.all([
    MentorCapacity.findOne({ alumnus: a._id }).lean(),
    AvailabilityWindow.countDocuments({ alumnus: a._id }),
  ]);
  return scoreMentor(ctx, a, cap, availabilityCount, settings.matchingWeights);
}
