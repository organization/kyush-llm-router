import { Router, Request, Response } from 'express';
import { authenticate, AuthenticatedRequest } from './auth';
import { RouterService } from '../services/RouterService';
import { AnalyticsService } from '../services/AnalyticsService';
import { ScriptEngine } from '../services/ScriptEngine';
import { logger } from '../utils/logger';
import { ModelCatalogService, ModelRewriteCycleError } from '../services/ModelCatalogService';
import { getDetailStreamLogMode } from '../config/stream-logging';
import { shouldIncludeModelListRoutingMetadata } from '../config/model-list-metadata';
import { ChatStreamLogAccumulator } from '../utils/streamLog';

const router: Router = Router();

router.use(authenticate);

function normalizeHeaders(headers: Request['headers']): Record<string, string> {
  return Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
    if (Array.isArray(value)) {
      acc[key] = value.join(', ');
    } else if (typeof value === 'string') {
      acc[key] = value;
    }
    return acc;
  }, {});
}

router.post('/chat/completions', async (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();
  const user = req.user!;
  const allowedBackendIds = req.allowedBackendIds!;

  if (allowedBackendIds.length === 0) {
    res.status(403).json({ error: 'No backends available for your account' });
    return;
  }

  const requestedModel = typeof req.body?.model === 'string' ? req.body.model : '';
  await ModelCatalogService.ensureInitializedForBackends(allowedBackendIds);
  const activeAllowedBackendIds = ModelCatalogService.getActiveAllowedBackendIds(allowedBackendIds);
  if (activeAllowedBackendIds.length === 0) {
    AnalyticsService.logRequest({
      user_id: user.id,
      backend_id: 0,
      endpoint: '/v1/chat/completions',
      request_model: requestedModel,
      routed_model: requestedModel,
      status_code: 403,
      error_message: 'No active backends available',
      detail_logged: user.detail_logging,
      request_headers: user.detail_logging ? normalizeHeaders(req.headers) : undefined,
      request_body: user.detail_logging ? req.body : undefined,
    });
    res.status(403).json({ error: 'No active backends available' });
    return;
  }

  let resolution: ReturnType<typeof ModelCatalogService.resolveRequestedModel>;
  try {
    resolution = ModelCatalogService.resolveRequestedModel(requestedModel, activeAllowedBackendIds);
  } catch (error) {
    const errorMsg = error instanceof ModelRewriteCycleError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Model rewrite resolution failed';
    AnalyticsService.logRequest({
      user_id: user.id,
      backend_id: 0,
      endpoint: '/v1/chat/completions',
      request_model: requestedModel,
      routed_model: requestedModel,
      status_code: 500,
      error_message: errorMsg,
      detail_logged: user.detail_logging,
      request_headers: user.detail_logging ? normalizeHeaders(req.headers) : undefined,
      request_body: user.detail_logging ? req.body : undefined,
    });
    logger.error(`Model rewrite resolution failed for user ${user.id}: ${errorMsg}`);
    res.status(500).json({ error: 'Model rewrite configuration error' });
    return;
  }

  const candidateBackendIds = ModelCatalogService.getCandidateBackendIds(resolution.routedModel, activeAllowedBackendIds);
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
      request_headers: user.detail_logging ? normalizeHeaders(req.headers) : undefined,
      request_body: user.detail_logging ? req.body : undefined,
    });
    res.status(404).json({
      error: 'Requested model is not available for your account',
      request_model: resolution.requestedModel,
      routed_model: resolution.routedModel,
    });
    return;
  }

  try {
    const { model, messages, ...rest } = req.body;
    const detailLoggingEnabled = user.detail_logging || backend.detail_logging;
    const rewrittenBody = { model: resolution.routedModel, messages, ...rest };

    const execContext = {
      user: { id: user.id, name: user.name, email: user.email },
      backend: { id: backend.id, name: backend.name, base_url: backend.base_url },
      request: {
        method: 'POST',
        path: req.path,
        headers: {
          ...normalizeHeaders(req.headers),
          'content-type': req.get('content-type') || 'application/json',
        },
        body: rewrittenBody,
        isStream: req.body.stream === true,
      },
    };

    const { context: modifiedContext, errors: requestErrors } = await ScriptEngine.applyOnRequestScripts(
      execContext,
      user.id,
      backend.id
    );

    if (requestErrors.length > 0) {
      logger.warn(`Script warnings for user ${user.id}: ${requestErrors.join('; ')}`);
    }

    // Stream path: pipe SSE response directly to client
    if (modifiedContext.request.body && typeof modifiedContext.request.body === 'object' && 'stream' in modifiedContext.request.body && modifiedContext.request.body.stream === true) {
      const streamResult = await RouterService.forwardStreamRequest(
        backend,
        '/v1/chat/completions',
        'POST',
        modifiedContext.request.headers,
        modifiedContext.request.body
      );

      // Network error — return JSON error
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
          request_headers: detailLoggingEnabled ? modifiedContext.request.headers : undefined,
          request_body: detailLoggingEnabled ? modifiedContext.request.body : undefined,
          local_date: undefined,
        });
        logger.error(`Backend error for user ${user.id} (stream): ${JSON.stringify(streamResult.data)}`);
        void ModelCatalogService.refreshBackendAfterFailure(backend.id);
        res.status(streamResult.status).json(streamResult.data);
        return;
      }

      const backendResponse = streamResult.response;
      const backendResponseHeaders = Object.fromEntries(backendResponse.headers.entries());

      // Backend returned non-SSE response (e.g. JSON error)
      if (!backendResponse.headers.get('content-type')?.includes('text/event-stream')) {
        const data = await backendResponse.json().catch(() => ({}));
        const responseTime = Date.now() - startTime;
        AnalyticsService.logRequest({
          user_id: user.id,
          backend_id: backend.id,
          endpoint: '/v1/chat/completions',
          request_model: model,
          routed_model: resolution.routedModel,
          status_code: backendResponse.status,
          response_time_ms: responseTime,
          error_message: backendResponse.status >= 400 ? JSON.stringify(data) : undefined,
          detail_logged: detailLoggingEnabled,
          request_headers: detailLoggingEnabled ? modifiedContext.request.headers : undefined,
          request_body: detailLoggingEnabled ? modifiedContext.request.body : undefined,
          response_headers: detailLoggingEnabled ? backendResponseHeaders : undefined,
          response_body: detailLoggingEnabled ? data : undefined,
          local_date: undefined,
        });
        if (backendResponse.status >= 400) {
          void ModelCatalogService.refreshBackendAfterFailure(backend.id);
        }
        res.status(backendResponse.status).json(data);
        return;
      }

      // onResponse scripts (body not available for streams)
      await ScriptEngine.applyOnResponseScripts(
        execContext,
        { status: backendResponse.status, headers: backendResponseHeaders, body: null, isStream: true },
        user.id,
        backend.id
      );

      // Set SSE headers and start piping
      res.status(backendResponse.status);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const reader = backendResponse.body!.getReader();
      const decoder = new TextDecoder();
      req.on('close', () => reader.cancel());

      const detailStreamLogMode = getDetailStreamLogMode();
      const streamLog = new ChatStreamLogAccumulator(detailLoggingEnabled && (detailStreamLogMode === 'raw' || detailStreamLogMode === 'both'));

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);

          const text = decoder.decode(value, { stream: true });
          streamLog.append(text);
        }

        const remainingText = decoder.decode();
        if (remainingText) {
          streamLog.append(remainingText, false);
        }
      } catch (err) {
        logger.error(`Stream interrupted for user ${user.id}: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        res.end();
      }

      streamLog.flush();

      const responseTime = Date.now() - startTime;
      AnalyticsService.logRequest({
        user_id: user.id,
        backend_id: backend.id,
        endpoint: '/v1/chat/completions',
        request_model: model,
        routed_model: resolution.routedModel,
        response_model: streamLog.getResponseModel(),
        prompt_tokens: streamLog.getUsage()?.prompt_tokens,
        completion_tokens: streamLog.getUsage()?.completion_tokens,
        total_tokens: streamLog.getUsage()?.total_tokens,
        status_code: backendResponse.status,
        response_time_ms: responseTime,
        detail_logged: detailLoggingEnabled,
        request_headers: detailLoggingEnabled ? modifiedContext.request.headers : undefined,
        request_body: detailLoggingEnabled ? modifiedContext.request.body : undefined,
        response_headers: detailLoggingEnabled ? backendResponseHeaders : undefined,
        response_body: detailLoggingEnabled ? streamLog.toLogBody(detailStreamLogMode) : undefined,
        local_date: undefined,
      });

      if (backendResponse.status >= 400) {
        void ModelCatalogService.refreshBackendAfterFailure(backend.id);
      }
      return;
    }

    // Non-stream path: buffer and return JSON (unchanged)
    const response = await RouterService.forwardRequest(
      backend,
      '/v1/chat/completions',
      'POST',
      modifiedContext.request.headers,
      modifiedContext.request.body
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
      backend.id
    );

    AnalyticsService.logRequest({
      user_id: user.id,
      backend_id: backend.id,
      endpoint: '/v1/chat/completions',
      request_model: model,
      routed_model: resolution.routedModel,
      response_model: response.data && typeof response.data === 'object' && 'model' in response.data ? String(response.data.model) : undefined,
      prompt_tokens: response.data && typeof response.data === 'object' && 'usage' in response.data && typeof (response.data as { usage?: { prompt_tokens?: number } }).usage === 'object' ? (response.data as { usage: { prompt_tokens: number } }).usage?.prompt_tokens : undefined,
      completion_tokens: response.data && typeof response.data === 'object' && 'usage' in response.data && typeof (response.data as { usage?: { completion_tokens?: number } }).usage === 'object' ? (response.data as { usage: { completion_tokens: number } }).usage?.completion_tokens : undefined,
      total_tokens: response.data && typeof response.data === 'object' && 'usage' in response.data && typeof (response.data as { usage?: { total_tokens?: number } }).usage === 'object' ? (response.data as { usage: { total_tokens: number } }).usage?.total_tokens : undefined,
      status_code: response.status,
      response_time_ms: responseTime,
      error_message: response.status >= 400 ? JSON.stringify(response.data) : undefined,
      detail_logged: detailLoggingEnabled,
      request_headers: detailLoggingEnabled ? modifiedContext.request.headers : undefined,
      request_body: detailLoggingEnabled ? modifiedContext.request.body : undefined,
      response_headers: detailLoggingEnabled ? response.headers : undefined,
      response_body: detailLoggingEnabled ? response.data : undefined,
      local_date: undefined,
    });

    if (response.status >= 400) {
      const errorDetails = response.data as any;
      const errorInfo = errorDetails.error || 'Unknown error';
      const causeInfo = errorDetails.cause ? ` (Cause: ${errorDetails.cause})` : '';
      const backendInfo = errorDetails.backend ? ` [Backend: ${errorDetails.backend}]` : '';
      logger.error(`Backend error for user ${user.id}: ${errorInfo}${causeInfo}${backendInfo}`);
      void ModelCatalogService.refreshBackendAfterFailure(backend.id);
    }

    res.status(response.status).json(response.data);
  } catch (error) {
    const responseTime = Date.now() - startTime;

    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    AnalyticsService.logRequest({
      user_id: user.id,
      backend_id: backend.id,
      endpoint: '/v1/chat/completions',
      request_model: req.body.model,
      routed_model: resolution.routedModel,
      status_code: 502,
      response_time_ms: responseTime,
      error_message: errorMsg,
      detail_logged: user.detail_logging || backend.detail_logging,
      request_headers: user.detail_logging || backend.detail_logging ? normalizeHeaders(req.headers) : undefined,
      request_body: user.detail_logging || backend.detail_logging ? req.body : undefined,
      response_headers: undefined,
      response_body: undefined,
      local_date: undefined,
    });

    logger.error(`Request failed for user ${user.id}: ${errorMsg}`);
    void ModelCatalogService.refreshBackendAfterFailure(backend.id);
    res.status(502).json({ error: 'Backend request failed', details: errorMsg });
  }
});

router.get('/models', async (req: AuthenticatedRequest, res: Response) => {
  const allowedBackendIds = req.allowedBackendIds!;

  if (allowedBackendIds.length === 0) {
    res.status(403).json({ error: 'No backends available for your account' });
    return;
  }

  await ModelCatalogService.ensureInitializedForBackends(allowedBackendIds);
  const activeAllowedBackendIds = ModelCatalogService.getActiveAllowedBackendIds(allowedBackendIds);
  if (activeAllowedBackendIds.length === 0) {
    res.status(403).json({ error: 'No active backends available' });
    return;
  }
  let models: Array<{
    id: string;
    object: string;
    kyush_router?: {
      requested_model: string;
      routed_model: string;
      was_rewritten: boolean;
      rule_type: string;
      rewrite_path: Array<{ source_model: string; target_model: string; mode: string }>;
    };
  }>;
  try {
    const includeRoutingMetadata = shouldIncludeModelListRoutingMetadata();
    models = ModelCatalogService.getRequestableModelsForAllowedBackends(activeAllowedBackendIds).map((entry) => {
      const model = {
        id: entry.model_id,
        object: 'model',
      };

      if (!includeRoutingMetadata) {
        return model;
      }

      return {
        ...model,
        kyush_router: {
          requested_model: entry.routing.requestedModel,
          routed_model: entry.routing.routedModel,
          was_rewritten: entry.routing.wasRewritten,
          rule_type: entry.routing.ruleType,
          rewrite_path: entry.routing.rewritePath,
        },
      };
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Model rewrite resolution failed';
    logger.error(`Model list resolution failed: ${errorMsg}`);
    res.status(500).json({ error: 'Model rewrite configuration error' });
    return;
  }
  res.json({ object: 'list', data: models });
});

export default router;
