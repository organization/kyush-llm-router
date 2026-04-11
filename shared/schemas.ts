import { z } from 'zod';

/* ────────────────────────────────────────────────────────────────────────────
 * Common
 * ────────────────────────────────────────────────────────────────────────── */

export const ErrorResponseSchema = z.object({
  error: z.string(),
  cause: z.string().optional(),
  backend: z.string().optional(),
  path: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

const trimmedString = (label: string, max = 256) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long`);

const optionalTrimmedString = (max = 256) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

/* ────────────────────────────────────────────────────────────────────────────
 * Users
 * ────────────────────────────────────────────────────────────────────────── */

export const CreateUserInputSchema = z.object({
  name: trimmedString('Name'),
  email: optionalTrimmedString(),
  api_key: optionalTrimmedString(),
  detail_logging: z.boolean().optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

export const UpdateUserInputSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(256).optional(),
  email: optionalTrimmedString(),
  api_key: optionalTrimmedString(),
  is_active: z.boolean().optional(),
  detail_logging: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Backends
 * ────────────────────────────────────────────────────────────────────────── */

export const CreateBackendInputSchema = z.object({
  name: trimmedString('Name'),
  base_url: trimmedString('Base URL', 2048),
  api_key: optionalTrimmedString(),
  detail_logging: z.boolean().optional(),
});
export type CreateBackendInput = z.infer<typeof CreateBackendInputSchema>;

export const UpdateBackendInputSchema = z.object({
  name: z.string().trim().min(1).max(256).optional(),
  base_url: z.string().trim().min(1).max(2048).optional(),
  api_key: optionalTrimmedString(),
  is_active: z.boolean().optional(),
  detail_logging: z.boolean().optional(),
});
export type UpdateBackendInput = z.infer<typeof UpdateBackendInputSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Permissions
 * ────────────────────────────────────────────────────────────────────────── */

export const CreatePermissionInputSchema = z.object({
  user_id: z.number().int().positive(),
  backend_id: z.number().int().positive(),
});
export type CreatePermissionInput = z.infer<typeof CreatePermissionInputSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Model rewrites
 * ────────────────────────────────────────────────────────────────────────── */

export const CreateModelRewriteInputSchema = z.object({
  source_model: trimmedString('Source model'),
  target_model: trimmedString('Target model'),
  is_active: z.boolean().optional(),
  force: z.boolean().optional(),
  note: optionalTrimmedString(1024),
});
export type CreateModelRewriteInput = z.infer<
  typeof CreateModelRewriteInputSchema
>;

export const UpdateModelRewriteInputSchema = z.object({
  source_model: z.string().trim().min(1).max(256).optional(),
  target_model: z.string().trim().min(1).max(256).optional(),
  is_active: z.boolean().optional(),
  force: z.boolean().optional(),
  note: optionalTrimmedString(1024),
});
export type UpdateModelRewriteInput = z.infer<
  typeof UpdateModelRewriteInputSchema
>;

/* ────────────────────────────────────────────────────────────────────────────
 * Scripts
 * ────────────────────────────────────────────────────────────────────────── */

export const ScriptTypeSchema = z.enum([
  'per-user-backend',
  'per-backend',
  'per-user',
]);

const baseScriptFields = z.object({
  name: trimmedString('Name'),
  script_code: trimmedString('Script code', 1_000_000),
  is_active: z.boolean().optional(),
});

export const CreateScriptInputSchema = z.discriminatedUnion('script_type', [
  baseScriptFields.extend({
    script_type: z.literal('per-user-backend'),
    target_user_id: z.number().int().positive(),
    target_backend_id: z.number().int().positive(),
  }),
  baseScriptFields.extend({
    script_type: z.literal('per-backend'),
    target_user_id: z.null().optional(),
    target_backend_id: z.number().int().positive(),
  }),
  baseScriptFields.extend({
    script_type: z.literal('per-user'),
    target_user_id: z.number().int().positive(),
    target_backend_id: z.null().optional(),
  }),
]);
export type CreateScriptInput = z.infer<typeof CreateScriptInputSchema>;

export const UpdateScriptInputSchema = z.object({
  name: z.string().trim().min(1).max(256).optional(),
  script_type: ScriptTypeSchema.optional(),
  target_user_id: z.number().int().positive().nullable().optional(),
  target_backend_id: z.number().int().positive().nullable().optional(),
  script_code: z.string().min(1).max(1_000_000).optional(),
  is_active: z.boolean().optional(),
});
export type UpdateScriptInput = z.infer<typeof UpdateScriptInputSchema>;

export const ScriptContextRequestSchema = z
  .object({
    method: z.string(),
    path: z.string(),
    headers: z.record(z.string()),
    // `unknown` is optional in the wire schema, but the script runtime always
    // receives a `body` field (it might just be undefined). The transform
    // re-adds the field so the result satisfies the strict
    // `ScriptContextData` shape downstream consumers expect.
    body: z.unknown(),
    isStream: z.boolean(),
  })
  .transform((value) => ({
    method: value.method,
    path: value.path,
    headers: value.headers,
    body: value.body,
    isStream: value.isStream,
  }));
export type ScriptContextRequest = z.infer<typeof ScriptContextRequestSchema>;

export const ScriptContextResponseSchema = z.object({
  status: z.number().int(),
  headers: z.record(z.string()),
  body: z.unknown(),
  isStream: z.boolean(),
});
export type ScriptContextResponse = z.infer<typeof ScriptContextResponseSchema>;

export const ScriptTestInputSchema = z.object({
  user: z
    .object({
      id: z.number().int(),
      name: z.string(),
      email: z.string().optional(),
    })
    .nullable()
    .optional(),
  backend: z
    .object({
      id: z.number().int(),
      name: z.string(),
      base_url: z.string(),
    })
    .nullable()
    .optional(),
  request: ScriptContextRequestSchema,
});
export type ScriptTestInput = z.infer<typeof ScriptTestInputSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Admin auth
 * ────────────────────────────────────────────────────────────────────────── */

export const AdminLoginInputSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export type AdminLoginInput = z.infer<typeof AdminLoginInputSchema>;

export const CreateAdminTokenInputSchema = z.object({
  name: trimmedString('Token name'),
  expiresInDays: z.number().int().positive().optional(),
});
export type CreateAdminTokenInput = z.infer<typeof CreateAdminTokenInputSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * OpenAI v1
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The router is a proxy — it must not reject roles or content shapes that
 * a backend legitimately supports. The OpenAI spec defines `system`,
 * `user`, `assistant`, `tool`, and `function`; other providers may add
 * more. Accept any string so messages pass through unaltered.
 */
export const ChatRoleSchema = z.string();
export type ChatRole = z.infer<typeof ChatRoleSchema>;

/**
 * `content` may be:
 *   - a plain string (most common)
 *   - `null` (e.g. assistant messages that only carry tool_calls)
 *   - an array of content-part objects (multimodal: images, video, etc.)
 *
 * We validate the structural envelope but leave the inner content
 * unconstrained so the backend decides what's valid.
 */
export const ChatMessageSchema = z
  .object({
    role: ChatRoleSchema,
    content: z
      .union([z.string(), z.array(z.record(z.unknown())), z.null()])
      .optional(),
  })
  .passthrough();
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatCompletionRequestSchema = z
  .object({
    model: z.string(),
    messages: z.array(ChatMessageSchema),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().optional(),
    top_p: z.number().min(0).max(1).optional(),
    frequency_penalty: z.number().optional(),
    presence_penalty: z.number().optional(),
    stream: z.boolean().optional(),
  })
  .passthrough();
export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;

export const ChatCompletionUsageSchema = z.object({
  prompt_tokens: z.number().int(),
  completion_tokens: z.number().int(),
  total_tokens: z.number().int(),
});
export type ChatCompletionUsage = z.infer<typeof ChatCompletionUsageSchema>;

export const ChatCompletionChoiceSchema = z
  .object({
    index: z.number().int(),
    message: ChatMessageSchema,
    finish_reason: z.string().nullable().optional(),
  })
  .passthrough();
export type ChatCompletionChoice = z.infer<typeof ChatCompletionChoiceSchema>;

export const ChatCompletionResponseSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    created: z.number().int(),
    model: z.string(),
    choices: z.array(ChatCompletionChoiceSchema),
    usage: ChatCompletionUsageSchema,
  })
  .passthrough();
export type ChatCompletionResponse = z.infer<
  typeof ChatCompletionResponseSchema
>;

export const ModelEntrySchema = z.object({
  id: z.string(),
  object: z.literal('model'),
});
export type ModelEntry = z.infer<typeof ModelEntrySchema>;

export const ModelListResponseSchema = z.object({
  object: z.literal('list'),
  data: z.array(ModelEntrySchema),
});
export type ModelListResponse = z.infer<typeof ModelListResponseSchema>;

export const ModelNotAvailableResponseSchema = z.object({
  error: z.string(),
  request_model: z.string(),
  routed_model: z.string(),
});
export type ModelNotAvailableResponse = z.infer<
  typeof ModelNotAvailableResponseSchema
>;

/* ────────────────────────────────────────────────────────────────────────────
 * Loose response message parser (used by ConversationTimeline et al.)
 * Tolerant: accepts unknown extras and unparseable bodies are skipped at the
 * call site.
 * ────────────────────────────────────────────────────────────────────────── */

export const LooseChatMessageSchema = z
  .object({
    role: z.string().optional(),
    content: z.unknown().optional(),
  })
  .passthrough();

export const LooseChatCompletionRequestSchema = z
  .object({
    model: z.string().optional(),
    temperature: z.number().optional(),
    messages: z.array(LooseChatMessageSchema).optional(),
  })
  .passthrough();

export const LooseChatCompletionChoiceSchema = z
  .object({
    message: z
      .object({
        role: z.string().optional(),
        content: z.unknown().optional(),
        reasoning_content: z.unknown().optional(),
        tool_calls: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
    finish_reason: z.unknown().optional(),
    matched_stop: z.unknown().optional(),
    logprobs: z.unknown().optional(),
  })
  .passthrough();

export const LooseChatCompletionResponseSchema = z
  .object({
    created: z.number().optional(),
    choices: z.array(LooseChatCompletionChoiceSchema).optional(),
    usage: z
      .object({
        prompt_tokens: z.number().optional(),
        completion_tokens: z.number().optional(),
        total_tokens: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
