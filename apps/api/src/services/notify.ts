import { env } from '../config/env.js';
import { emitToUser } from '../lib/realtime.js';
import { Notification, User } from '../models/index.js';
import { notificationView } from '../serializers/index.js';
import { sendEmail, sendSms } from './channels.js';

export type NotificationType =
  | 'verification_status'
  | 'request_new'
  | 'request_accepted'
  | 'request_declined'
  | 'request_expired'
  | 'request_withdrawn'
  | 'session_proposed'
  | 'session_scheduled'
  | 'session_cancelled'
  | 'session_reminder'
  | 'action_item_due'
  | 'inactivity_nudge'
  | 'feedback_request'
  | 'mentorship_ended'
  | 'capacity_warning'
  | 'payment_due'
  | 'payment_received'
  | 'refund_issued'
  | 'message';

/** Types important enough to also send by SMS when the user has opted in. */
const SMS_TYPES = new Set<NotificationType>(['session_reminder', 'session_scheduled']);

export async function notify(
  userId: unknown,
  type: NotificationType,
  content: { title: string; body?: string; link?: string; actions?: { label: string; href: string }[] },
  opts: { email?: boolean } = {},
) {
  const n = await Notification.create({ user: userId, type, ...content, channels: ['in_app'] });
  emitToUser(String(userId), 'notification', notificationView(n.toObject()));

  // Contact details are used here server-side only, to deliver the notification. They never leave the server.
  const u = await User.findById(userId).select('+email +phone').lean();
  if (!u) return n;
  const channels = ['in_app'];
  if (opts.email !== false && u.notificationPrefs?.email !== false && u.email) {
    const link = content.link ? `${env.webOrigin}${content.link}` : env.webOrigin;
    const actionLines = (content.actions ?? []).map((a) => `${a.label}: ${env.webOrigin}${a.href}`).join('\n');
    await sendEmail(u.email, content.title, `${content.body ?? ''}\n\n${actionLines}\n\nOpen: ${link}`.trim());
    channels.push('email');
  }
  if (SMS_TYPES.has(type) && u.notificationPrefs?.sms && u.phone) {
    await sendSms(u.phone, `${content.title}${content.body ? ` — ${content.body}` : ''}`.slice(0, 300));
    channels.push('sms');
  }
  if (channels.length > 1) await Notification.updateOne({ _id: n._id }, { channels });
  return n;
}
