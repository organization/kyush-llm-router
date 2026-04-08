import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { zValidator } from '@hono/zod-validator';
import { stream } from 'hono/streaming';

import {
  ChatCompletionRequestSchema,
  type ChatCompletionRequest as ChatCompletionRequestType,
} from '@kyush/shared';

import { authenticate } from './auth';

import { BackendModel } from '../models/Backend';
import { RouterService } from '../services/RouterService';
import { AnalyticsService } from '../services/AnalyticsService';
import { ScriptEngine } from '../services/ScriptEngine';
import { logger } from '../utils/logger';
import { ModelCatalogService } from '../services/ModelCatalogService';

import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelListResponse,
  ModelNotAvailableResponse,
} from '../schemas/v1';
import { ErrorResponse } from '../schemas/common';

import type { AppEnv } from '../types/hono';

const router = new OpenAPIHono<AppEnv>();

router.use('*', authenticate);

function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  return Object.entries(headers).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      if (Array.isArray(value)) {
        acc[key] = value.join(', ');
      } else if (typeof value === 'string') {
        acc[key] = value;
      }
      return acc;
    },
    {},
  );
}

function getRequestHeaders(c: {
  req: { raw: Request };
}): Record<string, string> {
  const out: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

interface CompletionUsageShape {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface CompletionMetadata {
  model?: string;
  usage?: CompletionUsageShape;
}

/**
 * Pull `model` and `usage` out of an upstream chat-completion JSON body
 * without trusting the shape. Type guards keep this honest — no `as` cast
 * fallbacks for the structurally narrow lookups we need for analytics logging.
 */
interface ErrorDetails {
  error: string;
  cause: string;
  backend: string;
}

function extractErrorDetails(data: unknown): ErrorDetails {
  const result: ErrorDetails = {
    error: 'Unknown error',
    cause: '',
    backend: '',
  };
  if (!isObject(data)) return result;
  if (typeof data.error === 'string') {
    result.error = data.error;
  }
  if (typeof data.cause === 'string') {
    result.cause = ` (Cause: ${data.cause})`;
  }
  if (typeof data.backend === 'string') {
    result.backend = ` [Backend: ${data.backend}]`;
  }
  return result;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractCompletionMetadata(data: unknown): CompletionMetadata {
  if (!isObject(data)) return {};
  const meta: CompletionMetadata = {};
  if (typeof data.model === 'string') {
    meta.model = data.model;
  }
  if (isObject(data.usage)) {
    const usage = data.usage;
    const result: CompletionUsageShape = {};
    if (typeof usage.prompt_tokens === 'number') {
      result.prompt_tokens = usage.prompt_tokens;
    }
    if (typeof usage.completion_tokens === 'number') {
      result.completion_tokens = usage.completion_tokens;
    }
    if (typeof usage.total_tokens === 'number') {
      result.total_tokens = usage.total_tokens;
    }
    meta.usage = result;
  }
  return meta;
}

const chatCompletionsRoute = createRoute({
  method: 'post',
  path: '/chat/completions',
  tags: ['v1'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': { schema: ChatCompletionRequest },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description:
        'Chat completion (JSON for non-stream, text/event-stream for stream:true)',
      content: {
        'application/json': { schema: ChatCompletionResponse },
      },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'Requested model not available',
      content: { 'application/json': { schema: ModelNotAvailableResponse } },
    },
    502: {
      description: 'Backend error',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

// SSE branch returns a stream Response that doesn't fit the typed-response
// generic `router.openapi()` enforces. We document the route through the
// openapi registry, then register the actual handler via plain `router.post`
// with `zValidator` so the streaming branch is type-checked normally and
// `c.req.valid('json')` is fully typed off the shared schema.
router.openAPIRegistry.registerPath({
  ...chatCompletionsRoute,
  responses: chatCompletionsRoute.responses,
});

router.post(
  '/chat/completions',
  zValidator('json', ChatCompletionRequestSchema),
  async (c) => {
    const startTime = Date.now();
    const user = c.get('user')!;
    const allowedBackendIds = c.get('allowedBackendIds')!;
    const reqBody: ChatCompletionRequestType = c.req.valid('json');
    const requestHeaders = getRequestHeaders(c);

    if (allowedBackendIds.length === 0) {
      return c.json({ error: 'No backends available for your account' }, 403);
    }

    const requestedModel =
      typeof reqBody.model === 'string' ? reqBody.model : '';
    await ModelCatalogService.ensureInitializedForBackends(allowedBackendIds);
    const resolution = ModelCatalogService.resolveRequestedModel(
      requestedModel,
      allowedBackendIds,
    );
    const activeAllowedBackendIds = BackendModel.findActive()
      .map((item) => item.id)
      .filter((backendId) => allowedBackendIds.includes(backendId));

    if (activeAllowedBackendIds.length === 0) {
      AnalyticsService.logRequest({
        user_id: user.id,
        backend_id: 0,
        endpoint: '/v1/chat/completions',
        request_model: requestedModel,
        routed_model: resolution.routedModel,
        status_code: 403,
        error_message: 'No active backends available',
        detail_logged: user.detail_logging,
        request_headers: user.detail_logging
          ? normalizeHeaders(requestHeaders)
          : undefined,
        request_body: user.detail_logging ? reqBody : undefined,
      });
      return c.json({ error: 'No active backends available' }, 403);
    }

    const candidateBackendIds = ModelCatalogService.getCandidateBackendIds(
      resolution.routedModel,
      allowedBackendIds,
    );
    const backend = RouterService.selectBackend(candidateBackendIds);
    if (!backend) {
      AnalyticsService.logRequest({
        user_id: user.id,
        backend_id: 0,
        endpoint: '/v1/chat/completions',
        request_model: resolution.requestedModel,
        routed_model: resolution.routedModel,
        status_code: 404,
        error_message: 'Requested model is not available for your account',
        detail_logged: user.detail_logging,
        request_headers: user.detail_logging
          ? normalizeHeaders(requestHeaders)
          : undefined,
        request_body: user.detail_logging ? reqBody : undefined,
      });
      return c.json(
        {
          error: 'Requested model is not available for your account',
          request_model: resolution.requestedModel,
          routed_model: resolution.routedModel,
        },
        404,
      );
    }

    try {
      const { model, messages, ...rest } = reqBody;
      const detailLoggingEnabled =
        user.detail_logging || backend.detail_logging;
      const rewrittenBody = {
        model: resolution.routedModel,
        messages,
        ...rest,
      };

      const execContext = {
        user: { id: user.id, name: user.name, email: user.email },
        backend: {
          id: backend.id,
          name: backend.name,
          base_url: backend.base_url,
        },
        request: {
          method: 'POST',
          path: c.req.path,
          headers: {
            ...normalizeHeaders(requestHeaders),
            'content-type': c.req.header('content-type') || 'application/json',
          },
          body: rewrittenBody,
          isStream: reqBody.stream === true,
        },
      };

      const { context: modifiedContext, errors: requestErrors } =
        await ScriptEngine.applyOnRequestScripts(
          execContext,
          user.id,
          backend.id,
        );

      if (requestErrors.length > 0) {
        logger.warn(
          `Script warnings for user ${user.id}: ${requestErrors.join('; ')}`,
        );
      }

      const isStreamRequest =
        modifiedContext.request.body &&
        typeof modifiedContext.request.body === 'object' &&
        'stream' in modifiedContext.request.body &&
        (modifiedContext.request.body as { stream?: boolean }).stream === true;

      if (isStreamRequest) {
        const streamResult = await RouterService.forwardStreamRequest(
          backend,
          '/v1/chat/completions',
          'POST',
          modifiedContext.request.headers,
          modifiedContext.request.body,
        );

        if (!('response' in streamResult)) {
          const responseTime = Date.now() - startTime;
          AnalyticsService.logRequest({
            user_id: user.id,
            backend_id: backend.id,
            endpoint: '/v1/chat/completions',
            request_model: model,
            routed_model: resolution.routedModel,
            status_code: streamResult.status,
            response_time_ms: responseTime,
            error_message: JSON.stringify(streamResult.data),
            detail_logged: detailLoggingEnabled,
            request_headers: detailLoggingEnabled
              ? modifiedContext.request.headers
              : undefined,
            request_body: detailLoggingEnabled
              ? modifiedContext.request.body
              : undefined,
            local_date: undefined,
          });
          logger.error(
            `Backend error for user ${user.id} (stream): ${JSON.stringify(streamResult.data)}`,
          );
          void ModelCatalogService.refreshBackendAfterFailure(backend.id);
          return new Response(JSON.stringify(streamResult.data ?? {}), {
            status: streamResult.status,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const backendResponse = streamResult.response;
        const backendResponseHeaders = Object.fromEntries(
          backendResponse.headers.entries(),
        );

        if (
          !backendResponse.headers
            .get('content-type')
            ?.includes('text/event-stream')
        ) {
          const data: unknown = await backendResponse.json().catch(() => ({}));
          const responseTime = Date.now() - startTime;
          AnalyticsService.logRequest({
            user_id: user.id,
            backend_id: backend.id,
            endpoint: '/v1/chat/completions',
            request_model: model,
            routed_model: resolution.routedModel,
            status_code: backendResponse.status,
            response_time_ms: responseTime,
            error_message:
              backendResponse.status >= 400 ? JSON.stringify(data) : undefined,
            detail_logged: detailLoggingEnabled,
            request_headers: detailLoggingEnabled
              ? modifiedContext.request.headers
              : undefined,
            request_body: detailLoggingEnabled
              ? modifiedContext.request.body
              : undefined,
            response_headers: detailLoggingEnabled
              ? backendResponseHeaders
              : undefined,
            response_body: detailLoggingEnabled ? data : undefined,
            local_date: undefined,
          });
          if (backendResponse.status >= 400) {
            void ModelCatalogService.refreshBackendAfterFailure(backend.id);
          }
          return new Response(JSON.stringify(data ?? {}), {
            status: backendResponse.status,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        await ScriptEngine.applyOnResponseScripts(
          execContext,
          {
            status: backendResponse.status,
            headers: backendResponseHeaders,
            body: null,
            isStream: true,
          },
          user.id,
          backend.id,
        );

        c.header('Content-Type', 'text/event-stream');
        c.header('Cache-Control', 'no-cache');
        c.header('Connection', 'keep-alive');
        // We've already short-circuited every non-SSE upstream above, so the
        // streaming branch is always a successful 200 by the time we get here.
        c.status(200);

        let responseModel: string | undefined;
        let usage:
          | {
              prompt_tokens?: number;
              completion_tokens?: number;
              total_tokens?: number;
            }
          | undefined;
        const collectedChunks: string[] = [];

        return stream(c, async (s) => {
          const reader = backendResponse.body!.getReader();
          const decoder = new TextDecoder();
          s.onAbort(() => {
            void reader.cancel();
          });

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              await s.write(value);

              const text = decoder.decode(value, { stream: true });
              if (detailLoggingEnabled) collectedChunks.push(text);

              for (const line of text.split('\n')) {
                if (!line.startsWith('data: ') || line === 'data: [DONE]')
                  continue;
                try {
                  const parsed = JSON.parse(line.slice(6)) as {
                    model?: string;
                    usage?: typeof usage;
                  };
                  if (parsed.model && !responseModel)
                    responseModel = parsed.model;
                  if (parsed.usage) usage = parsed.usage;
                } catch {
                  /* non-JSON data line, skip */
                }
              }
            }
          } catch (err) {
            logger.error(
              `Stream interrupted for user ${user.id}: ${err instanceof Error ? err.message : String(err)}`,
            );
          } finally {
            const responseTime = Date.now() - startTime;
            AnalyticsService.logRequest({
              user_id: user.id,
              backend_id: backend.id,
              endpoint: '/v1/chat/completions',
              request_model: model,
              routed_model: resolution.routedModel,
              response_model: responseModel,
              prompt_tokens: usage?.prompt_tokens,
              completion_tokens: usage?.completion_tokens,
              total_tokens: usage?.total_tokens,
              status_code: backendResponse.status,
              response_time_ms: responseTime,
              detail_logged: detailLoggingEnabled,
              request_headers: detailLoggingEnabled
                ? modifiedContext.request.headers
                : undefined,
              request_body: detailLoggingEnabled
                ? modifiedContext.request.body
                : undefined,
              response_headers: detailLoggingEnabled
                ? backendResponseHeaders
                : undefined,
              response_body: detailLoggingEnabled
                ? collectedChunks.join('')
                : undefined,
              local_date: undefined,
            });

            if (backendResponse.status >= 400) {
              void ModelCatalogService.refreshBackendAfterFailure(backend.id);
            }
          }
        });
      }

      const response = await RouterService.forwardRequest(
        backend,
        '/v1/chat/completions',
        'POST',
        modifiedContext.request.headers,
        modifiedContext.request.body,
      );

      const responseTime = Date.now() - startTime;

      const responseContext = {
        status: response.status,
        headers: response.headers,
        body: response.data,
        isStream: false,
      };

      await ScriptEngine.applyOnResponseScripts(
        execContext,
        responseContext,
        user.id,
        backend.id,
      );

      const completionMeta = extractCompletionMetadata(response.data);

      AnalyticsService.logRequest({
        user_id: user.id,
        backend_id: backend.id,
        endpoint: '/v1/chat/completions',
        request_model: model,
        routed_model: resolution.routedModel,
        response_model: completionMeta.model,
        prompt_tokens: completionMeta.usage?.prompt_tokens,
        completion_tokens: completionMeta.usage?.completion_tokens,
        total_tokens: completionMeta.usage?.total_tokens,
        status_code: response.status,
        response_time_ms: responseTime,
        error_message:
          response.status >= 400 ? JSON.stringify(response.data) : undefined,
        detail_logged: detailLoggingEnabled,
        request_headers: detailLoggingEnabled
          ? modifiedContext.request.headers
          : undefined,
        request_body: detailLoggingEnabled
          ? modifiedContext.request.body
          : undefined,
        response_headers: detailLoggingEnabled ? response.headers : undefined,
        response_body: detailLoggingEnabled ? response.data : undefined,
        local_date: undefined,
      });

      if (response.status >= 400) {
        const details = extractErrorDetails(response.data);
        logger.error(
          `Backend error for user ${user.id}: ${details.error}${details.cause}${details.backend}`,
        );
        void ModelCatalogService.refreshBackendAfterFailure(backend.id);
      }

      // The upstream JSON body comes back as `unknown`; build a Response by
      // hand so we don't lean on `c.json`'s typed status union.
      return new Response(JSON.stringify(response.data ?? {}), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      AnalyticsService.logRequest({
        user_id: user.id,
        backend_id: backend.id,
        endpoint: '/v1/chat/completions',
        request_model:
          typeof reqBody.model === 'string' ? reqBody.model : undefined,
        routed_model: resolution.routedModel,
        status_code: 502,
        response_time_ms: responseTime,
        error_message: errorMsg,
        detail_logged: user.detail_logging || backend.detail_logging,
        request_headers:
          user.detail_logging || backend.detail_logging
            ? normalizeHeaders(requestHeaders)
            : undefined,
        request_body:
          user.detail_logging || backend.detail_logging ? reqBody : undefined,
        response_headers: undefined,
        response_body: undefined,
        local_date: undefined,
      });

      logger.error(`Request failed for user ${user.id}: ${errorMsg}`);
      void ModelCatalogService.refreshBackendAfterFailure(backend.id);
      return c.json({ error: 'Backend request failed', cause: errorMsg }, 502);
    }
  },
);

const modelsRoute = createRoute({
  method: 'get',
  path: '/models',
  tags: ['v1'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Models accessible to the authenticated user',
      content: { 'application/json': { schema: ModelListResponse } },
    },
    403: {
      description: 'No backends available',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

router.openapi(modelsRoute, async (c) => {
  const allowedBackendIds = c.get('allowedBackendIds')!;

  if (allowedBackendIds.length === 0) {
    return c.json({ error: 'No backends available for your account' }, 403);
  }

  await ModelCatalogService.ensureInitializedForBackends(allowedBackendIds);
  const activeAllowedBackendIds = BackendModel.findActive()
    .map((item) => item.id)
    .filter((backendId) => allowedBackendIds.includes(backendId));
  if (activeAllowedBackendIds.length === 0) {
    return c.json({ error: 'No active backends available' }, 403);
  }
  const models = ModelCatalogService.getModelsForAllowedBackends(
    activeAllowedBackendIds,
  ).map((entry) => ({
    id: entry.model_id,
    object: 'model' as const,
  }));
  return c.json({ object: 'list' as const, data: models }, 200);
});

// Re-export z for completeness (used by other modules importing from this route file).
export { z };

export default router;
