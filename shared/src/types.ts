import type { IssuePriority, IssueStatus, TeamRole } from './enums';

/** Shapes returned by the API (JSON-serialised, so dates are ISO strings). */

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  title?: string;
}

export interface TeamMemberDTO {
  user: UserDTO;
  role: TeamRole;
  joinedAt: string;
}

export interface TeamDTO {
  id: string;
  name: string;
  description: string;
  members: TeamMemberDTO[];
  myRole: TeamRole;
  createdAt: string;
}

export interface LabelDTO {
  id: string;
  name: string;
  color: string;
}

export interface ProjectDTO {
  id: string;
  team: string;
  name: string;
  key: string;
  description: string;
  color: string;
  labels: LabelDTO[];
  startDate: string | null;
  targetDate: string | null;
  issueCount: number;
  createdAt: string;
}

export interface IssueDTO {
  id: string;
  project: string;
  number: number;
  /** e.g. "SPR-42" */
  identifier: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  order: number;
  labels: string[];
  assignees: UserDTO[];
  reporter: UserDTO;
  dueDate: string | null;
  estimate: number | null;
  completedAt: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentDTO {
  id: string;
  issue: string;
  author: UserDTO;
  body: string;
  createdAt: string;
  /** Only present on optimistic client-side comments. */
  pending?: boolean;
}

export type ActivityVerb =
  | 'issue.created'
  | 'issue.updated'
  | 'issue.moved'
  | 'issue.deleted'
  | 'comment.created'
  | 'project.created'
  | 'member.added';

export interface ActivityDTO {
  id: string;
  actor: UserDTO;
  verb: ActivityVerb;
  project: { id: string; name: string; key: string } | null;
  issue: { id: string; identifier: string; title: string } | null;
  changes: { field: string; from: unknown; to: unknown }[];
  createdAt: string;
}

export type NotificationKind = 'assigned' | 'commented' | 'status_changed' | 'added_to_team';

export interface NotificationDTO {
  id: string;
  kind: NotificationKind;
  actor: UserDTO;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface SearchIssueDTO extends IssueDTO {
  projectName: string;
  projectColor: string;
}

export interface SearchResultsDTO {
  issues: SearchIssueDTO[];
  projects: ProjectDTO[];
}

export interface AnalyticsDTO {
  totals: {
    total: number;
    open: number;
    completed: number;
    overdue: number;
    completedThisWeek: number;
  };
  byStatus: { status: IssueStatus; count: number }[];
  byPriority: { priority: IssuePriority; count: number }[];
  throughput: { week: string; created: number; completed: number }[];
  workload: { user: UserDTO; open: number; completed: number }[];
}

export interface ApiErrorBody {
  error: { message: string; code: string; details?: Record<string, string[]> };
}

// ---------- Socket events ----------
export interface ServerToClientEvents {
  'issue:created': (p: { issue: IssueDTO; clientMutationId?: string }) => void;
  'issue:updated': (p: { issue: IssueDTO; clientMutationId?: string }) => void;
  'issue:deleted': (p: { id: string; project: string; clientMutationId?: string }) => void;
  'comment:created': (p: { comment: CommentDTO; clientMutationId?: string }) => void;
  'activity:new': (p: { activity: ActivityDTO }) => void;
  'notification:new': (p: { notification: NotificationDTO }) => void;
  'presence:update': (p: { projectId: string; users: UserDTO[] }) => void;
}

export interface ClientToServerEvents {
  'project:join': (projectId: string) => void;
  'project:leave': (projectId: string) => void;
}
