import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { stream } from 'hono/streaming';

import { authenticate } from './auth.js';

import { BackendModel } from '../models/Backend.js';
import { RouterService } from '../services/RouterService.js';
import { AnalyticsService } from '../services/AnalyticsService.js';
import { ScriptEngine } from '../services/ScriptEngine.js';
import { logger } from '../utils/logger.js';
import { ModelCatalogService } from '../services/ModelCatalogService.js';

import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelListResponse,
  ModelNotAvailableResponse,
} from '../schemas/v1.js';
import { ErrorResponse } from '../schemas/common.js';

import type { AppEnv } from '../types/hono.js';

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

function getRequestHeaders(
  c: Parameters<Parameters<typeof router.openapi>[1]>[0],
): Record<string, string> {
  const out: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
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

// SSE responses don't match the typed openapi response shape, so cast the handler.
// The OpenAPI spec still documents the JSON shape; the runtime returns either JSON or text/event-stream.
router.openapi(chatCompletionsRoute, (async (c: any) => {
  const startTime = Date.now();
  const user = c.get('user')!;
  const allowedBackendIds = c.get('allowedBackendIds')!;
  const reqBody = c.req.valid('json') as Record<string, unknown> & {
    model?: string;
    messages?: unknown;
    stream?: boolean;
  };
  const requestHeaders = getRequestHeaders(c);

  if (allowedBackendIds.length === 0) {
    return c.json({ error: 'No backends available for your account' }, 403);
  }

  const requestedModel = typeof reqBody.model === 'string' ? reqBody.model : '';
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
    const detailLoggingEnabled = user.detail_logging || backend.detail_logging;
    const rewrittenBody = { model: resolution.routedModel, messages, ...rest };

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
        return c.json(
          streamResult.data as Record<string, unknown>,
          streamResult.status as 502,
        );
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
        const data = (await backendResponse.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
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
        return c.json(data, backendResponse.status as 502);
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
      c.status(backendResponse.status as 200);

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

    AnalyticsService.logRequest({
      user_id: user.id,
      backend_id: backend.id,
      endpoint: '/v1/chat/completions',
      request_model: model,
      routed_model: resolution.routedModel,
      response_model:
        response.data &&
        typeof response.data === 'object' &&
        'model' in response.data
          ? String((response.data as { model?: unknown }).model)
          : undefined,
      prompt_tokens:
        response.data &&
        typeof response.data === 'object' &&
        'usage' in response.data
          ? (response.data as { usage?: { prompt_tokens?: number } }).usage
              ?.prompt_tokens
          : undefined,
      completion_tokens:
        response.data &&
        typeof response.data === 'object' &&
        'usage' in response.data
          ? (response.data as { usage?: { completion_tokens?: number } }).usage
              ?.completion_tokens
          : undefined,
      total_tokens:
        response.data &&
        typeof response.data === 'object' &&
        'usage' in response.data
          ? (response.data as { usage?: { total_tokens?: number } }).usage
              ?.total_tokens
          : undefined,
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
      const errorDetails = response.data as {
        error?: string;
        cause?: string;
        backend?: string;
      };
      const errorInfo = errorDetails.error || 'Unknown error';
      const causeInfo = errorDetails.cause
        ? ` (Cause: ${errorDetails.cause})`
        : '';
      const backendInfo = errorDetails.backend
        ? ` [Backend: ${errorDetails.backend}]`
        : '';
      logger.error(
        `Backend error for user ${user.id}: ${errorInfo}${causeInfo}${backendInfo}`,
      );
      void ModelCatalogService.refreshBackendAfterFailure(backend.id);
    }

    return c.json(
      response.data as Record<string, unknown>,
      response.status as 200,
    );
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
}) as any);

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
