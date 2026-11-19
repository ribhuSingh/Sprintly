import type { ActivityVerb, NotificationKind } from '@sprintly/shared';
import type { Types } from 'mongoose';
import { ActivityModel, NotificationModel, PUBLIC_USER_FIELDS, UserModel } from '../models';
import { toActivity, toNotification } from '../lib/serialize';
import { emitToProject, emitToUser } from '../socket';

/**
 * Side-effects of mutations: the activity feed and user notifications.
 * Both are persisted and pushed over Socket.IO. Failures are logged, never thrown,
 * so a feed hiccup can't fail the user's actual mutation.
 */

interface ActivityInput {
  actor: string;
  verb: ActivityVerb;
  project: { _id: Types.ObjectId; team: Types.ObjectId };
  issue?: { _id: Types.ObjectId; identifier: string; title: string } | null;
  changes?: { field: string; from: unknown; to: unknown }[];
}

export async function recordActivity(input: ActivityInput) {
  try {
    const activity = await ActivityModel.create({
      actor: input.actor,
      verb: input.verb,
      team: input.project.team,
      project: input.project._id,
      issue: input.issue?._id ?? null,
      issueSnapshot: input.issue ? { identifier: input.issue.identifier, title: input.issue.title } : undefined,
      changes: input.changes ?? [],
    });
    await activity.populate([
      { path: 'actor', select: PUBLIC_USER_FIELDS },
      { path: 'project', select: 'name key' },
    ]);
    emitToProject(input.project._id.toString(), 'activity:new', { activity: toActivity(activity) });
  } catch (err) {
    console.error('[activity] failed to record', err);
  }
}

export async function notify(
  recipients: string[],
  actorId: string,
  kind: NotificationKind,
  message: string,
  link: string,
) {
  try {
    const users = [...new Set(recipients)].filter((r) => r !== actorId);
    if (users.length === 0) return;
    const [docs, actor] = await Promise.all([
      NotificationModel.insertMany(users.map((user) => ({ user, actor: actorId, kind, message, link }))),
      UserModel.findById(actorId, PUBLIC_USER_FIELDS).lean(),
    ]);
    for (const doc of docs) {
      emitToUser(doc.user.toString(), 'notification:new', {
        notification: toNotification({ ...doc.toObject(), actor }),
      });
    }
  } catch (err) {
    console.error('[notify] failed', err);
  }
}
