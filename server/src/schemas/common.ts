import { z } from '@hono/zod-openapi';
import { ErrorResponseSchema } from '@kyush/shared';

export const ErrorResponse = ErrorResponseSchema.openapi('ErrorResponse', {
  example: { error: 'Something went wrong' },
});

export type { ErrorResponse as ErrorResponseType } from '@kyush/shared';

// Keep `z` available for any future schema definitions in this file.
export { z };
