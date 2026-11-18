/**
 * Demo / UAT seed: 60 verified alumni (each matched to an institutional record with an approval audit trail),
 * pending verifications, 46 students, staff accounts and ~5 months of mentoring activity.
 *
 * Demo logins (password for all: Demo@1234):
 *   student@demo.edu      Student (Aarav Sharma) — has a mentor, can browse & request
 *   mentor@demo.edu       Verified alumni mentor (Priya Nair) — has pending requests to accept/decline
 *   newalumni@demo.edu    Registered alumna, NOT yet verified — use roll number 2018CS901 to verify
 *   aro@demo.edu          Alumni Relations Officer
 *   placement@demo.edu    Placement Officer (read-only analytics)
 *   admin@demo.edu        Administrator
 *
 * Run: npm run seed   (resets the database and reloads everything)
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { env } from '../config/env.js';
import { DAY_MS, startOfWeek } from '../lib/clock.js';
import { logger } from '../lib/logger.js';
import {
  ActionItem,
  Alumnus,
  AvailabilityWindow,
  CareerGoal,
  EngagementSnapshot,
  ExpertiseTag,
  Feedback,
  Goal,
  InstitutionRecord,
  MentorCapacity,
  Mentorship,
  MentorshipRequest,
  Message,
  Notification,
  PlacementOutcome,
  Session,
  Settings,
  StudentProfile,
  User,
  VerificationRequest,
} from '../models/index.js';
import { classify } from '../services/engagement.js';
import { normalizeName } from '../services/verification.js';
import { CITIES, DEGREE_BY_DEPT, DEMO_PASSWORD, DEPT_CODE, FIRST, INDUSTRY_PROFILES, LAST, MESSAGE_SNIPPETS, STUDENT_ROLE_TARGETS, TAGS } from './data.js';

/* deterministic PRNG so every seed run produces the same data */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261117);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const sample = <T>(xs: readonly T[], n: number): T[] => {
  const c = [...xs];
  const out: T[] = [];
  while (out.length < n && c.length) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]);
  return out;
};
const daysAgo = (d: number, now: Date) => new Date(now.getTime() - d * DAY_MS);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dob = (gradYear: number) => `${gradYear - 22}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`;

/** A tiny valid one-page PDF so seeded verification documents can be opened in the review screen. */
function writePlaceholderDocument() {
  if (env.isTest) return;
  const text = 'Sample degree certificate (demo data)';
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  fs.mkdirSync(env.uploadDir, { recursive: true });
  fs.writeFileSync(path.join(env.uploadDir, 'seed-placeholder.pdf'), pdf);
}

export async function runSeed({ reset }: { reset: boolean }) {
  const now = new Date();
  if (reset) {
    const cols = await mongoose.connection.db!.collections();
    for (const c of cols) await c.deleteMany({});
    logger.info('Database cleared');
  }
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await Settings.updateOne({ key: 'global' }, { $setOnInsert: { key: 'global' } }, { upsert: true });
  writePlaceholderDocument();

  /* ---------------- tags */
  const tagDocs = await ExpertiseTag.insertMany(Object.entries(TAGS).flatMap(([category, names]) => names.map((name) => ({ name, slug: slug(name), category }))));
  const tagByName = new Map(tagDocs.map((t) => [t.name, t._id]));
  const tagIds = (names: string[]) => names.map((n) => tagByName.get(n)).filter(Boolean) as mongoose.Types.ObjectId[];

  /* ---------------- staff */
  const [aro] = await User.insertMany([
    { name: 'Lakshmi Menon', email: 'aro@demo.edu', phone: '+91 90000 00001', role: 'aro', passwordHash: hash },
    { name: 'Rakesh Kulkarni', email: 'placement@demo.edu', phone: '+91 90000 00002', role: 'placement', passwordHash: hash },
    { name: 'System Administrator', email: 'admin@demo.edu', role: 'admin', passwordHash: hash },
  ]);

  /* ---------------- alumni */
  const industries = Object.keys(INDUSTRY_PROFILES);
  type A = { user: any; alumnus: any; cap: any; industry: string; dept: string };
  const alumni: A[] = [];
  const usedEmails = new Set<string>();
  const usedRolls = new Set<string>();
  const mkEmail = (f: string, l: string, domain: string) => {
    let e = `${f}.${l}@${domain}`.toLowerCase();
    let i = 2;
    while (usedEmails.has(e)) e = `${f}.${l}${i++}@${domain}`.toLowerCase();
    usedEmails.add(e);
    return e;
  };
  const mkRoll = (year: number, dept: string) => {
    let r: string;
    do r = `${year}${DEPT_CODE[dept]}${String(int(100, 899)).padStart(3, '0')}`;
    while (usedRolls.has(r));
    usedRolls.add(r);
    return r;
  };

  async function createAlumnus(o: {
    name: string;
    email: string;
    industry: string;
    dept: string;
    gradYear: number;
    role?: string;
    company?: string;
    status: 'verified' | 'pending' | 'unverified' | 'rejected';
    maxMentees?: number;
    paused?: boolean;
    roll?: string;
    dobStr?: string;
    tags?: string[];
    areas?: string[];
    createRecord?: boolean;
  }) {
    const prof = INDUSTRY_PROFILES[o.industry];
    const roll = o.roll ?? mkRoll(o.gradYear, o.dept);
    const birth = o.dobStr ?? dob(o.gradYear);
    const degree = DEGREE_BY_DEPT[o.dept];
    const rec = o.createRecord === false ? null : await InstitutionRecord.create({ rollNumber: roll, fullName: o.name, normalizedName: normalizeName(o.name), graduationYear: o.gradYear, degree, department: o.dept, dateOfBirth: birth, source: 'erp_sync' });
    const user = await User.create({ name: o.name, email: o.email, phone: `+91 9${int(100000000, 999999999)}`, role: 'alumnus', passwordHash: hash, createdAt: daysAgo(int(120, 400), now), lastLoginAt: daysAgo(int(0, 20), now) });
    const years = Math.max(1, now.getFullYear() - o.gradYear);
    const role = o.role ?? pick(prof.roles);
    const company = o.company ?? pick(prof.companies);
    const tags = o.tags ?? sample(prof.tags, int(3, 6));
    const verified = o.status === 'verified';
    const alumnus = await Alumnus.create({
      user: user._id,
      verificationStatus: o.status,
      verifiedAt: verified ? daysAgo(int(60, 300), now) : undefined,
      institutionRecord: verified ? rec?._id : undefined,
      rollNumber: o.status === 'unverified' ? undefined : roll,
      graduationYear: o.gradYear,
      degree,
      department: o.dept,
      headline: `${role} at ${company}`,
      currentRole: role,
      currentCompany: company,
      industry: o.industry,
      yearsExperience: years,
      city: pick(CITIES),
      bio: `${o.dept} graduate (${o.gradYear}). ${years}+ years in ${o.industry.toLowerCase()}. Happy to help students think through career choices, prepare for interviews and build practical skills in ${tags.slice(0, 2).join(' and ')}.`,
      expertise: tagIds(tags),
      mentoringAreas: o.areas ?? sample(['career_guidance', 'interview_prep', 'resume_review', 'technical_skills', 'industry_insight', 'higher_studies', 'networking', 'entrepreneurship', 'leadership'], int(2, 4)),
      languages: sample(['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Bengali', 'Marathi'], int(1, 3)),
      linkedinUrl: `https://www.linkedin.com/in/${slug(o.name)}-${int(1000, 9999)}`,
      mentorOptIn: true,
    });
    let cap = null;
    if (verified) {
      cap = await MentorCapacity.create({ alumnus: alumnus._id, maxMentees: o.maxMentees ?? int(1, 4), activeCount: 0, maxPendingRequests: 5, paused: !!o.paused, pauseReason: o.paused ? 'Product launch this quarter' : undefined, pausedUntil: o.paused ? daysAgo(-int(10, 40), now) : undefined });
      const nW = int(1, 3);
      const days = sample([1, 2, 3, 4, 5, 6, 0], nW);
      await AvailabilityWindow.insertMany(days.map((d) => ({ alumnus: alumnus._id, dayOfWeek: d, startMinute: d === 0 || d === 6 ? 10 * 60 : 19 * 60, endMinute: d === 0 || d === 6 ? 12 * 60 : 20 * 60 + 30, timezone: 'Asia/Kolkata' })));
      const submittedAt = daysAgo(int(300, 400), now);
      await VerificationRequest.create({
        alumnus: alumnus._id,
        user: user._id,
        submitted: { fullName: o.name, rollNumber: roll, graduationYear: o.gradYear, degree, department: o.dept, dateOfBirth: birth },
        documents: [{ originalName: 'degree-certificate.pdf', storedName: 'seed-placeholder.pdf', mimeType: 'application/pdf', size: 184_220, uploadedAt: submittedAt }],
        matchResult: { matched: true, confidence: 1, record: rec?._id, matchedFields: ['rollNumber', 'fullName', 'graduationYear', 'degree', 'department', 'dateOfBirth'], mismatchedFields: [] },
        status: 'approved',
        reviewer: aro._id,
        reviewNote: 'Matches ERP record; degree certificate checked.',
        decidedAt: alumnus.verifiedAt,
        history: [
          { status: 'submitted', by: user._id, byName: 'Applicant', note: 'Record match on rollNumber, fullName, graduationYear, degree, department, dateOfBirth', at: submittedAt },
          { status: 'approved', by: aro._id, byName: aro.name, note: 'Matches ERP record; degree certificate checked.', at: alumnus.verifiedAt },
        ],
        createdAt: submittedAt,
      });
    }
    const a: A = { user, alumnus, cap, industry: o.industry, dept: o.dept };
    return a;
  }

  // Demo mentor
  usedEmails.add('mentor@demo.edu');
  const demoMentor = await createAlumnus({
    name: 'Priya Nair',
    email: 'mentor@demo.edu',
    industry: 'Data & AI',
    dept: 'Computer Science & Engineering',
    gradYear: 2016,
    role: 'Senior Data Scientist',
    company: 'Quantia AI',
    status: 'verified',
    maxMentees: 3,
    tags: ['Machine Learning', 'Python', 'Statistics', 'Deep Learning', 'SQL', 'MLOps'],
    areas: ['interview_prep', 'technical_skills', 'career_guidance', 'resume_review'],
  });
  alumni.push(demoMentor);

  // 59 more verified alumni spread across industries
  for (let i = 0; i < 59; i++) {
    const industry = industries[i % industries.length];
    const dept = pick(INDUSTRY_PROFILES[industry].departments);
    const f = pick(FIRST);
    const l = pick(LAST);
    alumni.push(await createAlumnus({ name: `${f} ${l}`, email: mkEmail(f, l, 'alumni.example.edu'), industry, dept, gradYear: int(2004, 2021), status: 'verified', paused: i % 23 === 7 }));
  }

  // Pending verification queue (6), including mismatches for the officer to review
  for (let i = 0; i < 6; i++) {
    const industry = pick(industries);
    const dept = pick(INDUSTRY_PROFILES[industry].departments);
    const f = pick(FIRST);
    const l = pick(LAST);
    const gradYear = int(2010, 2022);
    const a = await createAlumnus({ name: `${f} ${l}`, email: mkEmail(f, l, 'alumni.example.edu'), industry, dept, gradYear, status: 'pending' });
    const rec = await InstitutionRecord.findOne({ rollNumber: a.alumnus.rollNumber }).lean();
    const mismatch = i % 3 === 1 ? ['graduationYear'] : i % 3 === 2 ? ['department'] : [];
    const submittedAt = daysAgo(int(1, 9), now);
    await VerificationRequest.create({
      alumnus: a.alumnus._id,
      user: a.user._id,
      submitted: { fullName: a.user.name, rollNumber: a.alumnus.rollNumber, graduationYear: mismatch.includes('graduationYear') ? gradYear + 1 : gradYear, degree: DEGREE_BY_DEPT[dept], department: mismatch.includes('department') ? 'Information Technology' : dept, dateOfBirth: rec?.dateOfBirth },
      documents: [{ originalName: 'provisional-certificate.pdf', storedName: 'seed-placeholder.pdf', mimeType: 'application/pdf', size: 210_004, uploadedAt: submittedAt }],
      matchResult: { matched: mismatch.length === 0, confidence: mismatch.length ? 0.83 : 1, record: rec?._id, matchedFields: ['rollNumber', 'fullName', 'degree', 'dateOfBirth', ...(mismatch.includes('graduationYear') ? ['department'] : mismatch.includes('department') ? ['graduationYear'] : ['graduationYear', 'department'])], mismatchedFields: mismatch },
      status: 'pending',
      history: [{ status: 'submitted', by: a.user._id, byName: 'Applicant', note: mismatch.length ? `Partial record match; mismatched: ${mismatch.join(', ')}` : 'Record match on all fields', at: submittedAt }],
      createdAt: submittedAt,
    });
  }

  // Demo unverified alumna + spare ERP records for registration demos
  await User.create({ name: 'Rhea Kapoor', email: 'newalumni@demo.edu', phone: '+91 98111 22333', role: 'alumnus', passwordHash: hash }).then((u) => Alumnus.create({ user: u._id, verificationStatus: 'unverified', mentorOptIn: true }));
  usedEmails.add('newalumni@demo.edu');
  await InstitutionRecord.create({ rollNumber: '2018CS901', fullName: 'Rhea Kapoor', normalizedName: 'rhea kapoor', graduationYear: 2018, degree: 'B.Tech', department: 'Computer Science & Engineering', dateOfBirth: '1996-04-12', source: 'erp_sync' });
  for (let i = 0; i < 10; i++) {
    const dept = pick(Object.keys(DEPT_CODE));
    const year = int(2008, 2022);
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    await InstitutionRecord.create({ rollNumber: mkRoll(year, dept), fullName: name, normalizedName: normalizeName(name), graduationYear: year, degree: DEGREE_BY_DEPT[dept], department: dept, dateOfBirth: dob(year), source: 'erp_sync' });
  }

  /* ---------------- students */
  type S = { user: any; profile: any; dept: string; goals: any[] };
  const students: S[] = [];
  async function createStudent(o: { name: string; email: string; dept: string; gradYear: number; interests?: string[]; roles?: string[]; industries?: string[]; areas?: string[] }) {
    const t = STUDENT_ROLE_TARGETS[o.dept];
    const roles = o.roles ?? sample(t.roles, int(1, 2));
    const inds = o.industries ?? sample(t.industries, int(1, 2));
    const interestPool = [...new Set(inds.flatMap((i) => INDUSTRY_PROFILES[i]?.tags ?? []))];
    const interests = o.interests ?? sample(interestPool, int(3, 5));
    const user = await User.create({ name: o.name, email: o.email, phone: `+91 8${int(100000000, 999999999)}`, role: 'student', passwordHash: hash, createdAt: daysAgo(int(100, 300), now) });
    const profile = await StudentProfile.create({
      user: user._id,
      rollNumber: `${o.gradYear}${DEPT_CODE[o.dept]}S${int(100, 999)}`,
      program: `${DEGREE_BY_DEPT[o.dept]} ${o.dept}`,
      department: o.dept,
      graduationYear: o.gradYear,
      bio: `${DEGREE_BY_DEPT[o.dept]} student in ${o.dept}, graduating ${o.gradYear}. Interested in ${interests.slice(0, 2).join(' and ')}.`,
      interests: tagIds(interests),
      targetRoles: roles,
      targetIndustries: inds,
      mentoringAreasWanted: o.areas ?? sample(t.areas, int(2, 3)),
    });
    const goals = await CareerGoal.insertMany(
      roles.map((r, i) => ({ student: profile._id, title: i === 0 ? `Land a ${r} role` : `Build skills towards ${r}`, description: `Working towards a ${r} position in ${inds[0]}.`, targetRole: r, targetIndustry: inds[i % inds.length], timeframe: o.gradYear <= now.getFullYear() ? '6_months' : '1_year', priority: i + 1 })),
    );
    const s: S = { user, profile, dept: o.dept, goals };
    students.push(s);
    return s;
  }

  const demoStudent = await createStudent({
    name: 'Aarav Sharma',
    email: 'student@demo.edu',
    dept: 'Computer Science & Engineering',
    gradYear: 2027,
    interests: ['Machine Learning', 'Python', 'Statistics', 'SQL', 'Deep Learning'],
    roles: ['Data Scientist', 'Machine Learning Engineer'],
    industries: ['Data & AI', 'FinTech'],
    areas: ['interview_prep', 'technical_skills', 'resume_review'],
  });
  usedEmails.add('student@demo.edu');
  for (let i = 0; i < 45; i++) {
    const dept = pick(Object.keys(STUDENT_ROLE_TARGETS));
    const f = pick(FIRST);
    const l = pick(LAST);
    await createStudent({ name: `${f} ${l}`, email: mkEmail(f, l, 'students.example.edu'), dept, gradYear: pick([2026, 2026, 2027, 2028]) });
  }

  /* ---------------- mentorships & activity */
  const verified = alumni.filter((a) => a.cap);
  const capLeft = new Map(verified.map((a) => [String(a.alumnus._id), a.cap.paused ? 0 : a.cap.maxMentees]));
  const pickMentorFor = (s: S, exclude: Set<string>) => {
    const want = new Set((s.profile.targetIndustries as string[]) ?? []);
    const candidates = verified.filter((a) => !exclude.has(String(a.alumnus._id)) && (capLeft.get(String(a.alumnus._id)) ?? 0) > 0 && a !== demoMentor);
    return candidates.find((a) => want.has(a.industry)) ?? candidates[0];
  };

  type MPlan = { s: S; a: A; startedDaysAgo: number; lastActiveDaysAgo: number; status: 'active' | 'completed' };
  const plans: MPlan[] = [];
  // Demo pair + one more for the demo mentor
  plans.push({ s: demoStudent, a: demoMentor, startedDaysAgo: 64, lastActiveDaysAgo: 2, status: 'active' });
  plans.push({ s: students[7], a: demoMentor, startedDaysAgo: 110, lastActiveDaysAgo: 19, status: 'active' });
  capLeft.set(String(demoMentor.alumnus._id), 1);
  const engaged = new Set<string>([String(demoStudent.profile._id), String(students[7].profile._id)]);

  const activityPattern = [1, 3, 5, 2, 8, 4, 6, 40, 45, 17, 21, 9, 3, 12, 2, 7, 35, 4, 16, 1, 5, 6];
  for (let i = 1; i < 30 && plans.length < 26; i++) {
    const s = students[i];
    if (engaged.has(String(s.profile._id))) continue;
    const a = pickMentorFor(s, new Set());
    if (!a) break;
    const status = i % 9 === 0 ? 'completed' : 'active';
    if (status === 'active') capLeft.set(String(a.alumnus._id), (capLeft.get(String(a.alumnus._id)) ?? 1) - 1);
    const started = int(20, 150);
    plans.push({ s, a, startedDaysAgo: started, lastActiveDaysAgo: Math.min(started, activityPattern[plans.length % activityPattern.length]), status });
    engaged.add(String(s.profile._id));
  }

  for (const p of plans) {
    const start = daysAgo(p.startedDaysAgo, now);
    const req = await MentorshipRequest.create({
      student: p.s.profile._id,
      alumnus: p.a.alumnus._id,
      message: `Hi! I'm working towards ${p.s.profile.targetRoles?.[0] ?? 'my first role'} and your experience in ${p.a.industry} would really help me. I'd value guidance on preparing for interviews and choosing projects.`,
      goals: p.s.goals.map((g) => g._id),
      status: 'accepted',
      expiresAt: new Date(start.getTime() + 7 * DAY_MS),
      respondedAt: new Date(start.getTime() + int(4, 60) * 3600_000),
      matchScore: int(55, 92),
      matchReasons: [`Works in ${p.a.industry}, one of your target industries`],
      createdAt: new Date(start.getTime() - int(1, 3) * DAY_MS),
    });
    const endedAt = p.status === 'completed' ? daysAgo(int(1, Math.max(1, p.startedDaysAgo - 10)), now) : undefined;
    const lastActivityAt = daysAgo(p.lastActiveDaysAgo, now);
    const m = await Mentorship.create({ student: p.s.profile._id, alumnus: p.a.alumnus._id, request: req._id, status: p.status, startedAt: start, endedAt, endReason: endedAt ? 'Goals achieved' : undefined, lastActivityAt, createdAt: start });
    if (p.status === 'active') await MentorCapacity.updateOne({ alumnus: p.a.alumnus._id }, { $inc: { activeCount: 1 } });

    // Sessions: roughly one every 2–3 weeks up to the last activity date
    const sessions: any[] = [];
    const span = p.startedDaysAgo - p.lastActiveDaysAgo;
    const nSessions = Math.max(1, Math.floor(span / int(14, 21)) + 1);
    for (let k = 0; k < nSessions; k++) {
      const d = p.startedDaysAgo - 3 - Math.floor((k * span) / Math.max(1, nSessions));
      if (d < p.lastActiveDaysAgo) break;
      const st = daysAgo(d, now);
      st.setUTCHours(13, 30, 0, 0);
      const noShow = rnd() < 0.08;
      sessions.push({
        mentorship: m._id,
        proposedBy: k % 2 ? p.a.user._id : p.s.user._id,
        proposedSlots: [{ start: st, end: new Date(st.getTime() + 45 * 60000) }],
        status: noShow ? 'no_show' : 'completed',
        title: k === 0 ? 'Introductions & goal setting' : pick(['Resume deep-dive', 'Mock interview', 'Project review', 'Career options discussion', 'System design practice', 'Internship strategy']),
        scheduledStart: st,
        scheduledEnd: new Date(st.getTime() + 45 * 60000),
        videoLink: `https://meet.jit.si/AMN-seed${String(m._id).slice(-6)}${k}`,
        summary: noShow ? undefined : 'Discussed progress against goals and agreed next steps.',
        completedAt: noShow ? undefined : new Date(st.getTime() + 50 * 60000),
        createdAt: new Date(st.getTime() - 4 * DAY_MS),
      });
    }
    if (p.status === 'active' && p.lastActiveDaysAgo < 10) {
      const st = daysAgo(-int(2, 9), now);
      st.setUTCHours(13, 30, 0, 0);
      sessions.push({ mentorship: m._id, proposedBy: p.s.user._id, proposedSlots: [{ start: st, end: new Date(st.getTime() + 45 * 60000) }], status: 'scheduled', title: 'Mock interview', agenda: 'Practice one technical and one behavioural round.', scheduledStart: st, scheduledEnd: new Date(st.getTime() + 45 * 60000), videoLink: `https://meet.jit.si/AMN-seed${String(m._id).slice(-6)}up`, createdAt: daysAgo(2, now) });
    }
    const createdSessions = await Session.insertMany(sessions);

    // Goals & action items
    const goals = await Goal.insertMany(
      p.s.goals.slice(0, 2).map((g, i) => ({
        mentorship: m._id,
        careerGoal: g._id,
        title: i === 0 ? `Interview-ready for ${g.targetRole} roles` : `Ship a portfolio project relevant to ${g.targetRole}`,
        targetDate: daysAgo(-int(20, 90), now),
        status: p.status === 'completed' ? 'achieved' : pick(['open', 'in_progress', 'in_progress', 'achieved']),
        achievedAt: undefined,
        createdBy: p.a.user._id,
        createdAt: start,
      })),
    );
    await ActionItem.insertMany(
      goals.flatMap((g, i) => [
        { mentorship: m._id, goal: g._id, title: i === 0 ? 'Rewrite resume bullets with measurable impact' : 'Pick a dataset and write a one-page project plan', assignee: 'student', dueDate: daysAgo(p.lastActiveDaysAgo + 5, now), status: rnd() < 0.7 ? 'done' : 'open', completedAt: daysAgo(p.lastActiveDaysAgo + 1, now), createdBy: p.a.user._id, createdAt: start },
        { mentorship: m._id, goal: g._id, title: i === 0 ? 'Complete two timed mock interviews' : 'Share draft README for review', assignee: 'student', dueDate: daysAgo(-int(1, 12), now), status: 'open', createdBy: p.a.user._id, createdAt: daysAgo(p.lastActiveDaysAgo, now) },
        ...(i === 0 ? [{ mentorship: m._id, goal: g._id, title: 'Send list of recommended reading', assignee: 'mentor', dueDate: daysAgo(p.lastActiveDaysAgo + 3, now), status: 'done', completedAt: daysAgo(p.lastActiveDaysAgo + 3, now), createdBy: p.s.user._id, createdAt: start }] : []),
      ]),
    );

    // Messages
    const nMsg = int(3, 9);
    const msgs = [];
    for (let k = 0; k < nMsg; k++) {
      const fromMentor = k % 2 === 1;
      const d = p.startedDaysAgo - Math.floor(((k + 1) * (p.startedDaysAgo - p.lastActiveDaysAgo)) / (nMsg + 1));
      msgs.push({ mentorship: m._id, sender: fromMentor ? p.a.user._id : p.s.user._id, senderRole: fromMentor ? 'mentor' : 'student', body: pick(fromMentor ? MESSAGE_SNIPPETS.mentor : MESSAGE_SNIPPETS.student), readAt: k < nMsg - 1 ? daysAgo(d - 1, now) : undefined, createdAt: daysAgo(d, now) });
    }
    await Message.insertMany(msgs);

    // Feedback on completed sessions (both directions, most of the time)
    const fb = [];
    for (const s of createdSessions.filter((x) => x.status === 'completed')) {
      if (rnd() < 0.8) fb.push({ mentorship: m._id, session: s._id, from: p.s.user._id, fromRole: 'student', kind: 'session', rating: pick([4, 5, 5, 5, 4, 3]), wouldRecommend: true, comment: pick(['Very practical advice.', 'Helped me prioritise.', 'Great mock interview, tough but fair.', undefined]), createdAt: s.completedAt });
      if (rnd() < 0.6) fb.push({ mentorship: m._id, session: s._id, from: p.a.user._id, fromRole: 'mentor', kind: 'session', rating: pick([4, 5, 4, 3, 5]), comment: pick(['Well prepared.', 'Good follow-through on action items.', undefined]), createdAt: s.completedAt });
    }
    if (fb.length) await Feedback.insertMany(fb);

    // Health + weekly snapshots (6 weeks of history to show decay & recovery)
    if (p.status === 'active') {
      const upcoming = createdSessions.filter((x) => x.status === 'scheduled').length;
      const { health, score } = classify({ daysSinceActivity: p.lastActiveDaysAgo, upcoming, sessionsCompleted: Math.min(2, createdSessions.length), messages: nMsg, actionsCompleted: 2, actionsOverdue: 0 }, { atRiskDays: 14, lapsedDays: 30 });
      await Mentorship.updateOne({ _id: m._id }, { $set: { health, healthScore: score, lastNudgedAt: health !== 'healthy' ? daysAgo(int(1, 6), now) : undefined } });
      let prev: string = 'healthy';
      for (let w = 5; w >= 0; w--) {
        const ws = startOfWeek(daysAgo(w * 7, now));
        const idle = Math.max(0, p.lastActiveDaysAgo - w * 7);
        const c = classify({ daysSinceActivity: idle, upcoming: w === 0 ? upcoming : 0, sessionsCompleted: 1, messages: 3, actionsCompleted: 1, actionsOverdue: 0 }, { atRiskDays: 14, lapsedDays: 30 });
        await EngagementSnapshot.create({ mentorship: m._id, weekStart: ws, sessionsCompleted: 1, sessionsUpcoming: w === 0 ? upcoming : 0, messages: 3, actionsCompleted: 1, actionsOverdue: 0, daysSinceActivity: idle, healthScore: c.score, health: c.health, previousHealth: prev, recovered: prev !== 'healthy' && c.health === 'healthy', nudged: c.health !== 'healthy' });
        prev = c.health;
      }
    }
  }

  /* ---------------- requests: pending, declined, expired, withdrawn */
  const free = students.filter((s) => !engaged.has(String(s.profile._id)));
  const mkReq = (s: S, a: A, status: string, created: number, extra: Record<string, unknown> = {}) =>
    MentorshipRequest.create({
      student: s.profile._id,
      alumnus: a.alumnus._id,
      message: `Hello! I'm a ${s.profile.program} student aiming for ${s.profile.targetRoles?.[0] ?? 'industry roles'}. I'd love your perspective on building the right skills and preparing for placements.`,
      goals: s.goals.slice(0, 1).map((g) => g._id),
      status,
      expiresAt: new Date(daysAgo(created, now).getTime() + 7 * DAY_MS),
      matchScore: int(48, 88),
      matchReasons: [`Works in ${a.industry}, one of your target industries`, 'Offers the help you asked for: interview preparation'],
      createdAt: daysAgo(created, now),
      ...extra,
    });

  // 3 pending for the demo mentor (who has 1 slot left) — demonstrates easy accept / guilt-free decline
  for (let i = 0; i < 3; i++) await mkReq(free[i], demoMentor, 'pending', i + 1);
  // the demo student has one pending request elsewhere
  const otherDataMentor = verified.find((a) => a.industry === 'FinTech' && (capLeft.get(String(a.alumnus._id)) ?? 0) > 0)!;
  await mkReq(demoStudent, otherDataMentor, 'pending', 2);
  // a variety of other outcomes
  const reasons = ['at_capacity', 'not_my_expertise', 'timing', 'better_match_elsewhere', null];
  for (let i = 3; i < Math.min(free.length, 18); i++) {
    const a = pick(verified.filter((x) => x !== demoMentor));
    const kind = i % 4;
    if (kind === 0) await mkReq(free[i], a, 'pending', int(1, 5));
    else if (kind === 1) await mkReq(free[i], a, 'declined', int(10, 90), { respondedAt: daysAgo(int(5, 9), now), declineReason: pick(reasons) });
    else if (kind === 2) await mkReq(free[i], a, 'expired', int(15, 120), { respondedAt: daysAgo(int(8, 100), now) });
    else await mkReq(free[i], a, 'withdrawn', int(10, 60), { respondedAt: daysAgo(int(5, 50), now) });
  }

  /* ---------------- placement outcomes (final-year students) */
  for (const s of students.filter((x) => x.profile.graduationYear === 2026)) {
    const mentored = engaged.has(String(s.profile._id));
    const r = rnd();
    const status = mentored ? (r < 0.78 ? 'placed' : r < 0.9 ? 'higher_studies' : 'not_placed') : r < 0.6 ? 'placed' : r < 0.72 ? 'higher_studies' : 'not_placed';
    const ind = s.profile.targetIndustries?.[0];
    await PlacementOutcome.create({ student: s.profile._id, status, company: status === 'placed' ? pick(INDUSTRY_PROFILES[ind]?.companies ?? ['Northwind Systems']) : undefined, role: status === 'placed' ? s.profile.targetRoles?.[0] : undefined, industry: status === 'placed' ? ind : undefined, recordedAt: daysAgo(int(5, 60), now) });
  }

  /* ---------------- welcome notifications for demo users */
  await Notification.insertMany([
    { user: demoStudent.user._id, type: 'request_accepted', title: 'Priya Nair accepted your request', body: 'Say hello and propose a first session.', link: `/mentorships`, createdAt: daysAgo(63, now), readAt: daysAgo(63, now) },
    { user: demoMentor.user._id, type: 'request_new', title: '3 students would like you as a mentor', body: 'You have 1 open slot. Declining is one click — students are pointed to other mentors.', link: '/mentor', createdAt: daysAgo(1, now) },
  ]);

  // Demo accounts count as having confirmed their email, so every demo login works straight away.
  await User.updateMany({ emailVerifiedAt: null }, { $set: { emailVerifiedAt: now } });

  const summary = {
    alumniVerified: await Alumnus.countDocuments({ verificationStatus: 'verified' }),
    verificationsPending: await VerificationRequest.countDocuments({ status: 'pending' }),
    students: await StudentProfile.countDocuments(),
    mentorships: await Mentorship.countDocuments(),
    requests: await MentorshipRequest.countDocuments(),
    sessions: await Session.countDocuments(),
  };
  logger.info('Seed complete', summary);
  return summary;
}

// CLI entry: `npm run seed`
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { connectDb, disconnectDb } = await import('../db.js');
  await connectDb();
  const s = await runSeed({ reset: true });
  console.log('Seeded:', s);
  await disconnectDb();
  process.exit(0);
}
