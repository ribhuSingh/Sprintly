export const ISSUE_STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const STATUS_LABELS: Record<IssueStatus, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

export const ISSUE_PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
  none: 'No priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const PRIORITY_RANK: Record<IssuePriority, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

export const TEAM_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

/** Higher number = more permissions. */
export const ROLE_RANK: Record<TeamRole, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

export const hasRole = (actual: TeamRole | undefined, required: TeamRole) =>
  actual !== undefined && ROLE_RANK[actual] >= ROLE_RANK[required];

export const ISSUE_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'dueDate',
  'priority',
  'title',
  'number',
  'status',
] as const;
export type IssueSortField = (typeof ISSUE_SORT_FIELDS)[number];
