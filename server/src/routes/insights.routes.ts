import { Router } from 'express';
import { Types } from 'mongoose';
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  calendarQuerySchema,
  objectId,
  searchQuerySchema,
  type AnalyticsDTO,
  type SearchResultsDTO,
} from '@sprintly/shared';
import { z } from 'zod';
import { IssueModel, PUBLIC_USER_FIELDS, ProjectModel, UserModel } from '../models';
import { badRequest, escapeRegex, parse } from '../lib/errors';
import { toIssue, toProject, toUser } from '../lib/serialize';
import { uid } from '../middleware/auth';
import { myProjectIds, myTeamIds, projectAccess } from '../services/access';
import { ISSUE_POPULATE } from '../services/issues';

export const insightsRouter = Router();

async function scopeProjects(me: string, projectId?: string) {
  if (projectId) {
    const { project } = await projectAccess(projectId, me);
    return [project._id];
  }
  return myProjectIds(me);
}

// ---------- Global search ----------
insightsRouter.get('/search', async (req, res) => {
  const me = uid(req);
  const q = parse(searchQuerySchema, req.query);
  const rx = new RegExp(escapeRegex(q.q), 'i');
  const teamIds = await myTeamIds(me);
  const projects = await ProjectModel.find({ team: { $in: teamIds } }).lean();
  const byId = new Map(projects.map((p) => [p._id.toString(), p]));

  const issues = await IssueModel.find({
    project: { $in: projects.map((p) => p._id) },
    $or: [{ title: rx }, { identifier: rx }, { description: rx }],
  })
    .sort({ updatedAt: -1 })
    .limit(q.limit)
    .populate(ISSUE_POPULATE)
    .lean();

  const body: SearchResultsDTO = {
    issues: issues.map((i) => {
      const p = byId.get(i.project.toString())!;
      return { ...toIssue(i), projectName: p.name, projectColor: p.color };
    }),
    projects: projects.filter((p) => rx.test(p.name) || rx.test(p.key)).slice(0, 8).map((p) => toProject(p)),
  };
  res.json(body);
});

// ---------- Analytics ----------
const WEEKS = 8;

function startOfWeek(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - x.getUTCDay()); // Sunday, matches $dateTrunc default
  return x;
}

insightsRouter.get('/analytics', async (req, res) => {
  const me = uid(req);
  const { projectId } = parse(z.object({ projectId: objectId.optional() }), req.query);
  const projectIds = await scopeProjects(me, projectId);
  const now = new Date();
  const since = startOfWeek(new Date(now.getTime() - (WEEKS - 1) * 7 * 864e5));
  const weekAgo = new Date(now.getTime() - 7 * 864e5);

  const [facet] = await IssueModel.aggregate([
    { $match: { project: { $in: projectIds } } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              completed: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
              overdue: {
                $sum: {
                  $cond: [{ $and: [{ $ne: ['$status', 'done'] }, { $ne: ['$dueDate', null] }, { $lt: ['$dueDate', now] }] }, 1, 0],
                },
              },
              completedThisWeek: { $sum: { $cond: [{ $gte: ['$completedAt', weekAgo] }, 1, 0] } },
            },
          },
        ],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byPriority: [{ $match: { status: { $ne: 'done' } } }, { $group: { _id: '$priority', count: { $sum: 1 } } }],
        created: [
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: { $dateTrunc: { date: '$createdAt', unit: 'week' } }, n: { $sum: 1 } } },
        ],
        completed: [
          { $match: { completedAt: { $gte: since } } },
          { $group: { _id: { $dateTrunc: { date: '$completedAt', unit: 'week' } }, n: { $sum: 1 } } },
        ],
        workload: [
          { $unwind: '$assignees' },
          {
            $group: {
              _id: '$assignees',
              open: { $sum: { $cond: [{ $ne: ['$status', 'done'] }, 1, 0] } },
              completed: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
            },
          },
          { $sort: { open: -1 } },
          { $limit: 10 },
        ],
      },
    },
  ]);

  const t = facet.totals[0] ?? { total: 0, completed: 0, overdue: 0, completedThisWeek: 0 };
  const count = (rows: { _id: string; count: number }[], key: string) => rows.find((r) => r._id === key)?.count ?? 0;
  const weekly = (rows: { _id: Date; n: number }[], week: Date) =>
    rows.find((r) => new Date(r._id).getTime() === week.getTime())?.n ?? 0;

  const users = await UserModel.find(
    { _id: { $in: facet.workload.map((w: { _id: Types.ObjectId }) => w._id) } },
    PUBLIC_USER_FIELDS,
  ).lean();
  const userById = new Map(users.map((u) => [u._id.toString(), u]));

  const body: AnalyticsDTO = {
    totals: {
      total: t.total,
      open: t.total - t.completed,
      completed: t.completed,
      overdue: t.overdue,
      completedThisWeek: t.completedThisWeek,
    },
    byStatus: ISSUE_STATUSES.map((status) => ({ status, count: count(facet.byStatus, status) })),
    byPriority: ISSUE_PRIORITIES.map((priority) => ({ priority, count: count(facet.byPriority, priority) })),
    throughput: Array.from({ length: WEEKS }, (_, i) => {
      const week = new Date(since.getTime() + i * 7 * 864e5);
      return { week: week.toISOString(), created: weekly(facet.created, week), completed: weekly(facet.completed, week) };
    }),
    workload: facet.workload
      .filter((w: { _id: Types.ObjectId }) => userById.has(w._id.toString()))
      .map((w: { _id: Types.ObjectId; open: number; completed: number }) => ({
        user: toUser(userById.get(w._id.toString())),
        open: w.open,
        completed: w.completed,
      })),
  };
  res.json(body);
});

// ---------- Calendar ----------
insightsRouter.get('/calendar', async (req, res) => {
  const me = uid(req);
  const q = parse(calendarQuerySchema, req.query);
  if (q.to.getTime() - q.from.getTime() > 120 * 864e5) throw badRequest('Range too large (max 120 days)');
  const projectIds = await scopeProjects(me, q.projectId);
  const [issues, projects] = await Promise.all([
    IssueModel.find({ project: { $in: projectIds }, dueDate: { $gte: q.from, $lte: q.to } })
      .sort({ dueDate: 1, priorityRank: -1 })
      .limit(1000)
      .populate(ISSUE_POPULATE)
      .lean(),
    ProjectModel.find({
      _id: { $in: projectIds },
      $or: [{ startDate: { $lte: q.to }, targetDate: { $gte: q.from } }, { targetDate: { $gte: q.from, $lte: q.to } }],
    }).lean(),
  ]);
  res.json({ issues: issues.map(toIssue), projects: projects.map((p) => toProject(p)) });
});
