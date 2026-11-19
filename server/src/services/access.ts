import { Types } from 'mongoose';
import { hasRole, type TeamRole } from '@sprintly/shared';
import { IssueModel, ProjectModel, TeamModel, roleIn } from '../models';
import { forbidden, notFound } from '../lib/errors';

/**
 * Authorisation lives here: every project/issue endpoint resolves access through these
 * helpers, so RBAC is enforced in one place. Non-members get 404 (not 403) to avoid
 * leaking whether a resource exists.
 */

export async function teamAccess(teamId: string, userId: string, required: TeamRole = 'viewer') {
  if (!Types.ObjectId.isValid(teamId)) throw notFound('Team');
  const team = await TeamModel.findById(teamId);
  const role = team ? roleIn(team, userId) : undefined;
  if (!team || !role) throw notFound('Team');
  if (!hasRole(role, required)) throw forbidden();
  return { team, role };
}

export async function projectAccess(projectId: string, userId: string, required: TeamRole = 'viewer') {
  if (!Types.ObjectId.isValid(projectId)) throw notFound('Project');
  const project = await ProjectModel.findById(projectId);
  if (!project) throw notFound('Project');
  const team = await TeamModel.findById(project.team, { members: 1 }).lean();
  const role = team ? roleIn(team, userId) : undefined;
  if (!role) throw notFound('Project');
  if (!hasRole(role, required)) throw forbidden();
  return { project, role };
}

export async function issueAccess(issueId: string, userId: string, required: TeamRole = 'viewer') {
  if (!Types.ObjectId.isValid(issueId)) throw notFound('Issue');
  const issue = await IssueModel.findById(issueId);
  if (!issue) throw notFound('Issue');
  const { project, role } = await projectAccess(issue.project.toString(), userId, required);
  return { issue, project, role };
}

export async function myTeamIds(userId: string) {
  const teams = await TeamModel.find({ 'members.user': userId }, { _id: 1 }).lean();
  return teams.map((t) => t._id);
}

export async function myProjectIds(userId: string) {
  const teamIds = await myTeamIds(userId);
  const projects = await ProjectModel.find({ team: { $in: teamIds } }, { _id: 1 }).lean();
  return projects.map((p) => p._id);
}

export async function teamMemberIds(teamId: unknown) {
  const team = await TeamModel.findById(teamId, { members: 1 }).lean();
  return (team?.members ?? []).map((m) => m.user.toString());
}
