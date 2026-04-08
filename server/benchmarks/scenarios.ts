export interface Scenario {
  name: string;
  description: string;
  payload: ChatCompletionPayload;
  endpoint: string;
  method: string;
}

export interface ChatCompletionPayload {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const Scenarios = {
  smallPayload: (): Scenario => ({
    name: 'Small Payload',
    description: 'Single short message',
    endpoint: '/v1/chat/completions',
    method: 'POST',
    payload: {
      model: 'test-model',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 0.7,
      max_tokens: 100,
    },
  }),

  largePayload: (): Scenario => ({
    name: 'Large Payload',
    description: 'Multiple long messages',
    endpoint: '/v1/chat/completions',
    method: 'POST',
    payload: {
      model: 'test-model',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that provides detailed and accurate information to users. Always respond in a clear and concise manner.',
        },
        {
          role: 'user',
          content:
            'Can you explain the difference between supervised and unsupervised learning in machine learning? Please provide examples of each and discuss their use cases.',
        },
        {
          role: 'assistant',
          content:
            'Supervised learning uses labeled data to train models, while unsupervised learning finds patterns in unlabeled data.',
        },
        {
          role: 'user',
          content:
            'That is helpful. Can you also explain reinforcement learning and how it differs from these approaches? What are some practical applications?',
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    },
  }),

  modelsEndpoint: (): Scenario => ({
    name: 'Models Endpoint',
    description: 'GET /models request',
    endpoint: '/v1/models',
    method: 'GET',
    payload: {} as ChatCompletionPayload,
  }),
};

export function createRealBackendPayload(): Scenario {
  return {
    name: 'Real Backend',
    description: 'Test with real OAI-compatible API',
    endpoint: '/v1/chat/completions',
    method: 'POST',
    payload: {
      model: process.env.REAL_MODEL || 'default-model',
      messages: [{ role: 'user', content: 'Hello, this is a benchmark test.' }],
      temperature: 0.7,
      max_tokens: 100,
    },
  };
}
