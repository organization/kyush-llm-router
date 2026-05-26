import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';

const router: Router = Router();

router.get('/usage', (req: Request, res: Response) => {
  try {
    const { userId, backendId, days } = req.query;
    const result = AnalyticsService.getUsageStats(
      userId ? Number(userId) : undefined,
      backendId ? Number(backendId) : undefined,
      days ? Number(days) : 30
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch usage stats', details: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/requests', (req: Request, res: Response) => {
  try {
    const { month, date, limit, offset, q, userId, backendId, endpoint, detailLogged } = req.query;
    const result = AnalyticsService.getRequestLogs({
      month: typeof month === 'string' ? month : undefined,
      date: typeof date === 'string' ? date : undefined,
      limit: limit ? Number(limit) : 100,
      offset: offset ? Number(offset) : 0,
      q: typeof q === 'string' ? q : undefined,
      userId: userId ? Number(userId) : undefined,
      backendId: backendId ? Number(backendId) : undefined,
      endpoint: typeof endpoint === 'string' ? endpoint : undefined,
      detailLogged: detailLogged === undefined ? undefined : detailLogged === '1' || detailLogged === 'true',
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch request logs', details: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/metrics', (req: Request, res: Response) => {
  try {
    const { backendId, days } = req.query;
    const result = AnalyticsService.getBackendMetrics(
      backendId ? Number(backendId) : undefined,
      days ? Number(days) : 30
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch backend metrics', details: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/daily-totals', (req: Request, res: Response) => {
  try {
    const { backendId, days } = req.query;
    const result = AnalyticsService.getDailyTotals(
      backendId ? Number(backendId) : undefined,
      days ? Number(days) : 30
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch daily totals', details: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/backend-quality', (req: Request, res: Response) => {
  try {
    const { backendId, days } = req.query;
    const result = AnalyticsService.getBackendQuality(
      backendId ? Number(backendId) : undefined,
      days ? Number(days) : 30
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch backend quality', details: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/model-trends', (req: Request, res: Response) => {
  try {
    const { backendId, days, limit } = req.query;
    const result = AnalyticsService.getModelTrends(
      backendId ? Number(backendId) : undefined,
      days ? Number(days) : 30,
      limit ? Number(limit) : 8
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch model trends', details: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/response-length-histogram', (req: Request, res: Response) => {
  try {
    const { backendId, days, bins } = req.query;
    const result = AnalyticsService.getResponseLengthHistogram(
      backendId ? Number(backendId) : undefined,
      days ? Number(days) : 30,
      bins ? Number(bins) : 20
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch response length histogram', details: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/response-length-box-plot', (req: Request, res: Response) => {
  try {
    const { backendId, days } = req.query;
    const result = AnalyticsService.getResponseLengthBoxPlot(
      backendId ? Number(backendId) : undefined,
      days ? Number(days) : 30
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch response length box plot', details: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
