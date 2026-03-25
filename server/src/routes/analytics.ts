import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';

const router: Router = Router();

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
