import express from 'express';

export interface MockBackendOptions {
  port?: number;
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
  modelsResponse?: Array<{ id: string; object: string }>;
}

export function createMockBackend(options: MockBackendOptions = {}) {
  const {
    port = 0,
    chatResponse = {
      id: 'mock-1',
      model: 'mock-model',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    },
    modelsResponse = [{ id: 'mock-model', object: 'model' }]
  } = options;

  const app = express();
  app.use(express.json());

  app.post('/v1/chat/completions', (req, res) => {
    res.json(chatResponse);
  });

  app.get('/v1/models', (req, res) => {
    res.json({ data: modelsResponse });
  });

  const server = app.listen(port);
  const actualPort = (server.address() as any).port;

  return { server, port: actualPort };
}
