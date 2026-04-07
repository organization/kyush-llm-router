import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';

import { request } from '../utils/httpClient';
import { createTestApp } from '../utils/testApp';
import { createMockBackend } from '../utils/mockBackend';
import { initDb } from '../../src/config/database';
import { createAdminClient } from '../utils/adminClient';

/**
 * These tests verify that the router correctly proxies SSE streaming responses
 * from backends when the client sends `stream: true`.
 *
 * Current expectation: these tests FAIL because RouterService.forwardRequest()
 * calls response.json() which buffers the entire response and breaks SSE.
 */
describe('Streaming Response Proxying', () => {
  let app: ReturnType<typeof createTestApp>;
  let admin: Awaited<ReturnType<typeof createAdminClient>>;
  let mockServer: any;

  const sampleStreamChunks = [
    JSON.stringify({
      id: 'chatcmpl-stream-1',
      object: 'chat.completion.chunk',
      model: 'mock-model',
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: 'Hello' },
          finish_reason: null,
        },
      ],
    }),
    JSON.stringify({
      id: 'chatcmpl-stream-1',
      object: 'chat.completion.chunk',
      model: 'mock-model',
      choices: [
        { index: 0, delta: { content: ' world' }, finish_reason: null },
      ],
    }),
    JSON.stringify({
      id: 'chatcmpl-stream-1',
      object: 'chat.completion.chunk',
      model: 'mock-model',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    }),
  ];

  beforeAll(() => {
    initDb();
    app = createTestApp();
  });

  beforeAll(async () => {
    admin = await createAdminClient(app);

    // Deactivate all existing backends
    const allBackendsResponse = await admin.get('/admin/backends');
    for (const backend of allBackendsResponse.body) {
      if (backend.is_active) {
        await admin
          .put(`/admin/backends/${backend.id}`)
          .send({ is_active: false });
      }
    }
  });

  afterEach(async () => {
    if (mockServer) {
      await new Promise<void>((resolve) => mockServer.close(resolve));
      mockServer = undefined;
    }
  });

  afterAll(async () => {
    // Re-activate all backends
    const allBackendsResponse = await admin.get('/admin/backends');
    for (const backend of allBackendsResponse.body) {
      if (!backend.is_active) {
        await admin
          .put(`/admin/backends/${backend.id}`)
          .send({ is_active: true });
      }
    }
  });

  async function setupUserAndBackend(mockPort: number) {
    // Deactivate all existing backends to ensure only our mock backend is selected
    const allBackendsResponse = await admin.get('/admin/backends');
    for (const backend of allBackendsResponse.body) {
      if (backend.is_active) {
        await admin
          .put(`/admin/backends/${backend.id}`)
          .send({ is_active: false });
      }
    }

    const userResponse = await admin
      .post('/admin/users')
      .send({ name: `Stream Test User ${Date.now()}` });
    const userApiKey = userResponse.body.api_key;
    const userId = userResponse.body.id;

    const backendResponse = await admin.post('/admin/backends').send({
      name: `Stream Backend ${Date.now()}`,
      base_url: `http://localhost:${mockPort}`,
    });
    const backendId = backendResponse.body.id;

    await admin
      .post('/admin/permissions')
      .send({ user_id: userId, backend_id: backendId });

    return { userApiKey, userId, backendId };
  }

  it('should return Content-Type text/event-stream for stream requests', async () => {
    const { server, port } = createMockBackend({
      streamChunks: sampleStreamChunks,
      modelsResponse: [{ id: 'mock-model', object: 'model' }],
    });
    mockServer = server;

    const { userApiKey } = await setupUserAndBackend(port);

    const response = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${userApiKey}`)
      .send({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      });

    // The router should forward the SSE content-type from the backend
    expect(response.headers['content-type']).toMatch(/text\/event-stream/);
  });

  it('should forward all SSE chunks from backend to client', async () => {
    const { server, port } = createMockBackend({
      streamChunks: sampleStreamChunks,
      modelsResponse: [{ id: 'mock-model', object: 'model' }],
    });
    mockServer = server;

    const { userApiKey } = await setupUserAndBackend(port);

    const response = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${userApiKey}`)
      .send({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      });

    const body = response.text;

    // Should contain all three data chunks plus [DONE]
    const dataLines = body
      .split('\n')
      .filter((line: string) => line.startsWith('data: '));
    expect(dataLines.length).toBe(4); // 3 chunks + [DONE]

    // Verify first chunk
    const firstChunk = JSON.parse(dataLines[0].replace('data: ', ''));
    expect(firstChunk.choices[0].delta.content).toBe('Hello');

    // Verify second chunk
    const secondChunk = JSON.parse(dataLines[1].replace('data: ', ''));
    expect(secondChunk.choices[0].delta.content).toBe(' world');

    // Verify last data line is [DONE]
    expect(dataLines[3]).toBe('data: [DONE]');
  });

  it('should not buffer the stream into a JSON response', async () => {
    const { server, port } = createMockBackend({
      streamChunks: sampleStreamChunks,
      modelsResponse: [{ id: 'mock-model', object: 'model' }],
    });
    mockServer = server;

    const { userApiKey } = await setupUserAndBackend(port);

    const response = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${userApiKey}`)
      .send({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      });

    // The response should NOT be a JSON object (which is what happens when
    // RouterService buffers with response.json())
    expect(response.headers['content-type']).not.toMatch(/application\/json/);

    // The response text should contain SSE data lines, not be empty
    expect(response.text).toContain('data: ');
  });

  it('should still return JSON for non-stream requests', async () => {
    const { server, port } = createMockBackend({
      streamChunks: sampleStreamChunks,
      chatResponse: {
        id: 'non-stream-1',
        model: 'mock-model',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
      modelsResponse: [{ id: 'mock-model', object: 'model' }],
    });
    mockServer = server;

    const { userApiKey } = await setupUserAndBackend(port);

    const response = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${userApiKey}`)
      .send({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Hello' }],
        // stream is not set (or false)
      });

    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body.id).toBe('non-stream-1');
    expect(response.body.choices).toHaveLength(1);
  });

  it('should pass stream flag through to the backend', async () => {
    let receivedBody: any;
    const { server, port } = createMockBackend({
      streamChunks: sampleStreamChunks,
      modelsResponse: [{ id: 'mock-model', object: 'model' }],
      onRequest: (req) => {
        receivedBody = req.body;
      },
    });
    mockServer = server;

    const { userApiKey } = await setupUserAndBackend(port);

    const response = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${userApiKey}`)
      .send({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      });

    // Ensure the request actually reached the mock backend (not a 502)
    expect(response.status).toBe(200);
    expect(receivedBody).toBeDefined();
    expect(receivedBody.stream).toBe(true);
  });
});
