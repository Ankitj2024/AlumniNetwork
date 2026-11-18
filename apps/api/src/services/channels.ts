import fs from 'node:fs';
import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * Outbound channels. Real providers are used when configured; otherwise messages are written
 * to the local outbox/ folder so every notification path is observable in development.
 */
let transporter: Transporter | null = null;
function mailer(): Transporter {
  if (!transporter) {
    transporter = env.smtpUrl ? nodemailer.createTransport(env.smtpUrl) : nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

function writeOutbox(kind: 'email' | 'sms', data: Record<string, unknown>) {
  if (env.isTest) return;
  try {
    fs.mkdirSync(env.outboxDir, { recursive: true });
    const file = path.join(env.outboxDir, `${Date.now()}-${kind}-${Math.random().toString(36).slice(2, 8)}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    logger.warn('Could not write outbox file', { e: String(e) });
  }
}

/** Under test, emails are captured here instead of being sent, so tests can follow reset and confirmation links. */
export const testOutbox: { to: string; subject: string; text: string }[] = [];

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  if (env.isTest) {
    testOutbox.push({ to, subject, text });
    return;
  }
  try {
    await mailer().sendMail({ from: env.mailFrom, to, subject, text, html: html ?? text.replace(/\n/g, '<br>') });
    if (!env.smtpUrl) writeOutbox('email', { to, subject, text });
  } catch (e) {
    logger.error('Email send failed', { subject, e: String(e) });
  }
}

export async function sendSms(to: string, body: string) {
  if (env.isTest) return;
  if (!env.twilioSid || !env.twilioToken || !env.twilioFrom) {
    writeOutbox('sms', { to, body });
    return;
  }
  try {
    const auth = Buffer.from(`${env.twilioSid}:${env.twilioToken}`).toString('base64');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.twilioSid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: env.twilioFrom, Body: body }),
    });
    if (!res.ok) logger.error('SMS send failed', { status: res.status });
  } catch (e) {
    logger.error('SMS send failed', { e: String(e) });
  }
}
