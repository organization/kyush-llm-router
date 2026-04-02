import express from 'express';

export interface MockBackendOptions {
  port?: number;
  onRequest?: (req: express.Request) => void;
  chatResponse?: Partial<{
    id: string;
    model: string;
    choices: Array<{
      index: number;
      message: { role: string; content: string };
      finish_reason: string;
    }>;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }>;
  /** SSE stream chunks to send when request has stream: true. Each string becomes one SSE data line. */
  streamChunks?: string[];
  modelsResponse?: Array<{ id: string; object: string }>;
}

export function createMockBackend(options: MockBackendOptions = {}) {
  const {
    port = 0,
    onRequest,
    chatResponse = {
      id: 'mock-1',
      model: 'mock-model',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    },
    streamChunks,
    modelsResponse = [{ id: 'mock-model', object: 'model' }]
  } = options;

  const app = express();
  app.use(express.json());

  app.post('/v1/chat/completions', (req, res) => {
    onRequest?.(req);

    if (req.body.stream === true && streamChunks) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      for (const chunk of streamChunks) {
        res.write(`data: ${chunk}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    res.json(chatResponse);
  });

  app.get('/v1/models', (req, res) => {
    onRequest?.(req);
    res.json({ data: modelsResponse });
  });

  const server = app.listen(port);
  const actualPort = (server.address() as any).port;

  return { server, port: actualPort };
}
