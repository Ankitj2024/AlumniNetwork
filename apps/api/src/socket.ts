import type http from 'node:http';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { setIo } from './lib/realtime.js';
import { readToken, viewerFromToken } from './middleware/auth.js';
import { postMessage } from './routes/messages.js';
import { mentorshipAccess } from './services/access.js';

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  (header ?? '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

/** Socket.IO for real-time messages and notifications. All payloads go through lib/realtime.ts (privacy-checked). */
export function attachSocket(server: http.Server) {
  const io = new Server(server, { cors: { origin: env.webOrigin, credentials: true }, path: '/socket.io' });

  io.use(async (socket, next) => {
    const token = (socket.handshake.auth?.token as string | undefined) ?? readToken({ headers: socket.handshake.headers as any, cookies: parseCookies(socket.handshake.headers.cookie) });
    const viewer = await viewerFromToken(token ?? null);
    if (!viewer) return next(new Error('unauthorized'));
    socket.data.viewer = viewer;
    next();
  });

  io.on('connection', (socket) => {
    const viewer = socket.data.viewer;
    socket.join(`user:${viewer.id}`);

    socket.on('join', async (mentorshipId: string, ack?: (r: unknown) => void) => {
      try {
        await mentorshipAccess(viewer, String(mentorshipId));
        socket.join(`mentorship:${mentorshipId}`);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });
    socket.on('leave', (mentorshipId: string) => socket.leave(`mentorship:${mentorshipId}`));

    socket.on('message', async (p: { mentorshipId: string; body: string }, ack?: (r: unknown) => void) => {
      try {
        if (!p?.body?.trim() || p.body.length > 4000) throw new Error('Invalid message');
        const { view, masked } = await postMessage(viewer, String(p.mentorshipId), p.body);
        ack?.({ ok: true, message: view, masked });
      } catch (e) {
        ack?.({ ok: false, error: (e as Error).message });
      }
    });

    socket.on('typing', (mentorshipId: string) => {
      if (socket.rooms.has(`mentorship:${mentorshipId}`)) socket.to(`mentorship:${mentorshipId}`).emit('typing', { mentorshipId });
    });
  });

  setIo(io);
  logger.info('Socket.IO attached');
  return io;
}
