import { z } from '@hono/zod-openapi';

export const ChatMessage = z
  .object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })
  .openapi('ChatMessage');

export const ChatCompletionRequest = z
  .object({
    model: z.string().openapi({ example: 'gpt-4o-mini' }),
    messages: z.array(ChatMessage),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().optional(),
    top_p: z.number().min(0).max(1).optional(),
    frequency_penalty: z.number().optional(),
    presence_penalty: z.number().optional(),
    stream: z.boolean().optional(),
  })
  .passthrough()
  .openapi('ChatCompletionRequest');

export const ChatCompletionChoice = z.object({
  index: z.number().int(),
  message: ChatMessage,
  finish_reason: z.string(),
});

export const ChatCompletionUsage = z.object({
  prompt_tokens: z.number().int(),
  completion_tokens: z.number().int(),
  total_tokens: z.number().int(),
});

export const ChatCompletionResponse = z
  .object({
    id: z.string(),
    object: z.string(),
    created: z.number().int(),
    model: z.string(),
    choices: z.array(ChatCompletionChoice),
    usage: ChatCompletionUsage,
  })
  .passthrough()
  .openapi('ChatCompletionResponse');

export const ModelEntry = z
  .object({
    id: z.string(),
    object: z.literal('model'),
  })
  .openapi('ModelEntry');

export const ModelListResponse = z
  .object({
    object: z.literal('list'),
    data: z.array(ModelEntry),
  })
  .openapi('ModelListResponse');

export const ModelNotAvailableResponse = z
  .object({
    error: z.string(),
    request_model: z.string(),
    routed_model: z.string(),
  })
  .openapi('ModelNotAvailableResponse');
