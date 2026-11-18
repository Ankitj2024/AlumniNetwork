import mongoose, { Schema } from 'mongoose';

const { model } = mongoose;
const ObjectId = Schema.Types.ObjectId;

/* -------------------------------------------------------- Notification */
const notificationSchema = new Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: String,
    link: String,
    actions: [{ label: String, href: String, _id: false }],
    readAt: Date,
    channels: [String],
  },
  { timestamps: true },
);
notificationSchema.index({ user: 1, createdAt: -1 });
export const Notification = model('Notification', notificationSchema);

/* ------------------------------------------------------------ AuditLog */
const auditLogSchema = new Schema(
  {
    actor: { type: ObjectId, ref: 'User' },
    actorRole: String,
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: ObjectId, index: true },
    details: Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
export const AuditLog = model('AuditLog', auditLogSchema);

/* ----------------------------------------------------------- AuthToken */
/**
 * One-time links: password reset, email confirmation and admin invites. Only a SHA-256 hash of
 * the token is stored; MongoDB deletes rows once they expire (TTL index).
 */
const authTokenSchema = new Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, enum: ['password_reset', 'email_verify'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    usedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
export const AuthToken = model('AuthToken', authTokenSchema);

/* ------------------------------------------------------------ Settings */
/** Singleton document holding admin-tunable programme parameters. */
const settingsSchema = new Schema(
  {
    key: { type: String, default: 'global', unique: true },
    matchingWeights: {
      expertise: { type: Number, default: 30 },
      targetRole: { type: Number, default: 20 },
      industry: { type: Number, default: 15 },
      mentoringAreas: { type: Number, default: 15 },
      department: { type: Number, default: 5 },
      availability: { type: Number, default: 5 },
      loadBalance: { type: Number, default: 10 },
    },
    throttle: {
      maxPendingRequests: { type: Number, default: 3 },
      maxRequestsPerPeriod: { type: Number, default: 5 },
      periodDays: { type: Number, default: 7 },
      reRequestCooldownDays: { type: Number, default: 30 },
      maxActiveMentorshipsPerStudent: { type: Number, default: 2 },
    },
    requestExpiryDays: { type: Number, default: 7 },
    engagement: {
      atRiskDays: { type: Number, default: 14 },
      lapsedDays: { type: Number, default: 30 },
      nudgeCooldownDays: { type: Number, default: 7 },
    },
    verification: {
      autoApproveExactMatch: { type: Boolean, default: false },
    },
    updatedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
export const Settings = model('Settings', settingsSchema);

/* -------------------------------------------------- CalendarConnection */
const calendarConnectionSchema = new Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: ['google', 'outlook'], required: true },
    accessToken: { type: String, select: false },
    refreshToken: { type: String, select: false },
    expiresAt: Date,
    accountLabel: String,
  },
  { timestamps: true },
);
calendarConnectionSchema.index({ user: 1, provider: 1 }, { unique: true });
export const CalendarConnection = model('CalendarConnection', calendarConnectionSchema);
