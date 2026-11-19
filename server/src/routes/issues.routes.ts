import { Router } from 'express';
import { Types } from 'mongoose';
import {
  bulkUpdateIssuesSchema,
  createCommentSchema,
  moveIssueSchema,
  needsRebalance,
  orderBetween,
  updateIssueSchema,
  hasRole,
} from '@sprintly/shared';
import { ActivityModel, CommentModel, IssueModel, PUBLIC_USER_FIELDS } from '../models';
import { badRequest, forbidden, parse } from '../lib/errors';
import { toActivity, toComment, toIssue } from '../lib/serialize';
import { uid } from '../middleware/auth';
import { issueAccess, projectAccess, teamMemberIds } from '../services/access';
import { notify, recordActivity } from '../services/events';
import { emitToProject } from '../socket';
import {
  ISSUE_POPULATE,
  afterIssueChange,
  assertValidRefs,
  issueLink,
  rebalanceColumn,
  snapshot,
} from '../services/issues';

export const issuesRouter = Router();

issuesRouter.get('/:id', async (req, res) => {
  const { issue } = await issueAccess(req.params.id, uid(req));
  await issue.populate(ISSUE_POPULATE);
  res.json({ issue: toIssue(issue) });
});

issuesRouter.patch('/:id', async (req, res) => {
  const me = uid(req);
  const { issue, project } = await issueAccess(req.params.id, me, 'member');
  const { clientMutationId, ...patch } = parse(updateIssueSchema, req.body);
  await assertValidRefs(project, await teamMemberIds(project.team), patch);

  const before = snapshot(issue);
  const statusChanged = patch.status && patch.status !== issue.status;
  issue.set(patch);
  // Changing status from the detail view drops the card at the bottom of its new column.
  if (statusChanged) {
    const last = await IssueModel.findOne({ project: project._id, status: patch.status }, { order: 1 })
      .sort({ order: -1 })
      .lean();
    issue.order = orderBetween(last?.order ?? null, null);
  }
  await issue.save();
  res.json({ issue: await afterIssueChange(project, issue, me, before, clientMutationId) });
});

/**
 * Kanban drag-and-drop. The client sends the neighbouring card ids in the destination column;
 * we compute a fractional `order` between them so only the moved card is written.
 */
issuesRouter.post('/:id/move', async (req, res) => {
  const me = uid(req);
  const { issue, project } = await issueAccess(req.params.id, me, 'member');
  const body = parse(moveIssueSchema, req.body);

  const neighbourIds = [body.beforeId, body.afterId].filter(Boolean) as string[];
  const neighbours = await IssueModel.find(
    { _id: { $in: neighbourIds }, project: project._id, status: body.status },
    { order: 1 },
  ).lean();
  if (neighbours.length !== neighbourIds.length) {
    throw badRequest('Board is out of date, refresh and try again');
  }
  const orderOf = (id: string | null) => (id ? neighbours.find((n) => n._id.toString() === id)?.order : null);
  let beforeOrder = orderOf(body.beforeId);
  let afterOrder = orderOf(body.afterId);

  if (needsRebalance(beforeOrder, afterOrder)) {
    await rebalanceColumn(project._id, body.status);
    const fresh = await IssueModel.find({ _id: { $in: neighbourIds } }, { order: 1 }).lean();
    beforeOrder = fresh.find((n) => n._id.toString() === body.beforeId)?.order;
    afterOrder = fresh.find((n) => n._id.toString() === body.afterId)?.order;
  }

  const before = snapshot(issue);
  issue.status = body.status;
  issue.order = orderBetween(beforeOrder, afterOrder);
  await issue.save();
  res.json({ issue: await afterIssueChange(project, issue, me, before, body.clientMutationId, 'issue.moved') });
});

issuesRouter.delete('/:id', async (req, res) => {
  const me = uid(req);
  const { issue, project, role } = await issueAccess(req.params.id, me, 'member');
  // Members may delete their own issues; admins may delete any.
  if (!hasRole(role, 'admin') && issue.reporter.toString() !== me) {
    throw forbidden('Only the reporter or an admin can delete this issue');
  }
  await Promise.all([issue.deleteOne(), CommentModel.deleteMany({ issue: issue._id })]);
  emitToProject(project.id, 'issue:deleted', {
    id: issue.id,
    project: project.id,
    clientMutationId: req.query.clientMutationId as string | undefined,
  });
  void recordActivity({ actor: me, verb: 'issue.deleted', project, issue });
  res.status(204).end();
});

/** Bulk status/priority update from the table's row selection. */
issuesRouter.post('/bulk', async (req, res) => {
  const me = uid(req);
  const body = parse(bulkUpdateIssuesSchema, req.body);
  const issues = await IssueModel.find({ _id: { $in: body.ids.map((id) => new Types.ObjectId(id)) } });
  const projectIds = [...new Set(issues.map((i) => i.project.toString()))];
  const projects = new Map(
    await Promise.all(projectIds.map(async (pid) => [pid, (await projectAccess(pid, me, 'member')).project] as const)),
  );
  const updated = [];
  for (const issue of issues) {
    const project = projects.get(issue.project.toString())!;
    const before = snapshot(issue);
    issue.set(body.patch);
    await issue.save();
    updated.push(await afterIssueChange(project, issue, me, before));
  }
  res.json({ issues: updated });
});

// ---------- Comments ----------

issuesRouter.get('/:id/comments', async (req, res) => {
  const { issue } = await issueAccess(req.params.id, uid(req));
  const comments = await CommentModel.find({ issue: issue._id })
    .sort({ createdAt: 1 })
    .populate('author', PUBLIC_USER_FIELDS)
    .lean();
  res.json({ comments: comments.map(toComment) });
});

issuesRouter.post('/:id/comments', async (req, res) => {
  const me = uid(req);
  const { issue, project } = await issueAccess(req.params.id, me, 'member');
  const body = parse(createCommentSchema, req.body);
  const comment = await CommentModel.create({ issue: issue._id, project: project._id, author: me, body: body.body });
  await comment.populate('author', PUBLIC_USER_FIELDS);
  await IssueModel.updateOne({ _id: issue._id }, { $inc: { commentCount: 1 } });
  const dto = toComment(comment);

  emitToProject(project.id, 'comment:created', { comment: dto, clientMutationId: body.clientMutationId });
  void recordActivity({ actor: me, verb: 'comment.created', project, issue });
  // Everyone involved in the issue (and anyone previously commenting) hears about it.
  const priorCommenters = await CommentModel.distinct('author', { issue: issue._id });
  void notify(
    [...issue.assignees.map(String), issue.reporter.toString(), ...priorCommenters.map(String)],
    me,
    'commented',
    `commented on ${issue.identifier}: “${body.body.slice(0, 80)}${body.body.length > 80 ? '…' : ''}”`,
    issueLink(project.id, issue.id),
  );
  res.status(201).json({ comment: dto });
});

issuesRouter.get('/:id/activity', async (req, res) => {
  const { issue } = await issueAccess(req.params.id, uid(req));
  const activity = await ActivityModel.find({ issue: issue._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('actor', PUBLIC_USER_FIELDS)
    .populate('project', 'name key')
    .lean();
  res.json({ activity: activity.map(toActivity) });
});
