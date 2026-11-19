import type { Server as HttpServer } from 'node:http';
import { parse as parseCookie } from 'cookie';
import { Server, type Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, UserDTO } from '@sprintly/shared';
import { env } from '../config/env';
import { AUTH_COOKIE, verifyToken } from '../lib/auth';
import { UserModel, PUBLIC_USER_FIELDS } from '../models';
import { toUser } from '../lib/serialize';
import { projectAccess } from '../services/access';

type SocketData = { user: UserDTO };
type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

let io: IO | null = null;

const projectRoom = (id: string) => `project:${id}`;
const userRoom = (id: string) => `user:${id}`;

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
  });

  // Authenticate the handshake with the same httpOnly cookie the REST API uses.
  io.use(async (socket, next) => {
    const cookies = parseCookie(socket.handshake.headers.cookie ?? '');
    const userId = cookies[AUTH_COOKIE] ? verifyToken(cookies[AUTH_COOKIE]!) : null;
    if (!userId) return next(new Error('unauthorized'));
    const user = await UserModel.findById(userId, PUBLIC_USER_FIELDS).lean();
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = toUser(user);
    next();
  });

  io.on('connection', (socket: ClientSocket) => {
    const me = socket.data.user;
    socket.join(userRoom(me.id));

    socket.on('project:join', async (projectId) => {
      try {
        await projectAccess(projectId, me.id);
        await socket.join(projectRoom(projectId));
        await broadcastPresence(projectId);
      } catch {
        /* silently ignore rooms the user can't see */
      }
    });

    socket.on('project:leave', async (projectId) => {
      await socket.leave(projectRoom(projectId));
      await broadcastPresence(projectId);
    });

    socket.on('disconnecting', () => {
      const rooms = [...socket.rooms].filter((r) => r.startsWith('project:'));
      // Rooms are left after this handler, so defer the presence recount.
      setTimeout(() => rooms.forEach((r) => void broadcastPresence(r.slice('project:'.length))), 0);
    });
  });

  return io;
}

/** Who is currently viewing a project (deduplicated across tabs). */
async function broadcastPresence(projectId: string) {
  if (!io) return;
  const sockets = await io.in(projectRoom(projectId)).fetchSockets();
  const users = new Map<string, UserDTO>();
  for (const s of sockets) users.set(s.data.user.id, s.data.user);
  io.to(projectRoom(projectId)).emit('presence:update', { projectId, users: [...users.values()] });
}

type EventName = keyof ServerToClientEvents;
type Payload<E extends EventName> = Parameters<ServerToClientEvents[E]>[0];

export function emitToProject<E extends EventName>(projectId: string, event: E, payload: Payload<E>) {
  // Cast needed: socket.io's typed emit can't resolve a generic event key.
  (io?.to(projectRoom(projectId)).emit as ((e: E, p: Payload<E>) => void) | undefined)?.(event, payload);
}

export function emitToUser<E extends EventName>(userId: string, event: E, payload: Payload<E>) {
  (io?.to(userRoom(userId)).emit as ((e: E, p: Payload<E>) => void) | undefined)?.(event, payload);
}
