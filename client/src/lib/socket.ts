import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@sprintly/shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/** Lazily connect once authenticated. The httpOnly cookie authenticates the handshake. */
export function getSocket(): AppSocket {
  if (!socket) {
    socket = io({ withCredentials: true, transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/**
 * Ids of mutations this tab started. Socket echoes carrying one of these are skipped:
 * the optimistic update + HTTP response already applied them.
 */
const own = new Set<string>();
export const trackMutation = (id: string) => {
  own.add(id);
  setTimeout(() => own.delete(id), 30_000);
  return id;
};
export const isOwnMutation = (id?: string) => !!id && own.has(id);
