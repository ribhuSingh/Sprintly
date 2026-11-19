import request from 'supertest';
import { createApp } from '../src/app';

export const app = createApp();

let n = 0;
/** Registers a fresh user and returns a cookie-carrying supertest agent. */
export async function signUp(name = 'Test User') {
  const agent = request.agent(app);
  const email = `user${++n}-${Date.now()}@example.com`;
  const res = await agent.post('/api/auth/register').send({ name, email, password: 'password123' });
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.user as { id: string; email: string } };
}

export async function setupProject() {
  const owner = await signUp('Owner');
  const team = (await owner.agent.post('/api/teams').send({ name: 'Core' })).body.team;
  const project = (await owner.agent.post('/api/projects').send({ teamId: team.id, name: 'Web', key: 'WEB' })).body
    .project;
  return { owner, team, project };
}
