import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';

const router = Router();

router.get('/usage', (req: Request, res: Response) => {
  const { userId, backendId, days } = req.query;
  const result = AnalyticsService.getUsageStats(
    userId ? Number(userId) : undefined,
    backendId ? Number(backendId) : undefined,
    days ? Number(days) : 30
  );
  res.json(result);
});

router.get('/requests', (req: Request, res: Response) => {
  const { limit, offset } = req.query;
  const result = AnalyticsService.getRequestLogs(
    limit ? Number(limit) : 100,
    offset ? Number(offset) : 0
  );
  res.json(result);
});

router.get('/metrics', (req: Request, res: Response) => {
  const { backendId, days } = req.query;
  const result = AnalyticsService.getBackendMetrics(
    backendId ? Number(backendId) : undefined,
    days ? Number(days) : 30
  );
  res.json(result);
});

export default router;
