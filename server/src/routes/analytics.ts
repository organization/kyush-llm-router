import { Hono } from 'hono';

import { AnalyticsService } from '../services/AnalyticsService';

import type { AppEnv } from '../types/hono';

const router = new Hono<AppEnv>();

router.get('/usage', (c) => {
  const userId = c.req.query('userId');
  const backendId = c.req.query('backendId');
  const days = c.req.query('days');
  return c.json(
    AnalyticsService.getUsageStats(
      userId ? Number(userId) : undefined,
      backendId ? Number(backendId) : undefined,
      days ? Number(days) : 30,
    ),
  );
});

router.get('/requests', (c) => {
  const month = c.req.query('month');
  const date = c.req.query('date');
  const limit = c.req.query('limit');
  const offset = c.req.query('offset');
  const q = c.req.query('q');
  const userId = c.req.query('userId');
  const backendId = c.req.query('backendId');
  const endpoint = c.req.query('endpoint');
  const detailLogged = c.req.query('detailLogged');
  return c.json(
    AnalyticsService.getRequestLogs({
      month: typeof month === 'string' ? month : undefined,
      date: typeof date === 'string' ? date : undefined,
      limit: limit ? Number(limit) : 100,
      offset: offset ? Number(offset) : 0,
      q: typeof q === 'string' ? q : undefined,
      userId: userId ? Number(userId) : undefined,
      backendId: backendId ? Number(backendId) : undefined,
      endpoint: typeof endpoint === 'string' ? endpoint : undefined,
      detailLogged:
        detailLogged === undefined
          ? undefined
          : detailLogged === '1' || detailLogged === 'true',
    }),
  );
});

router.get('/metrics', (c) => {
  const backendId = c.req.query('backendId');
  const days = c.req.query('days');
  return c.json(
    AnalyticsService.getBackendMetrics(
      backendId ? Number(backendId) : undefined,
      days ? Number(days) : 30,
    ),
  );
});

router.get('/daily-totals', (c) => {
  const backendId = c.req.query('backendId');
  const days = c.req.query('days');
  return c.json(
    AnalyticsService.getDailyTotals(
      backendId ? Number(backendId) : undefined,
      days ? Number(days) : 30,
    ),
  );
});

router.get('/backend-quality', (c) => {
  const backendId = c.req.query('backendId');
  const days = c.req.query('days');
  return c.json(
    AnalyticsService.getBackendQuality(
      backendId ? Number(backendId) : undefined,
      days ? Number(days) : 30,
    ),
  );
});

router.get('/model-trends', (c) => {
  const backendId = c.req.query('backendId');
  const days = c.req.query('days');
  const limit = c.req.query('limit');
  return c.json(
    AnalyticsService.getModelTrends(
      backendId ? Number(backendId) : undefined,
      days ? Number(days) : 30,
      limit ? Number(limit) : 8,
    ),
  );
});

router.get('/response-length-histogram', (c) => {
  const backendId = c.req.query('backendId');
  const days = c.req.query('days');
  const bins = c.req.query('bins');
  return c.json(
    AnalyticsService.getResponseLengthHistogram(
      backendId ? Number(backendId) : undefined,
      days ? Number(days) : 30,
      bins ? Number(bins) : 20,
    ),
  );
});

router.get('/response-length-box-plot', (c) => {
  const backendId = c.req.query('backendId');
  const days = c.req.query('days');
  return c.json(
    AnalyticsService.getResponseLengthBoxPlot(
      backendId ? Number(backendId) : undefined,
      days ? Number(days) : 30,
    ),
  );
});

export default router;
