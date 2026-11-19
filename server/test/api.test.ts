import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, setupProject, signUp } from './helpers';

describe('auth', () => {
  it('registers, reads the session, and logs out', async () => {
    const { agent, user } = await signUp('Ada');
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(user.email);

    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('rejects bad credentials with a generic message', async () => {
    const { user } = await signUp();
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('returns field-level validation errors', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'nope', password: 'x' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('requires auth on API routes', async () => {
    await request(app).get('/api/projects').expect(401);
  });
});

describe('issues', () => {
  it('allocates sequential identifiers', async () => {
    const { owner, project } = await setupProject();
    const a = await owner.agent.post(`/api/projects/${project.id}/issues`).send({ title: 'First' });
    const b = await owner.agent.post(`/api/projects/${project.id}/issues`).send({ title: 'Second' });
    expect(a.body.issue.identifier).toBe('WEB-1');
    expect(b.body.issue.identifier).toBe('WEB-2');
  });

  it('moves a card between two others using fractional ordering', async () => {
    const { owner, project } = await setupProject();
    const create = (title: string, status = 'todo') =>
      owner.agent.post(`/api/projects/${project.id}/issues`).send({ title, status }).then((r) => r.body.issue);
    const a = await create('A');
    const b = await create('B');
    const c = await create('C', 'in_progress');

    const moved = await owner.agent
      .post(`/api/issues/${c.id}/move`)
      .send({ status: 'todo', beforeId: a.id, afterId: b.id });
    expect(moved.status).toBe(200);
    expect(moved.body.issue.status).toBe('todo');
    expect(moved.body.issue.order).toBeGreaterThan(a.order);
    expect(moved.body.issue.order).toBeLessThan(b.order);

    const board = await owner.agent.get(`/api/projects/${project.id}/board`);
    const todo = board.body.issues.filter((i: { status: string }) => i.status === 'todo').map((i: { title: string }) => i.title);
    expect(todo).toEqual(['A', 'C', 'B']);
  });

  it('rejects a move against stale neighbours', async () => {
    const { owner, project } = await setupProject();
    const a = (await owner.agent.post(`/api/projects/${project.id}/issues`).send({ title: 'A', status: 'done' })).body.issue;
    const b = (await owner.agent.post(`/api/projects/${project.id}/issues`).send({ title: 'B' })).body.issue;
    // `a` is in "done", so it can't be a neighbour in "todo".
    const res = await owner.agent.post(`/api/issues/${b.id}/move`).send({ status: 'todo', beforeId: a.id, afterId: null });
    expect(res.status).toBe(400);
  });

  it('filters, sorts and paginates the list', async () => {
    const { owner, project } = await setupProject();
    for (const [title, priority] of [['low one', 'low'], ['urgent one', 'urgent'], ['high one', 'high']] as const) {
      await owner.agent.post(`/api/projects/${project.id}/issues`).send({ title, priority });
    }
    const res = await owner.agent.get(`/api/projects/${project.id}/issues?sort=priority&dir=desc&pageSize=2`);
    expect(res.body.total).toBe(3);
    expect(res.body.pageCount).toBe(2);
    expect(res.body.items.map((i: { priority: string }) => i.priority)).toEqual(['urgent', 'high']);

    const filtered = await owner.agent.get(`/api/projects/${project.id}/issues?priority=low,high`);
    expect(filtered.body.total).toBe(2);
  });

  it('records activity and sets completedAt when done', async () => {
    const { owner, project } = await setupProject();
    const issue = (await owner.agent.post(`/api/projects/${project.id}/issues`).send({ title: 'Ship it' })).body.issue;
    const res = await owner.agent.patch(`/api/issues/${issue.id}`).send({ status: 'done' });
    expect(res.body.issue.completedAt).not.toBeNull();
    // Activity is written asynchronously, give it a tick.
    await new Promise((r) => setTimeout(r, 50));
    const activity = await owner.agent.get(`/api/issues/${issue.id}/activity`);
    expect(activity.body.activity.some((a: { verb: string }) => a.verb === 'issue.updated')).toBe(true);
  });
});

describe('RBAC', () => {
  it('hides projects from non-members (404, not 403)', async () => {
    const { project } = await setupProject();
    const stranger = await signUp('Stranger');
    await stranger.agent.get(`/api/projects/${project.id}`).expect(404);
  });

  it('lets viewers read but not write', async () => {
    const { owner, team, project } = await setupProject();
    const viewer = await signUp('Viewer');
    await owner.agent.post(`/api/teams/${team.id}/members`).send({ email: viewer.user.email, role: 'viewer' }).expect(201);

    await viewer.agent.get(`/api/projects/${project.id}/board`).expect(200);
    await viewer.agent.post(`/api/projects/${project.id}/issues`).send({ title: 'nope' }).expect(403);
  });

  it('only lets admins create projects', async () => {
    const { owner, team } = await setupProject();
    const member = await signUp('Member');
    await owner.agent.post(`/api/teams/${team.id}/members`).send({ email: member.user.email }).expect(201);
    await member.agent.post('/api/projects').send({ teamId: team.id, name: 'Nope', key: 'NO' }).expect(403);
  });

  it('notifies assignees', async () => {
    const { owner, team, project } = await setupProject();
    const member = await signUp('Member');
    await owner.agent.post(`/api/teams/${team.id}/members`).send({ email: member.user.email }).expect(201);
    await owner.agent
      .post(`/api/projects/${project.id}/issues`)
      .send({ title: 'For you', assignees: [member.user.id] })
      .expect(201);
    await new Promise((r) => setTimeout(r, 50));
    const res = await member.agent.get('/api/notifications');
    expect(res.body.notifications.some((n: { kind: string }) => n.kind === 'assigned')).toBe(true);
  });
});
