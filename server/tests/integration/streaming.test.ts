import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import http from 'http';
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
      choices: [{ index: 0, delta: { role: 'assistant', content: 'Hello' }, finish_reason: null }],
    }),
    JSON.stringify({
      id: 'chatcmpl-stream-1',
      object: 'chat.completion.chunk',
      model: 'mock-model',
      choices: [{ index: 0, delta: { content: ' world' }, finish_reason: null }],
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
        await admin.put(`/admin/backends/${backend.id}`).send({ is_active: false });
      }
    }
  });

  afterEach(async () => {
    delete process.env.DETAIL_STREAM_LOG_MODE;

    if (mockServer) {
      await new Promise<void>(resolve => mockServer.close(resolve));
      mockServer = undefined;
    }
  });

  afterAll(async () => {
    // Re-activate all backends
    const allBackendsResponse = await admin.get('/admin/backends');
    for (const backend of allBackendsResponse.body) {
      if (!backend.is_active) {
        await admin.put(`/admin/backends/${backend.id}`).send({ is_active: true });
      }
    }
  });

  async function setupUserAndBackend(mockPort: number, options: { detailLogging?: boolean; copyReasoning?: boolean } = {}) {
    // Deactivate all existing backends to ensure only our mock backend is selected
    const allBackendsResponse = await admin.get('/admin/backends');
    for (const backend of allBackendsResponse.body) {
      if (backend.is_active) {
        await admin.put(`/admin/backends/${backend.id}`).send({ is_active: false });
      }
    }

    const userResponse = await admin.post('/admin/users').send({
      name: `Stream Test User ${Date.now()}`,
      detail_logging: options.detailLogging,
      copy_reasoning_to_reasoning_content: options.copyReasoning,
    });
    const userApiKey = userResponse.body.api_key;
    const userId = userResponse.body.id;

    const backendResponse = await admin.post('/admin/backends').send({
      name: `Stream Backend ${Date.now()}`,
      base_url: `http://localhost:${mockPort}`,
    });
    const backendId = backendResponse.body.id;

    await admin.post('/admin/permissions').send({ user_id: userId, backend_id: backendId });

    return { userApiKey, userId, backendId };
  }

  async function createUserForBackend(backendId: number, options: { copyReasoning?: boolean } = {}) {
    const userResponse = await admin.post('/admin/users').send({
      name: `Stream Compat User ${Date.now()} ${Math.random()}`,
      copy_reasoning_to_reasoning_content: options.copyReasoning,
    });
    await admin.post('/admin/permissions').send({ user_id: userResponse.body.id, backend_id: backendId });
    return { userApiKey: userResponse.body.api_key as string, userId: userResponse.body.id as number };
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
    const dataLines = body.split('\n').filter((line: string) => line.startsWith('data: '));
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
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
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

  it('should store compact stream logs by default when detail logging is enabled', async () => {
    process.env.DETAIL_STREAM_LOG_MODE = 'compact';
    const compactStreamChunks = [
      JSON.stringify({
        id: 'chatcmpl-compact-1',
        object: 'chat.completion.chunk',
        created: 1776916142,
        model: 'mock-model',
        choices: [{ index: 0, delta: { role: 'assistant', reasoning: 'Think' }, finish_reason: null }],
      }),
      JSON.stringify({
        id: 'chatcmpl-compact-1',
        object: 'chat.completion.chunk',
        created: 1776916142,
        model: 'mock-model',
        choices: [{ index: 0, delta: { reasoning: ' first. ' }, finish_reason: null }],
      }),
      JSON.stringify({
        id: 'chatcmpl-compact-1',
        object: 'chat.completion.chunk',
        created: 1776916142,
        model: 'mock-model',
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              id: 'tool-1',
              type: 'function',
              index: 0,
              function: { name: 'search_web', arguments: '' },
            }],
          },
          finish_reason: null,
        }],
      }),
      JSON.stringify({
        id: 'chatcmpl-compact-1',
        object: 'chat.completion.chunk',
        created: 1776916142,
        model: 'mock-model',
        choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"query":"' } }] }, finish_reason: null }],
      }),
      JSON.stringify({
        id: 'chatcmpl-compact-1',
        object: 'chat.completion.chunk',
        created: 1776916142,
        model: 'mock-model',
        choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: 'apple"}' } }] }, finish_reason: null }],
      }),
      JSON.stringify({
        id: 'chatcmpl-compact-1',
        object: 'chat.completion.chunk',
        created: 1776916142,
        model: 'mock-model',
        choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }],
      }),
      JSON.stringify({
        id: 'chatcmpl-compact-1',
        object: 'chat.completion.chunk',
        created: 1776916142,
        model: 'mock-model',
        choices: [{ index: 0, delta: { content: ' world' }, finish_reason: 'stop', stop_reason: 106 }],
      }),
      JSON.stringify({
        id: 'chatcmpl-compact-1',
        object: 'chat.completion.chunk',
        created: 1776916142,
        model: 'mock-model',
        choices: [],
        usage: { prompt_tokens: 7, completion_tokens: 5, total_tokens: 12 },
      }),
    ];
    const { server, port } = createMockBackend({
      streamChunks: compactStreamChunks,
      modelsResponse: [{ id: 'mock-model', object: 'model' }],
    });
    mockServer = server;

    const { userApiKey, userId } = await setupUserAndBackend(port, { detailLogging: true });

    const response = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${userApiKey}`)
      .send({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/event-stream/);

    const logsResponse = await admin.get(`/admin/analytics/requests?limit=1&userId=${userId}&detailLogged=1`);
    expect(logsResponse.body.rows).toHaveLength(1);

    const responseBody = logsResponse.body.rows[0].response_body;
    expect(responseBody).not.toContain('data: ');

    const parsed = JSON.parse(responseBody);
    expect(parsed.format).toBe('kyush.chat_stream.compact.v1');
    expect(parsed.id).toBe('chatcmpl-compact-1');
    expect(parsed.model).toBe('mock-model');
    expect(parsed.choices[0].reasoning).toBe('Think first. ');
    expect(parsed.choices[0].content).toBe('Hello world');
    expect(parsed.choices[0].tool_calls[0].function.arguments).toBe('{"query":"apple"}');
    expect(parsed.choices[0].finish_reason).toBe('stop');
    expect(parsed.choices[0].stop_reason).toBe('106');
    expect(parsed.usage.total_tokens).toBe(12);
    expect(parsed.stream.done).toBe(true);
  });

  it('should keep raw SSE logs when DETAIL_STREAM_LOG_MODE=raw', async () => {
    process.env.DETAIL_STREAM_LOG_MODE = 'raw';
    const { server, port } = createMockBackend({
      streamChunks: sampleStreamChunks,
      modelsResponse: [{ id: 'mock-model', object: 'model' }],
    });
    mockServer = server;

    const { userApiKey, userId } = await setupUserAndBackend(port, { detailLogging: true });

    await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${userApiKey}`)
      .send({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      });

    const logsResponse = await admin.get(`/admin/analytics/requests?limit=1&userId=${userId}&detailLogged=1`);
    expect(logsResponse.body.rows).toHaveLength(1);
    expect(logsResponse.body.rows[0].response_body).toContain('data: ');
    expect(logsResponse.body.rows[0].response_body).toContain('data: [DONE]');
  });

  it('should copy streaming reasoning to reasoning_content only for users with compatibility enabled', async () => {
    const reasoningStreamChunks = [
      JSON.stringify({
        id: 'chatcmpl-reasoning-1',
        object: 'chat.completion.chunk',
        model: 'mock-model',
        choices: [{ index: 0, delta: { role: 'assistant', reasoning: 'Think once.' }, finish_reason: null }],
      }),
      JSON.stringify({
        id: 'chatcmpl-reasoning-1',
        object: 'chat.completion.chunk',
        model: 'mock-model',
        choices: [{ index: 0, delta: { reasoning: ' Keep original.', reasoning_content: 'Existing wins.' }, finish_reason: null }],
      }),
      JSON.stringify({
        id: 'chatcmpl-reasoning-1',
        object: 'chat.completion.chunk',
        model: 'mock-model',
        choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: 'stop' }],
      }),
    ];
    const { server, port } = createMockBackend({
      streamChunks: reasoningStreamChunks,
      modelsResponse: [{ id: 'mock-model', object: 'model' }],
    });
    mockServer = server;

    const { backendId, userApiKey: defaultUserApiKey } = await setupUserAndBackend(port);
    const { userApiKey: compatUserApiKey } = await createUserForBackend(backendId, { copyReasoning: true });

    const defaultResponse = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${defaultUserApiKey}`)
      .send({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      });

    const compatResponse = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${compatUserApiKey}`)
      .send({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      });

    const defaultFirstChunk = JSON.parse(defaultResponse.text.split('\n').find((line: string) => line.startsWith('data: {'))!.replace('data: ', ''));
    expect(defaultFirstChunk.choices[0].delta.reasoning).toBe('Think once.');
    expect(defaultFirstChunk.choices[0].delta.reasoning_content).toBeUndefined();

    const compatDataLines = compatResponse.text.split('\n').filter((line: string) => line.startsWith('data: {'));
    const compatFirstChunk = JSON.parse(compatDataLines[0].replace('data: ', ''));
    expect(compatFirstChunk.choices[0].delta.reasoning).toBe('Think once.');
    expect(compatFirstChunk.choices[0].delta.reasoning_content).toBe('Think once.');

    const compatSecondChunk = JSON.parse(compatDataLines[1].replace('data: ', ''));
    expect(compatSecondChunk.choices[0].delta.reasoning).toBe(' Keep original.');
    expect(compatSecondChunk.choices[0].delta.reasoning_content).toBe('Existing wins.');
    expect(compatResponse.text).toContain('data: [DONE]');
  });

  it('should copy non-stream reasoning to reasoning_content only for users with compatibility enabled', async () => {
    const { server, port } = createMockBackend({
      chatResponse: {
        id: 'non-stream-reasoning-1',
        model: 'mock-model',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hello', reasoning: 'Think non-stream.' },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
      modelsResponse: [{ id: 'mock-model', object: 'model' }],
    });
    mockServer = server;

    const { backendId, userApiKey: defaultUserApiKey } = await setupUserAndBackend(port);
    const { userApiKey: compatUserApiKey } = await createUserForBackend(backendId, { copyReasoning: true });

    const defaultResponse = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${defaultUserApiKey}`)
      .send({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Hello' }],
      });

    const compatResponse = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', `Bearer ${compatUserApiKey}`)
      .send({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Hello' }],
      });

    expect(defaultResponse.body.choices[0].message.reasoning).toBe('Think non-stream.');
    expect(defaultResponse.body.choices[0].message.reasoning_content).toBeUndefined();
    expect(compatResponse.body.choices[0].message.reasoning).toBe('Think non-stream.');
    expect(compatResponse.body.choices[0].message.reasoning_content).toBe('Think non-stream.');
  });
});
