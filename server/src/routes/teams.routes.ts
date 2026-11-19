import { Router } from 'express';
import { addMemberSchema, createTeamSchema, updateMemberSchema, updateTeamSchema } from '@sprintly/shared';
import { PUBLIC_USER_FIELDS, ProjectModel, TeamModel, UserModel, roleIn } from '../models';
import { AppError, badRequest, conflict, forbidden, notFound, parse } from '../lib/errors';
import { toTeam } from '../lib/serialize';
import { uid } from '../middleware/auth';
import { teamAccess } from '../services/access';
import { notify } from '../services/events';

export const teamsRouter = Router();

const populateMembers = { path: 'members.user', select: PUBLIC_USER_FIELDS } as const;

teamsRouter.get('/', async (req, res) => {
  const me = uid(req);
  const teams = await TeamModel.find({ 'members.user': me }).populate(populateMembers).sort({ createdAt: 1 }).lean();
  res.json({ teams: teams.map((t) => toTeam(t, roleIn(t, me)!)) });
});

teamsRouter.post('/', async (req, res) => {
  const me = uid(req);
  const body = parse(createTeamSchema, req.body);
  const team = await TeamModel.create({ ...body, members: [{ user: me, role: 'owner' }] });
  await team.populate(populateMembers);
  res.status(201).json({ team: toTeam(team, 'owner') });
});

teamsRouter.patch('/:id', async (req, res) => {
  const me = uid(req);
  const { team, role } = await teamAccess(req.params.id, me, 'admin');
  team.set(parse(updateTeamSchema, req.body));
  await team.save();
  await team.populate(populateMembers);
  res.json({ team: toTeam(team, role) });
});

teamsRouter.delete('/:id', async (req, res) => {
  const { team } = await teamAccess(req.params.id, uid(req), 'owner');
  if (await ProjectModel.exists({ team: team._id })) {
    throw badRequest('Delete or move this team’s projects first');
  }
  await team.deleteOne();
  res.status(204).end();
});

teamsRouter.post('/:id/members', async (req, res) => {
  const me = uid(req);
  const { team, role } = await teamAccess(req.params.id, me, 'admin');
  const body = parse(addMemberSchema, req.body);
  const user = await UserModel.findOne({ email: body.email });
  if (!user) throw new AppError(404, 'No Sprintly account uses that email', 'not_found');
  if (roleIn(team, user.id)) throw conflict('That person is already on the team');
  team.members.push({ user: user._id, role: body.role, joinedAt: new Date() });
  await team.save();
  await team.populate(populateMembers);
  void notify([user.id], me, 'added_to_team', `added you to ${team.name}`, `/settings/teams/${team.id}`);
  res.status(201).json({ team: toTeam(team, role) });
});

teamsRouter.patch('/:id/members/:userId', async (req, res) => {
  const me = uid(req);
  const { team, role } = await teamAccess(req.params.id, me, 'admin');
  const body = parse(updateMemberSchema, req.body);
  const member = team.members.find((m) => m.user.toString() === req.params.userId);
  if (!member) throw notFound('Member');
  if (member.role === 'owner') throw forbidden('The owner’s role cannot be changed');
  if (role !== 'owner' && member.role === 'admin') throw forbidden('Only the owner can change an admin’s role');
  member.role = body.role;
  await team.save();
  await team.populate(populateMembers);
  res.json({ team: toTeam(team, role) });
});

teamsRouter.delete('/:id/members/:userId', async (req, res) => {
  const me = uid(req);
  const leavingSelf = req.params.userId === me;
  const { team, role } = await teamAccess(req.params.id, me, leavingSelf ? 'viewer' : 'admin');
  const member = team.members.find((m) => m.user.toString() === req.params.userId);
  if (!member) throw notFound('Member');
  if (member.role === 'owner') throw forbidden('The owner cannot be removed');
  if (!leavingSelf && role !== 'owner' && member.role === 'admin') throw forbidden('Only the owner can remove an admin');
  team.members.pull({ user: member.user });
  await team.save();
  res.status(204).end();
});
