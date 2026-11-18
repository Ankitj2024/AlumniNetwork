import { forbidden, notFound } from '../lib/errors.js';
import { Alumnus, Mentorship, StudentProfile } from '../models/index.js';
import type { Viewer } from '../serializers/index.js';

export interface MentorshipAccess {
  mentorship: any;
  isMentor: boolean;
  isStudent: boolean;
  isStaff: boolean;
  role: 'mentor' | 'student' | 'staff';
  counterpartUserId: string | null;
  mentorUserId: string;
  studentUserId: string;
}

/** Loads a mentorship and checks the viewer is a participant (or staff with read access). */
export async function mentorshipAccess(viewer: Viewer, mentorshipId: string, opts: { write?: boolean } = {}): Promise<MentorshipAccess> {
  const m = await Mentorship.findById(mentorshipId).lean().catch(() => null);
  if (!m) throw notFound('Mentorship');
  const [student, alumnus] = await Promise.all([StudentProfile.findById(m.student).lean(), Alumnus.findById(m.alumnus).lean()]);
  const studentUserId = String(student?.user ?? '');
  const mentorUserId = String(alumnus?.user ?? '');
  const isMentor = viewer.id === mentorUserId;
  const isStudent = viewer.id === studentUserId;
  const isStaff = viewer.role === 'aro' || viewer.role === 'admin';
  if (!isMentor && !isStudent && !(isStaff && !opts.write)) throw forbidden();
  return {
    mentorship: m,
    isMentor,
    isStudent,
    isStaff,
    role: isMentor ? 'mentor' : isStudent ? 'student' : 'staff',
    counterpartUserId: isMentor ? studentUserId : isStudent ? mentorUserId : null,
    mentorUserId,
    studentUserId,
  };
}

export async function touchMentorship(mentorshipId: unknown, at = new Date()) {
  await Mentorship.updateOne({ _id: mentorshipId }, { $max: { lastActivityAt: at } });
}
