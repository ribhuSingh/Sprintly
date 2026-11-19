import { Router } from 'express';
import { Types } from 'mongoose';
import { cursorQuerySchema, type ActivityDTO, type CursorPage } from '@sprintly/shared';
import { ActivityModel, NotificationModel, PUBLIC_USER_FIELDS } from '../models';
import { badRequest, parse } from '../lib/errors';
import { toActivity, toNotification } from '../lib/serialize';
import { uid } from '../middleware/auth';
import { myTeamIds, projectAccess } from '../services/access';

export const feedRouter = Router();

/** Opaque keyset cursor: stable under concurrent inserts, unlike skip/offset. */
const encodeCursor = (d: Date, id: Types.ObjectId) => Buffer.from(`${d.toISOString()}|${id}`).toString('base64url');
function decodeCursor(cursor: string) {
  const [date, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const d = new Date(date ?? '');
  if (Number.isNaN(d.getTime()) || !id || !Types.ObjectId.isValid(id)) throw badRequest('Invalid cursor');
  return { createdAt: d, id: new Types.ObjectId(id) };
}

feedRouter.get('/activity', async (req, res) => {
  const me = uid(req);
  const q = parse(cursorQuerySchema, req.query);
  const filter: Record<string, unknown> = {};
  if (q.projectId) {
    await projectAccess(q.projectId, me);
    filter.project = new Types.ObjectId(q.projectId);
  } else {
    filter.team = { $in: await myTeamIds(me) };
  }
  if (q.cursor) {
    const c = decodeCursor(q.cursor);
    filter.$or = [{ createdAt: { $lt: c.createdAt } }, { createdAt: c.createdAt, _id: { $lt: c.id } }];
  }
  const rows = await ActivityModel.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(q.limit + 1)
    .populate('actor', PUBLIC_USER_FIELDS)
    .populate('project', 'name key')
    .lean();
  const hasMore = rows.length > q.limit;
  const page = rows.slice(0, q.limit);
  const last = page.at(-1);
  const body: CursorPage<ActivityDTO> = {
    items: page.map(toActivity),
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last._id) : null,
  };
  res.json(body);
});

feedRouter.get('/notifications', async (req, res) => {
  const me = uid(req);
  const [items, unread] = await Promise.all([
    NotificationModel.find({ user: me }).sort({ createdAt: -1 }).limit(50).populate('actor', PUBLIC_USER_FIELDS).lean(),
    NotificationModel.countDocuments({ user: me, read: false }),
  ]);
  res.json({ notifications: items.map(toNotification), unread });
});

feedRouter.post('/notifications/read-all', async (req, res) => {
  await NotificationModel.updateMany({ user: uid(req), read: false }, { read: true });
  res.status(204).end();
});

feedRouter.post('/notifications/:id/read', async (req, res) => {
  await NotificationModel.updateOne({ _id: req.params.id, user: uid(req) }, { read: true });
  res.status(204).end();
});
