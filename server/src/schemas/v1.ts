// Importing `z` from `@hono/zod-openapi` patches zod's prototype with `.openapi()`,
// which lets us decorate the shared schemas with OpenAPI metadata without
// duplicating their shape on the server.
import { z } from '@hono/zod-openapi';
import {
  ChatCompletionRequestSchema,
  ChatCompletionResponseSchema,
  ChatMessageSchema,
  ModelEntrySchema,
  ModelListResponseSchema,
  ModelNotAvailableResponseSchema,
} from '@kyush/shared';

// Re-export the shared schemas with OpenAPI annotations attached. The
// underlying zod instances are shared with the client, so any schema change
// applies to both sides simultaneously.
export const ChatMessage = ChatMessageSchema.openapi('ChatMessage');
export const ChatCompletionRequest = ChatCompletionRequestSchema.openapi(
  'ChatCompletionRequest',
  { example: { model: 'gpt-4o-mini', messages: [] } },
);
export const ChatCompletionResponse = ChatCompletionResponseSchema.openapi(
  'ChatCompletionResponse',
);
export const ModelEntry = ModelEntrySchema.openapi('ModelEntry');
export const ModelListResponse =
  ModelListResponseSchema.openapi('ModelListResponse');
export const ModelNotAvailableResponse =
  ModelNotAvailableResponseSchema.openapi('ModelNotAvailableResponse');

// Re-export `z` so other server code can keep importing from a single place.
export { z };
