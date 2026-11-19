/**
 * Query key factory. Keys are hierarchical so related data can be invalidated together,
 * e.g. invalidating `qk.projectIssues(id)` refreshes every page/filter of that table.
 */
export const qk = {
  me: ['me'] as const,
  teams: ['teams'] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  members: (id: string) => ['projects', id, 'members'] as const,
  board: (id: string) => ['projects', id, 'board'] as const,
  projectIssues: (id: string) => ['projects', id, 'issues'] as const,
  issueList: (id: string, params: object) => ['projects', id, 'issues', params] as const,
  issue: (id: string) => ['issue', id] as const,
  comments: (id: string) => ['issue', id, 'comments'] as const,
  issueActivity: (id: string) => ['issue', id, 'activity'] as const,
  activity: (projectId?: string) => ['activity', projectId ?? 'all'] as const,
  notifications: ['notifications'] as const,
  analytics: (projectId?: string) => ['analytics', projectId ?? 'all'] as const,
  calendar: (from: string, to: string, projectId?: string) => ['calendar', from, to, projectId ?? 'all'] as const,
  search: (q: string) => ['search', q] as const,
};
