import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Alumnus, AvailabilityWindow, ExpertiseTag, MentorCapacity, MentorshipRequest, Settings, StudentProfile, User, CareerGoal } from '../src/models/index.js';
import { signToken } from '../src/middleware/auth.js';
import { addDays } from '../src/lib/clock.js';

let server: MongoMemoryServer | null = null;

export async function startDb() {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
}
export async function stopDb() {
  await mongoose.disconnect();
  await server?.stop();
}
export async function clearDb() {
  for (const c of await mongoose.connection.db!.collections()) await c.deleteMany({});
}

export const app = createApp();
export const api = () => request(app);

let seq = 0;
const PW = bcrypt.hashSync('Passw0rd!', 4);

export function tokenFor(user: { _id: unknown; role: string }) {
  return signToken(String(user._id), user.role as any);
}
export const auth = (user: { _id: unknown; role: string }) => ({ Authorization: `Bearer ${tokenFor(user)}` });

export async function makeStaff(role: 'aro' | 'admin' | 'placement') {
  seq++;
  return User.create({ name: `${role} ${seq}`, email: `${role}${seq}@staff.test`, role, passwordHash: PW });
}

export async function makeTag(name: string) {
  return ExpertiseTag.findOneAndUpdate({ slug: name.toLowerCase().replace(/\W+/g, '-') }, { $setOnInsert: { name, slug: name.toLowerCase().replace(/\W+/g, '-'), category: 'Test' } }, { upsert: true, new: true });
}

export async function makeMentor(o: Partial<{ name: string; maxMentees: number; maxPendingRequests: number; paused: boolean; industry: string; role: string; tags: string[]; areas: string[]; department: string; availability: number }> = {}) {
  seq++;
  const user = await User.create({ name: o.name ?? `Mentor ${seq}`, email: `mentor${seq}@alumni.test`, phone: `+91 98765 4${String(seq).padStart(4, '0')}`, role: 'alumnus', passwordHash: PW });
  const tags = await Promise.all((o.tags ?? ['Python']).map(makeTag));
  const alumnus = await Alumnus.create({
    user: user._id,
    verificationStatus: 'verified',
    verifiedAt: new Date(),
    industry: o.industry ?? 'Software',
    currentRole: o.role ?? 'Software Engineer',
    headline: o.role ?? 'Software Engineer',
    department: o.department ?? 'Computer Science & Engineering',
    expertise: tags.map((t) => t!._id),
    mentoringAreas: o.areas ?? ['career_guidance'],
    linkedinUrl: `https://www.linkedin.com/in/mentor-${seq}`,
    graduationYear: 2015,
    yearsExperience: 8,
  });
  const cap = await MentorCapacity.create({ alumnus: alumnus._id, maxMentees: o.maxMentees ?? 2, maxPendingRequests: o.maxPendingRequests ?? 5, paused: !!o.paused });
  for (let i = 0; i < (o.availability ?? 0); i++) await AvailabilityWindow.create({ alumnus: alumnus._id, dayOfWeek: i, startMinute: 600, endMinute: 660 });
  return { user, alumnus, cap };
}

export async function makeStudent(o: Partial<{ name: string; tags: string[]; roles: string[]; industries: string[]; areas: string[]; department: string }> = {}) {
  seq++;
  const user = await User.create({ name: o.name ?? `Student ${seq}`, email: `student${seq}@uni.test`, phone: `+91 91234 5${String(seq).padStart(4, '0')}`, role: 'student', passwordHash: PW });
  const tags = await Promise.all((o.tags ?? ['Python']).map(makeTag));
  const profile = await StudentProfile.create({
    user: user._id,
    department: o.department ?? 'Computer Science & Engineering',
    interests: tags.map((t) => t!._id),
    targetRoles: o.roles ?? ['Software Engineer'],
    targetIndustries: o.industries ?? ['Software'],
    mentoringAreasWanted: o.areas ?? ['career_guidance'],
  });
  await CareerGoal.create({ student: profile._id, title: 'Get a job', targetRole: (o.roles ?? ['Software Engineer'])[0] });
  return { user, profile };
}

export async function pendingRequest(studentProfileId: unknown, alumnusId: unknown, expiresAt = addDays(new Date(), 7)) {
  return MentorshipRequest.create({ student: studentProfileId, alumnus: alumnusId, message: 'Please mentor me, I would value your guidance a lot.', status: 'pending', expiresAt });
}

export async function setSettings(set: Record<string, unknown>) {
  await Settings.updateOne({ key: 'global' }, { $set: set }, { upsert: true });
}
