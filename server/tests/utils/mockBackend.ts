import { serve, type ServerType } from '@hono/node-server';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';

import type { AddressInfo } from 'node:net';

export interface MockBackendRequestSnapshot {
  method: string;
  path: string;
  headers: Record<string, string> & { authorization?: string };
  body: any;
}

export interface MockBackendOptions {
  port?: number;
  onRequest?: (req: MockBackendRequestSnapshot) => void;
  chatResponse?: Partial<{
    id: string;
    model: string;
    choices: Array<{
      index: number;
      message: { role: string; content: string };
      finish_reason: string;
    }>;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }>;
  /** SSE stream chunks to send when request has stream: true. Each string becomes one SSE data line. */
  streamChunks?: string[];
  modelsResponse?: Array<{ id: string; object: string }>;
}

export interface MockBackendHandle {
  server: ServerType;
  port: number;
}

function snapshotHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export function createMockBackend(
  options: MockBackendOptions = {},
): MockBackendHandle {
  const {
    port = 0,
    onRequest,
    chatResponse = {
      id: 'mock-1',
      model: 'mock-model',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Hello' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    },
    streamChunks,
    modelsResponse = [{ id: 'mock-model', object: 'model' }],
  } = options;

  const app = new Hono();

  app.post('/v1/chat/completions', async (c) => {
    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }

    onRequest?.({
      method: 'POST',
      path: c.req.path,
      headers: snapshotHeaders(c.req.raw.headers),
      body,
    });

    if (body?.stream === true && streamChunks) {
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');
      return stream(c, async (s) => {
        for (const chunk of streamChunks) {
          await s.write(`data: ${chunk}\n\n`);
        }
        await s.write('data: [DONE]\n\n');
      });
    }

    return c.json(chatResponse);
  });

  app.get('/v1/models', (c) => {
    onRequest?.({
      method: 'GET',
      path: c.req.path,
      headers: snapshotHeaders(c.req.raw.headers),
      body: undefined,
    });
    return c.json({ data: modelsResponse });
  });

  const server = serve({ fetch: app.fetch, port });
  const address = server.address() as AddressInfo;
  return { server, port: address.port };
}
