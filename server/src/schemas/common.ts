import { z } from '@hono/zod-openapi';

export const ErrorResponse = z
  .object({
    error: z.string().openapi({ example: 'Something went wrong' }),
    cause: z.string().optional(),
    backend: z.string().optional(),
    path: z.string().optional(),
  })
  .openapi('ErrorResponse');

export type ErrorResponseType = z.infer<typeof ErrorResponse>;
