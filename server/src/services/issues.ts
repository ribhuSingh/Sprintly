import { Types, type FilterQuery } from 'mongoose';
import {
  ORDER_STEP,
  STATUS_LABELS,
  issueListQuerySchema,
  type IssueStatus,
  type createIssueSchema,
} from '@sprintly/shared';
import type { z } from 'zod';
import { IssueModel, PUBLIC_USER_FIELDS, ProjectModel, type Issue, type IssueDoc, type ProjectDoc } from '../models';
import { badRequest, escapeRegex } from '../lib/errors';
import { toIssue } from '../lib/serialize';
import { emitToProject } from '../socket';
import { notify, recordActivity } from './events';

export const ISSUE_POPULATE = [
  { path: 'assignees', select: PUBLIC_USER_FIELDS },
  { path: 'reporter', select: PUBLIC_USER_FIELDS },
];

type ListQuery = z.output<typeof issueListQuerySchema>;

export function buildIssueFilter(query: ListQuery, me: string): FilterQuery<Issue> {
  const filter: FilterQuery<Issue> = {};
  if (query.status?.length) filter.status = { $in: query.status };
  if (query.priority?.length) filter.priority = { $in: query.priority };
  if (query.label?.length) filter.labels = { $in: query.label.map((l) => new Types.ObjectId(l)) };
  if (query.assignee?.length) {
    const ids = query.assignee.filter((a) => a !== 'none').map((a) => new Types.ObjectId(a === 'me' ? me : a));
    const or: FilterQuery<Issue>[] = [];
    if (ids.length) or.push({ assignees: { $in: ids } });
    if (query.assignee.includes('none')) or.push({ assignees: { $size: 0 } });
    filter.$and = [{ $or: or }];
  }
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i');
    (filter.$and ??= []).push({ $or: [{ title: rx }, { identifier: rx }] });
  }
  return filter;
}

export function sortSpec(sort: ListQuery['sort'], dir: ListQuery['dir']): Record<string, 1 | -1> {
  const d = dir === 'asc' ? 1 : -1;
  const field = sort === 'priority' ? 'priorityRank' : sort === 'status' ? 'statusRank' : sort;
  // _id tiebreaker keeps pagination stable when many rows share a sort value.
  return { [field]: d, _id: d };
}

export async function nextOrderInColumn(projectId: Types.ObjectId, status: IssueStatus) {
  const last = await IssueModel.findOne({ project: projectId, status }, { order: 1 }).sort({ order: -1 }).lean();
  return (last?.order ?? 0) + ORDER_STEP;
}

/** Re-space a column's orders evenly. Rarely needed; guards against float precision exhaustion. */
export async function rebalanceColumn(projectId: Types.ObjectId, status: IssueStatus) {
  const issues = await IssueModel.find({ project: projectId, status }, { _id: 1 }).sort({ order: 1 }).lean();
  await IssueModel.bulkWrite(
    issues.map((i, idx) => ({ updateOne: { filter: { _id: i._id }, update: { order: (idx + 1) * ORDER_STEP } } })),
  );
}

export async function assertValidRefs(
  project: ProjectDoc,
  memberIds: string[],
  body: { labels?: string[]; assignees?: string[] },
) {
  const labelIds = new Set(project.labels.map((l) => l._id.toString()));
  if (body.labels?.some((l) => !labelIds.has(l))) throw badRequest('Unknown label for this project');
  const members = new Set(memberIds);
  if (body.assignees?.some((a) => !members.has(a))) throw badRequest('Assignees must be members of the team');
}

export async function createIssue(
  project: ProjectDoc,
  me: string,
  body: z.output<typeof createIssueSchema>,
) {
  // Atomic counter: concurrent creates can never get the same issue number.
  const counter = await ProjectModel.findByIdAndUpdate(project._id, { $inc: { issueCounter: 1 } }, { new: true, projection: { issueCounter: 1 } });
  const number = counter!.issueCounter;
  const { clientMutationId, ...data } = body;
  const issue = await IssueModel.create({
    ...data,
    project: project._id,
    number,
    identifier: `${project.key}-${number}`,
    reporter: me,
    order: await nextOrderInColumn(project._id, data.status),
  });
  await issue.populate(ISSUE_POPULATE);
  const dto = toIssue(issue);
  emitToProject(project.id, 'issue:created', { issue: dto, clientMutationId });
  void recordActivity({ actor: me, verb: 'issue.created', project, issue });
  void notify(data.assignees, me, 'assigned', `assigned you to ${dto.identifier}: ${dto.title}`, issueLink(project.id, dto.id));
  return dto;
}

export const issueLink = (projectId: string, issueId: string) => `/projects/${projectId}/issues/${issueId}`;

const TRACKED_FIELDS = ['title', 'description', 'status', 'priority', 'labels', 'assignees', 'dueDate', 'estimate'] as const;

const normalise = (v: unknown): unknown => {
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map((x) => (x?._id ?? x).toString()).sort();
  if (v && typeof v === 'object' && '_id' in v) return (v as { _id: Types.ObjectId })._id.toString();
  return v ?? null;
};

/** Snapshot of the tracked fields, used to diff before/after a mutation for the activity log. */
export const snapshot = (issue: IssueDoc) =>
  Object.fromEntries(TRACKED_FIELDS.map((f) => [f, normalise(issue.get(f))])) as Record<string, unknown>;

export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  return TRACKED_FIELDS.filter((f) => JSON.stringify(before[f]) !== JSON.stringify(after[f])).map((field) => ({
    field,
    // Descriptions can be long: record that it changed, not the full text.
    from: field === 'description' ? null : before[field],
    to: field === 'description' ? null : after[field],
  }));
}

/** After an issue mutation: populate, broadcast, log activity and notify watchers. */
export async function afterIssueChange(
  project: ProjectDoc,
  issue: IssueDoc,
  me: string,
  before: Record<string, unknown>,
  clientMutationId?: string,
  verb: 'issue.updated' | 'issue.moved' = 'issue.updated',
) {
  await issue.populate(ISSUE_POPULATE);
  const dto = toIssue(issue);
  const changes = diff(before, snapshot(issue));
  emitToProject(project.id, 'issue:updated', { issue: dto, clientMutationId });
  if (changes.length === 0) return dto;

  // A pure reorder inside a column isn't interesting to the feed.
  void recordActivity({ actor: me, verb, project, issue, changes });

  const link = issueLink(project.id, dto.id);
  const prevAssignees = new Set(before.assignees as string[]);
  const added = dto.assignees.map((a) => a.id).filter((a) => !prevAssignees.has(a));
  if (added.length) void notify(added, me, 'assigned', `assigned you to ${dto.identifier}: ${dto.title}`, link);

  const statusChange = changes.find((c) => c.field === 'status');
  if (statusChange) {
    const watchers = [...dto.assignees.map((a) => a.id), dto.reporter.id];
    void notify(
      watchers,
      me,
      'status_changed',
      `moved ${dto.identifier} to ${STATUS_LABELS[dto.status]}`,
      link,
    );
  }
  return dto;
}
