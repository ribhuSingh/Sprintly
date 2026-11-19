/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ActivityDTO,
  CommentDTO,
  IssueDTO,
  NotificationDTO,
  ProjectDTO,
  TeamDTO,
  TeamRole,
  UserDTO,
} from '@sprintly/shared';

/**
 * Mapping from Mongo documents (hydrated or lean, with refs populated) to API DTOs.
 * Centralised so every endpoint and every socket event emits identical shapes.
 */

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);
const id = (v: any): string => (v?._id ?? v).toString();

const DELETED_USER: UserDTO = { id: '000000000000000000000000', name: 'Deleted user', email: '', avatarColor: '#94a3b8' };

export function toUser(u: any): UserDTO {
  if (!u || !u.name) return DELETED_USER;
  return { id: id(u), name: u.name, email: u.email, avatarColor: u.avatarColor, title: u.title ?? '' };
}

export function toTeam(t: any, myRole: TeamRole): TeamDTO {
  return {
    id: id(t),
    name: t.name,
    description: t.description ?? '',
    members: (t.members ?? []).map((m: any) => ({
      user: toUser(m.user),
      role: m.role,
      joinedAt: iso(m.joinedAt)!,
    })),
    myRole,
    createdAt: iso(t.createdAt)!,
  };
}

export function toProject(p: any, issueCount = 0): ProjectDTO {
  return {
    id: id(p),
    team: id(p.team),
    name: p.name,
    key: p.key,
    description: p.description ?? '',
    color: p.color,
    labels: (p.labels ?? []).map((l: any) => ({ id: id(l), name: l.name, color: l.color })),
    startDate: iso(p.startDate),
    targetDate: iso(p.targetDate),
    issueCount,
    createdAt: iso(p.createdAt)!,
  };
}

export function toIssue(i: any): IssueDTO {
  return {
    id: id(i),
    project: id(i.project),
    number: i.number,
    identifier: i.identifier,
    title: i.title,
    description: i.description ?? '',
    status: i.status,
    priority: i.priority,
    order: i.order,
    labels: (i.labels ?? []).map(id),
    assignees: (i.assignees ?? []).map(toUser),
    reporter: toUser(i.reporter),
    dueDate: iso(i.dueDate),
    estimate: i.estimate ?? null,
    completedAt: iso(i.completedAt),
    commentCount: i.commentCount ?? 0,
    createdAt: iso(i.createdAt)!,
    updatedAt: iso(i.updatedAt)!,
  };
}

export function toComment(c: any): CommentDTO {
  return { id: id(c), issue: id(c.issue), author: toUser(c.author), body: c.body, createdAt: iso(c.createdAt)! };
}

export function toActivity(a: any): ActivityDTO {
  const project = a.project && a.project.name ? { id: id(a.project), name: a.project.name, key: a.project.key } : null;
  return {
    id: id(a),
    actor: toUser(a.actor),
    verb: a.verb,
    project,
    issue: a.issue
      ? { id: id(a.issue), identifier: a.issueSnapshot?.identifier ?? '', title: a.issueSnapshot?.title ?? '' }
      : null,
    changes: a.changes ?? [],
    createdAt: iso(a.createdAt)!,
  };
}

export function toNotification(n: any): NotificationDTO {
  return {
    id: id(n),
    kind: n.kind,
    actor: toUser(n.actor),
    message: n.message,
    link: n.link,
    read: n.read,
    createdAt: iso(n.createdAt)!,
  };
}
