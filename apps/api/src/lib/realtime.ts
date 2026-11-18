import type { Server } from 'socket.io';
import { findPrivacyViolations } from '../serializers/index.js';
import { logger } from './logger.js';

let io: Server | null = null;

export function setIo(server: Server | null) {
  io = server;
}
export function getIo() {
  return io;
}

/**
 * All socket emits go through here. Payloads are checked against the strictest viewer (a student)
 * because nothing pushed over sockets ever needs contact data.
 */
function safe(event: string, payload: unknown): boolean {
  const v = findPrivacyViolations(payload, { id: '', role: 'student' });
  if (v.length) {
    logger.error('PRIVACY VIOLATION BLOCKED (socket)', { event, violations: v });
    return false;
  }
  return true;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  if (!io || !safe(event, payload)) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export function emitToMentorship(mentorshipId: string, event: string, payload: unknown) {
  if (!io || !safe(event, payload)) return;
  io.to(`mentorship:${mentorshipId}`).emit(event, payload);
}
