import request from 'supertest';

export async function createAdminClient(app: Parameters<typeof request.agent>[0]) {
  const agent = request.agent(app);

  await agent
    .post('/admin/auth/login')
    .send({ username: 'admin', password: 'password' })
    .expect(200);

  const sessionResponse = await agent.get('/admin/auth/session').expect(200);
  const csrfToken = sessionResponse.body.csrfToken as string;

  return {
    agent,
    csrfToken,
    get: (url: string) => agent.get(url),
    post: (url: string) => agent.post(url).set('X-CSRF-Token', csrfToken),
    put: (url: string) => agent.put(url).set('X-CSRF-Token', csrfToken),
    delete: (url: string) => agent.delete(url).set('X-CSRF-Token', csrfToken),
  };
}
