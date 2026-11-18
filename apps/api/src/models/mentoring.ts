import mongoose, { Schema } from 'mongoose';
import { DECLINE_REASONS } from './constants.js';

const { model } = mongoose;
const ObjectId = Schema.Types.ObjectId;

/* ---------------------------------------------------------- MatchScore */
/** Snapshot of an on-demand match computation, kept for explainability and analytics. */
const matchScoreSchema = new Schema(
  {
    student: { type: ObjectId, ref: 'StudentProfile', required: true },
    alumnus: { type: ObjectId, ref: 'Alumnus', required: true },
    score: { type: Number, required: true },
    breakdown: { type: Map, of: Number },
    reasons: [String],
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);
matchScoreSchema.index({ student: 1, alumnus: 1 }, { unique: true });
export const MatchScore = model('MatchScore', matchScoreSchema);

/* --------------------------------------------------- MentorshipRequest */
const mentorshipRequestSchema = new Schema(
  {
    student: { type: ObjectId, ref: 'StudentProfile', required: true, index: true },
    alumnus: { type: ObjectId, ref: 'Alumnus', required: true, index: true },
    message: { type: String, required: true, maxlength: 1200 },
    goals: [{ type: ObjectId, ref: 'CareerGoal' }],
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired', 'withdrawn'],
      default: 'pending',
      index: true,
    },
    declineReason: { type: String, enum: [...DECLINE_REASONS, null] },
    declineNote: { type: String, maxlength: 500 },
    expiresAt: { type: Date, required: true, index: true },
    respondedAt: Date,
    matchScore: Number,
    matchReasons: [String],
  },
  { timestamps: true },
);
mentorshipRequestSchema.index({ status: 1, expiresAt: 1 });
mentorshipRequestSchema.index({ student: 1, createdAt: -1 });
export const MentorshipRequest = model('MentorshipRequest', mentorshipRequestSchema);

/* ---------------------------------------------------------- Mentorship */
const mentorshipSchema = new Schema(
  {
    student: { type: ObjectId, ref: 'StudentProfile', required: true, index: true },
    alumnus: { type: ObjectId, ref: 'Alumnus', required: true, index: true },
    request: { type: ObjectId, ref: 'MentorshipRequest', unique: true, sparse: true },
    status: { type: String, enum: ['active', 'completed', 'ended'], default: 'active', index: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: Date,
    endReason: String,
    endedBy: { type: ObjectId, ref: 'User' },
    lastActivityAt: { type: Date, default: Date.now, index: true },
    health: { type: String, enum: ['healthy', 'at_risk', 'lapsed'], default: 'healthy' },
    healthScore: { type: Number, default: 100 },
    lastNudgedAt: Date,
  },
  { timestamps: true },
);
export const Mentorship = model('Mentorship', mentorshipSchema);

/* ------------------------------------------------------------- Session */
const sessionSchema = new Schema(
  {
    mentorship: { type: ObjectId, ref: 'Mentorship', required: true, index: true },
    proposedBy: { type: ObjectId, ref: 'User', required: true },
    proposedSlots: [{ start: Date, end: Date, _id: false }],
    status: {
      type: String,
      enum: ['proposed', 'scheduled', 'completed', 'cancelled', 'no_show'],
      default: 'proposed',
      index: true,
    },
    title: { type: String, default: 'Mentoring session' },
    agenda: { type: String, maxlength: 2000 },
    scheduledStart: { type: Date, index: true },
    scheduledEnd: Date,
    videoLink: String,
    externalEvents: [{ provider: String, userId: { type: ObjectId, ref: 'User' }, eventId: String, _id: false }],
    summary: { type: String, maxlength: 4000 }, // shared session record
    mentorPrivateNotes: { type: String, maxlength: 4000, select: false },
    cancelledBy: { type: ObjectId, ref: 'User' },
    cancelReason: String,
    completedAt: Date,
    reminder24hSentAt: Date,
    reminder1hSentAt: Date,
  },
  { timestamps: true },
);
export const Session = model('Session', sessionSchema);

/* ---------------------------------------------------------------- Goal */
const goalSchema = new Schema(
  {
    mentorship: { type: ObjectId, ref: 'Mentorship', required: true, index: true },
    careerGoal: { type: ObjectId, ref: 'CareerGoal' },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 2000 },
    targetDate: Date,
    status: { type: String, enum: ['open', 'in_progress', 'achieved', 'dropped'], default: 'open' },
    achievedAt: Date,
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);
export const Goal = model('Goal', goalSchema);

/* ---------------------------------------------------------- ActionItem */
const actionItemSchema = new Schema(
  {
    mentorship: { type: ObjectId, ref: 'Mentorship', required: true, index: true },
    goal: { type: ObjectId, ref: 'Goal' },
    session: { type: ObjectId, ref: 'Session' },
    title: { type: String, required: true, maxlength: 300 },
    assignee: { type: String, enum: ['student', 'mentor'], default: 'student' },
    dueDate: { type: Date, index: true },
    status: { type: String, enum: ['open', 'done'], default: 'open' },
    completedAt: Date,
    dueReminderSentAt: Date,
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);
export const ActionItem = model('ActionItem', actionItemSchema);

/* ------------------------------------------------------------ Feedback */
const feedbackSchema = new Schema(
  {
    mentorship: { type: ObjectId, ref: 'Mentorship', required: true, index: true },
    session: { type: ObjectId, ref: 'Session' },
    from: { type: ObjectId, ref: 'User', required: true },
    fromRole: { type: String, enum: ['student', 'mentor'], required: true },
    kind: { type: String, enum: ['session', 'periodic', 'closing'], default: 'session' },
    rating: { type: Number, min: 1, max: 5, required: true },
    wouldRecommend: Boolean,
    comment: { type: String, maxlength: 2000 },
  },
  { timestamps: true },
);
feedbackSchema.index({ session: 1, from: 1 }, { unique: true, partialFilterExpression: { session: { $exists: true } } });
export const Feedback = model('Feedback', feedbackSchema);

/* ------------------------------------------------------------- Message */
const messageSchema = new Schema(
  {
    mentorship: { type: ObjectId, ref: 'Mentorship', required: true, index: true },
    sender: { type: ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['student', 'mentor'], required: true },
    /** Stored already masked: contact details typed into messages never reach the database. */
    body: { type: String, required: true, maxlength: 4000 },
    maskedCount: { type: Number, default: 0 },
    readAt: Date,
  },
  { timestamps: true },
);
messageSchema.index({ mentorship: 1, createdAt: -1 });
export const Message = model('Message', messageSchema);

/* ------------------------------------------------- EngagementSnapshot */
const engagementSnapshotSchema = new Schema(
  {
    mentorship: { type: ObjectId, ref: 'Mentorship', required: true, index: true },
    weekStart: { type: Date, required: true },
    sessionsCompleted: Number,
    sessionsUpcoming: Number,
    messages: Number,
    actionsCompleted: Number,
    actionsOverdue: Number,
    daysSinceActivity: Number,
    healthScore: Number,
    health: { type: String, enum: ['healthy', 'at_risk', 'lapsed'] },
    previousHealth: String,
    recovered: { type: Boolean, default: false },
    nudged: { type: Boolean, default: false },
  },
  { timestamps: true },
);
engagementSnapshotSchema.index({ mentorship: 1, weekStart: 1 }, { unique: true });
export const EngagementSnapshot = model('EngagementSnapshot', engagementSnapshotSchema);
