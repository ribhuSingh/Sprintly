import { z } from 'zod';
import { ISSUE_PRIORITIES, ISSUE_SORT_FIELDS, ISSUE_STATUSES } from './enums';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a hex colour like #c2410c');

// ---------- Auth ----------
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  title: z.string().trim().max(80).optional().default(''),
  avatarColor: hexColor,
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

// ---------- Teams ----------
export const createTeamSchema = z.object({
  name: z.string().trim().min(2, 'Team name is too short').max(60),
  description: z.string().trim().max(280).optional().default(''),
});
export type CreateTeamInput = z.input<typeof createTeamSchema>;

export const updateTeamSchema = createTeamSchema.partial();

const assignableRole = z.enum(['admin', 'member', 'viewer']);

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  role: assignableRole.default('member'),
});
export type AddMemberInput = z.input<typeof addMemberSchema>;

export const updateMemberSchema = z.object({ role: assignableRole });

// ---------- Projects ----------
export const createProjectSchema = z.object({
  teamId: objectId,
  name: z.string().trim().min(2, 'Project name is too short').max(80),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,5}$/, '2-6 letters/digits, starting with a letter'),
  description: z.string().trim().max(500).optional().default(''),
  color: hexColor.optional().default('#475569'),
  startDate: z.coerce.date().optional().nullable(),
  targetDate: z.coerce.date().optional().nullable(),
});
export type CreateProjectInput = z.input<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.omit({ teamId: true, key: true }).partial();

// ---------- Labels ----------
export const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(30),
  color: hexColor,
});

// ---------- Issues ----------
export const createIssueSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().max(10_000).optional().default(''),
  status: z.enum(ISSUE_STATUSES).default('todo'),
  priority: z.enum(ISSUE_PRIORITIES).default('none'),
  labels: z.array(objectId).max(10).default([]),
  assignees: z.array(objectId).max(10).default([]),
  dueDate: z.coerce.date().nullable().optional(),
  estimate: z.number().int().min(0).max(100).nullable().optional(),
  clientMutationId: z.string().max(64).optional(),
});
export type CreateIssueInput = z.input<typeof createIssueSchema>;

export const updateIssueSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200).optional(),
  description: z.string().max(10_000).optional(),
  status: z.enum(ISSUE_STATUSES).optional(),
  priority: z.enum(ISSUE_PRIORITIES).optional(),
  labels: z.array(objectId).max(10).optional(),
  assignees: z.array(objectId).max(10).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  estimate: z.number().int().min(0).max(100).nullable().optional(),
  clientMutationId: z.string().max(64).optional(),
});
export type UpdateIssueInput = z.input<typeof updateIssueSchema>;

export const moveIssueSchema = z.object({
  status: z.enum(ISSUE_STATUSES),
  /** Neighbouring cards in the destination column after the drop (null = column edge). */
  beforeId: objectId.nullable(),
  afterId: objectId.nullable(),
  clientMutationId: z.string().max(64).optional(),
});
export type MoveIssueInput = z.infer<typeof moveIssueSchema>;

export const bulkUpdateIssuesSchema = z.object({
  ids: z.array(objectId).min(1).max(200),
  patch: z
    .object({
      status: z.enum(ISSUE_STATUSES).optional(),
      priority: z.enum(ISSUE_PRIORITIES).optional(),
    })
    .refine((p) => Object.keys(p).length > 0, 'Nothing to update'),
});
export type BulkUpdateIssuesInput = z.infer<typeof bulkUpdateIssuesSchema>;

/** Accepts `a,b,c` or repeated query params and turns them into an array. */
const csv = <T extends z.ZodTypeAny>(item: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) =>
      v === undefined ? undefined : (Array.isArray(v) ? v : v.split(',')).filter(Boolean),
    )
    .pipe(z.array(item).optional());

export const issueListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: csv(z.enum(ISSUE_STATUSES)),
  priority: csv(z.enum(ISSUE_PRIORITIES)),
  assignee: csv(z.union([objectId, z.literal('none'), z.literal('me')])),
  label: csv(objectId),
  sort: z.enum(ISSUE_SORT_FIELDS).default('createdAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(25),
});
export type IssueListQuery = z.input<typeof issueListQuerySchema>;

// ---------- Comments ----------
export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(5000),
  clientMutationId: z.string().max(64).optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// ---------- Search / calendar / activity ----------
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const calendarQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  projectId: objectId.optional(),
});

export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  projectId: objectId.optional(),
});
