import { Router, Request, Response } from 'express';
import { authenticate, AuthenticatedRequest } from './auth';
import { RouterService } from '../services/RouterService';
import { AnalyticsService } from '../services/AnalyticsService';
import { ScriptEngine } from '../services/ScriptEngine';
import { logger } from '../utils/logger';

const router: Router = Router();

router.use(authenticate);

router.post('/chat/completions', async (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();
  const user = req.user!;
  const allowedBackendIds = req.allowedBackendIds!;

  if (allowedBackendIds.length === 0) {
    res.status(403).json({ error: 'No backends available for your account' });
    return;
  }

  const backend = RouterService.selectBackend(allowedBackendIds);
  if (!backend) {
    res.status(403).json({ error: 'No active backends available' });
    return;
  }

  try {
    const { model, messages, ...rest } = req.body;

    const execContext = {
      user: { id: user.id, name: user.name, email: user.email },
      backend: { id: backend.id, name: backend.name, base_url: backend.base_url },
      request: {
        method: 'POST',
        path: '/v1/chat/completions',
        headers: { 'Content-Type': 'application/json' },
        body: req.body,
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
      headers: {},
      body: response.data,
      isStream: req.body.stream === true,
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
      response_model: response.data && typeof response.data === 'object' && 'model' in response.data ? String(response.data.model) : undefined,
      prompt_tokens: response.data && typeof response.data === 'object' && 'usage' in response.data && typeof (response.data as { usage?: { prompt_tokens?: number } }).usage === 'object' ? (response.data as { usage: { prompt_tokens: number } }).usage?.prompt_tokens : undefined,
      completion_tokens: response.data && typeof response.data === 'object' && 'usage' in response.data && typeof (response.data as { usage?: { completion_tokens?: number } }).usage === 'object' ? (response.data as { usage: { completion_tokens: number } }).usage?.completion_tokens : undefined,
      total_tokens: response.data && typeof response.data === 'object' && 'usage' in response.data && typeof (response.data as { usage?: { total_tokens?: number } }).usage === 'object' ? (response.data as { usage: { total_tokens: number } }).usage?.total_tokens : undefined,
      status_code: response.status,
      response_time_ms: responseTime,
      error_message: response.status >= 400 ? JSON.stringify(response.data) : undefined,
    });

    if (response.status >= 400) {
      const errorDetails = response.data as any;
      const errorInfo = errorDetails.error || 'Unknown error';
      const causeInfo = errorDetails.cause ? ` (Cause: ${errorDetails.cause})` : '';
      const backendInfo = errorDetails.backend ? ` [Backend: ${errorDetails.backend}]` : '';
      logger.error(`Backend error for user ${user.id}: ${errorInfo}${causeInfo}${backendInfo}`);
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
      status_code: 502,
      response_time_ms: responseTime,
      error_message: errorMsg,
    });

    logger.error(`Request failed for user ${user.id}: ${errorMsg}`);
    res.status(502).json({ error: 'Backend request failed', details: errorMsg });
  }
});

router.get('/models', async (req: AuthenticatedRequest, res: Response) => {
  const allowedBackendIds = req.allowedBackendIds!;

  if (allowedBackendIds.length === 0) {
    res.status(403).json({ error: 'No backends available for your account' });
    return;
  }

  const backend = RouterService.selectBackend(allowedBackendIds);
  if (!backend) {
    res.status(403).json({ error: 'No active backends available' });
    return;
  }

  try {
    const response = await RouterService.forwardRequest(
      backend,
      '/v1/models',
      'GET',
      {}
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Models request failed for user ${req.user!.id}: ${errorMsg}`);
    res.status(502).json({ error: 'Failed to fetch models from backend', details: errorMsg });
  }
});

export default router;
