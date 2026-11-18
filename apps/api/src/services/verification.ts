import { badRequest, conflict, notFound } from '../lib/errors.js';
import { Alumnus, InstitutionRecord, MentorCapacity, User, VerificationRequest } from '../models/index.js';
import type { Viewer } from '../serializers/index.js';
import { audit } from './audit.js';
import { notify } from './notify.js';
import { getSettings } from './settings.js';

const TITLES = /\b(dr|mr|mrs|ms|miss|prof|er)\.?\s+/g;
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(TITLES, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSimilarity(a: string, b: string): number {
  const A = new Set(normalizeName(a).split(' ').filter(Boolean));
  const B = new Set(normalizeName(b).split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((t) => B.has(t) && inter++);
  return inter / Math.max(A.size, B.size);
}

const norm = (s?: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export type Submitted = {
  fullName: string;
  rollNumber: string;
  graduationYear: number;
  degree: string;
  department: string;
  dateOfBirth?: string;
};

/** Compares a claim with the institutional record (ERP / alumni register mirror). */
export async function matchAgainstRecords(s: Submitted) {
  const record = await InstitutionRecord.findOne({ rollNumber: s.rollNumber.toUpperCase().trim() }).lean();
  if (!record) {
    return { matched: false, confidence: 0, record: null, matchedFields: [] as string[], mismatchedFields: ['rollNumber'] };
  }
  const matchedFields: string[] = ['rollNumber'];
  const mismatchedFields: string[] = [];
  const check = (field: string, ok: boolean) => (ok ? matchedFields : mismatchedFields).push(field);

  check('fullName', tokenSimilarity(s.fullName, record.fullName) >= 0.67);
  check('graduationYear', Number(s.graduationYear) === record.graduationYear);
  check('degree', norm(s.degree) === norm(record.degree));
  check('department', norm(s.department) === norm(record.department));
  if (s.dateOfBirth && record.dateOfBirth) check('dateOfBirth', s.dateOfBirth === record.dateOfBirth);

  const total = matchedFields.length + mismatchedFields.length;
  const critical = ['fullName', 'graduationYear', 'dateOfBirth'].some((f) => mismatchedFields.includes(f));
  return {
    matched: !critical && mismatchedFields.length === 0,
    confidence: Math.round((matchedFields.length / total) * 100) / 100,
    record,
    matchedFields,
    mismatchedFields,
  };
}

async function staffNames(viewer: Viewer | null) {
  if (!viewer) return 'System (automatic record match)';
  const u = await User.findById(viewer.id).lean();
  return u?.name ?? 'Staff';
}

export async function ensureCapacity(alumnusId: unknown) {
  await MentorCapacity.updateOne(
    { alumnus: alumnusId },
    { $setOnInsert: { alumnus: alumnusId, maxMentees: 2, activeCount: 0, maxPendingRequests: 5 } },
    { upsert: true },
  );
}

export async function submitVerification(
  viewer: Viewer,
  submitted: Submitted,
  documents: { originalName: string; storedName: string; mimeType: string; size: number }[],
) {
  const alumnus = await Alumnus.findOne({ user: viewer.id });
  if (!alumnus) throw notFound('Alumnus profile');
  if (alumnus.verificationStatus === 'verified') throw conflict('already_verified', 'Your alumni status is already verified');
  const open = await VerificationRequest.findOne({ alumnus: alumnus._id, status: { $in: ['pending', 'needs_info'] } });

  const match = await matchAgainstRecords(submitted);
  const matchResult = {
    matched: match.matched,
    confidence: match.confidence,
    record: match.record?._id,
    matchedFields: match.matchedFields,
    mismatchedFields: match.mismatchedFields,
  };
  const historyNote = match.matched
    ? `Record match on ${match.matchedFields.join(', ')}`
    : match.record
      ? `Partial record match; mismatched: ${match.mismatchedFields.join(', ')}`
      : 'No institutional record found for this roll number';

  let vr;
  if (open) {
    open.submitted = submitted;
    open.documents.push(...documents);
    open.matchResult = matchResult as any;
    open.status = 'pending';
    open.history.push({ status: 'resubmitted', by: viewer.id, byName: 'Applicant', note: historyNote, at: new Date() } as any);
    vr = await open.save();
  } else {
    vr = await VerificationRequest.create({
      alumnus: alumnus._id,
      user: viewer.id,
      submitted,
      documents,
      matchResult,
      status: 'pending',
      history: [{ status: 'submitted', by: viewer.id, byName: 'Applicant', note: historyNote, at: new Date() }],
    });
  }
  alumnus.verificationStatus = 'pending';
  alumnus.rollNumber = submitted.rollNumber;
  await alumnus.save();
  await audit(viewer, 'verification.submitted', 'VerificationRequest', vr._id, { matched: match.matched, confidence: match.confidence });

  const settings = await getSettings();
  if (settings.verification.autoApproveExactMatch && match.matched && match.confidence === 1) {
    return decideVerification(null, String(vr._id), 'approve', 'Automatically approved: exact match with institutional record');
  }

  const officers = await User.find({ role: 'aro', status: 'active' }).select('_id').lean();
  await Promise.all(
    officers.map((o) =>
      notify(o._id, 'verification_status', { title: 'New alumni verification to review', body: historyNote, link: '/admin/verification' }, { email: false }),
    ),
  );
  return vr;
}

export async function decideVerification(viewer: Viewer | null, requestId: string, decision: 'approve' | 'reject' | 'needs_info', note?: string) {
  const vr = await VerificationRequest.findById(requestId);
  if (!vr) throw notFound('Verification request');
  if (vr.status === 'approved' || vr.status === 'rejected') throw conflict('already_decided', 'This request has already been decided');
  if (decision !== 'approve' && !note) throw badRequest('note_required', 'Please add a note explaining the decision to the applicant');

  const status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'needs_info';
  const byName = await staffNames(viewer);
  vr.status = status;
  vr.reviewer = viewer ? (viewer.id as any) : undefined;
  vr.reviewNote = note;
  if (status !== 'needs_info') vr.decidedAt = new Date();
  vr.history.push({ status, by: viewer?.id, byName, note, at: new Date() } as any);
  await vr.save();

  const alumnus = await Alumnus.findById(vr.alumnus);
  if (!alumnus) throw notFound('Alumnus');
  if (status === 'approved') {
    alumnus.verificationStatus = 'verified';
    alumnus.verifiedAt = new Date();
    if (vr.matchResult?.record) {
      const rec = await InstitutionRecord.findById(vr.matchResult.record).lean();
      if (rec) {
        alumnus.institutionRecord = rec._id;
        alumnus.rollNumber = rec.rollNumber;
        alumnus.graduationYear = rec.graduationYear;
        alumnus.degree = rec.degree;
        alumnus.department = rec.department as any;
      }
    }
    await ensureCapacity(alumnus._id);
  } else if (status === 'rejected') {
    alumnus.verificationStatus = 'rejected';
  }
  await alumnus.save();
  await audit(viewer, `verification.${status}`, 'VerificationRequest', vr._id, { note, alumnus: String(alumnus._id) });

  const msg = {
    approved: { title: 'You are verified — welcome to the mentor network', body: 'Set your capacity and availability so students can find you. You stay in control of how many mentees you take.' },
    rejected: { title: 'Alumni verification was not approved', body: note },
    needs_info: { title: 'More information needed for your verification', body: note },
  }[status];
  await notify(alumnus.user, 'verification_status', { ...msg, link: '/mentor/profile' });
  return vr;
}
