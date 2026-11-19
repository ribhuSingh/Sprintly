import { Router } from 'express';
import {
  createIssueSchema,
  createLabelSchema,
  createProjectSchema,
  issueListQuerySchema,
  updateProjectSchema,
  type Paginated,
  type IssueDTO,
} from '@sprintly/shared';
import {
  ActivityModel,
  CommentModel,
  IssueModel,
  NotificationModel,
  PUBLIC_USER_FIELDS,
  ProjectModel,
  TeamModel,
} from '../models';
import { badRequest, conflict, parse } from '../lib/errors';
import { toIssue, toProject, toUser } from '../lib/serialize';
import { uid } from '../middleware/auth';
import { myTeamIds, projectAccess, teamAccess, teamMemberIds } from '../services/access';
import { recordActivity } from '../services/events';
import { ISSUE_POPULATE, assertValidRefs, buildIssueFilter, createIssue, sortSpec } from '../services/issues';

export const projectsRouter = Router();

async function issueCounts(projectIds: unknown[]) {
  const rows = await IssueModel.aggregate<{ _id: unknown; n: number }>([
    { $match: { project: { $in: projectIds } } },
    { $group: { _id: '$project', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

projectsRouter.get('/', async (req, res) => {
  const teamIds = await myTeamIds(uid(req));
  const projects = await ProjectModel.find({ team: { $in: teamIds } }).sort({ createdAt: 1 }).lean();
  const counts = await issueCounts(projects.map((p) => p._id));
  res.json({ projects: projects.map((p) => toProject(p, counts.get(p._id.toString()) ?? 0)) });
});

projectsRouter.post('/', async (req, res) => {
  const me = uid(req);
  const body = parse(createProjectSchema, req.body);
  await teamAccess(body.teamId, me, 'admin');
  if (await ProjectModel.exists({ team: body.teamId, key: body.key })) {
    throw conflict(`The key ${body.key} is already used in this team`);
  }
  const { teamId, ...rest } = body;
  const project = await ProjectModel.create({
    ...rest,
    team: teamId,
    createdBy: me,
    labels: [
      { name: 'Bug', color: '#ef4444' },
      { name: 'Feature', color: '#6366f1' },
      { name: 'Improvement', color: '#14b8a6' },
    ],
  });
  void recordActivity({ actor: me, verb: 'project.created', project });
  res.status(201).json({ project: toProject(project, 0) });
});

projectsRouter.get('/:id', async (req, res) => {
  const { project, role } = await projectAccess(req.params.id, uid(req));
  const counts = await issueCounts([project._id]);
  res.json({ project: toProject(project, counts.get(project.id) ?? 0), myRole: role });
});

projectsRouter.patch('/:id', async (req, res) => {
  const { project } = await projectAccess(req.params.id, uid(req), 'admin');
  project.set(parse(updateProjectSchema, req.body));
  await project.save();
  const counts = await issueCounts([project._id]);
  res.json({ project: toProject(project, counts.get(project.id) ?? 0) });
});

projectsRouter.delete('/:id', async (req, res) => {
  const { project } = await projectAccess(req.params.id, uid(req), 'admin');
  await Promise.all([
    IssueModel.deleteMany({ project: project._id }),
    CommentModel.deleteMany({ project: project._id }),
    ActivityModel.deleteMany({ project: project._id }),
    NotificationModel.deleteMany({ link: { $regex: `^/projects/${project.id}/` } }),
  ]);
  await project.deleteOne();
  res.status(204).end();
});

projectsRouter.get('/:id/members', async (req, res) => {
  const { project } = await projectAccess(req.params.id, uid(req));
  const team = await TeamModel.findById(project.team).populate({ path: 'members.user', select: PUBLIC_USER_FIELDS }).lean();
  res.json({ members: (team?.members ?? []).map((m) => ({ user: toUser(m.user), role: m.role })) });
});

projectsRouter.post('/:id/labels', async (req, res) => {
  const { project } = await projectAccess(req.params.id, uid(req), 'member');
  const body = parse(createLabelSchema, req.body);
  if (project.labels.some((l) => l.name.toLowerCase() === body.name.toLowerCase())) {
    throw conflict('A label with that name already exists');
  }
  project.labels.push(body);
  await project.save();
  res.status(201).json({ project: toProject(project) });
});

projectsRouter.delete('/:id/labels/:labelId', async (req, res) => {
  const { project } = await projectAccess(req.params.id, uid(req), 'admin');
  project.labels.pull({ _id: req.params.labelId });
  await project.save();
  await IssueModel.updateMany({ project: project._id }, { $pull: { labels: req.params.labelId } });
  res.json({ project: toProject(project) });
});

/** Full board: every issue, ordered for the Kanban columns. */
projectsRouter.get('/:id/board', async (req, res) => {
  const { project } = await projectAccess(req.params.id, uid(req));
  const issues = await IssueModel.find({ project: project._id })
    .sort({ order: 1 })
    .populate(ISSUE_POPULATE)
    .lean();
  res.json({ issues: issues.map(toIssue) });
});

/** Paginated, filterable, sortable list for the data table. */
projectsRouter.get('/:id/issues', async (req, res) => {
  const me = uid(req);
  const { project } = await projectAccess(req.params.id, me);
  const query = parse(issueListQuerySchema, req.query);
  const filter = { ...buildIssueFilter(query, me), project: project._id };
  const [total, issues] = await Promise.all([
    IssueModel.countDocuments(filter),
    IssueModel.find(filter)
      .sort(sortSpec(query.sort, query.dir))
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .populate(ISSUE_POPULATE)
      .lean(),
  ]);
  const body: Paginated<IssueDTO> = {
    items: issues.map(toIssue),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
  res.json(body);
});

projectsRouter.post('/:id/issues', async (req, res) => {
  const me = uid(req);
  const { project } = await projectAccess(req.params.id, me, 'member');
  const body = parse(createIssueSchema, req.body);
  if (body.dueDate && Number.isNaN(body.dueDate.getTime())) throw badRequest('Invalid due date');
  await assertValidRefs(project, await teamMemberIds(project.team), body);
  const issue = await createIssue(project, me, body);
  res.status(201).json({ issue });
});
