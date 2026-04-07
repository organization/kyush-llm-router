import { request, type TestAgent, type TestRequest } from './httpClient';

import type { Hono } from 'hono';

export interface AdminTestClient {
  agent: TestAgent;
  csrfToken: string;
  get: (url: string) => TestRequest;
  post: (url: string) => TestRequest;
  put: (url: string) => TestRequest;
  delete: (url: string) => TestRequest;
}

export async function createAdminClient(app: Hono): Promise<AdminTestClient> {
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
