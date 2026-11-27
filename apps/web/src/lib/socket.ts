'use client';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Single shared Socket.IO connection. The session cookie authenticates it. */
export function getSocket(): Socket {
  if (!socket) {
    const fallback =
      typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port === '3000'
        ? `${window.location.protocol}//${window.location.hostname}:4000`
        : '';
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || fallback;
    socket = io(url || undefined, { withCredentials: true, transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function closeSocket() {
  socket?.close();
  socket = null;
}
