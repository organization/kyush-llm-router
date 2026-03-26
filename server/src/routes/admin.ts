import { Router, Request, Response } from 'express';
import { UserModel } from '../models/User';
import { BackendModel } from '../models/Backend';
import { ModelRewriteModel } from '../models/ModelRewrite';
import { PermissionModel } from '../models/Permission';
import scriptRoutes from './scripts';
import {
  CreateBackendData,
  CreateModelRewriteData,
  CreatePermissionData,
  CreateUserData,
  UpdateBackendData,
  UpdateModelRewriteData,
  UpdateUserData,
} from '../../../shared/types';
import { getUtcTimestamp } from '../utils/time';
import { ModelCatalogService } from '../services/ModelCatalogService';
import { AnalyticsService } from '../services/AnalyticsService';

const router: Router = Router();

router.use('/scripts', scriptRoutes);

router.get('/dashboard/summary', (req: Request, res: Response) => {
  const days = req.query.days ? Number(req.query.days) : 30;
  res.json(AnalyticsService.getDashboardSummary(days));
});

// ============ User Management ============

router.get('/users', (req: Request, res: Response) => {
  const users = UserModel.findAll();
  res.json(users);
});

router.post('/users', (req: Request, res: Response) => {
  const { name, email, detail_logging } = req.body as CreateUserData;

  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const user = UserModel.create({
    name,
    email,
    detail_logging,
  });

  const updatedUser = UserModel.regenerateApiKey(user.id);
  if (updatedUser) {
    user.api_key = updatedUser;
  }

  res.status(201).json(user);
});

router.get('/users/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const user = UserModel.findById(id);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

router.put('/users/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const user = UserModel.findById(id);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { name, email, is_active, detail_logging } = req.body as UpdateUserData;
  const updatedUser = UserModel.update(id, { name, email, is_active, detail_logging });

  res.json(updatedUser);
});

router.delete('/users/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const success = UserModel.delete(id);

  if (!success) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.status(204).send();
});

router.post('/users/:id/regenerate-api-key', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const user = UserModel.findById(id);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const newApiKey = UserModel.regenerateApiKey(id);
  if (!newApiKey) {
    res.status(500).json({ error: 'Failed to regenerate API key' });
    return;
  }

  res.json({ ...user, api_key: newApiKey });
});

// ============ Backend Management ============

router.get('/backends', (req: Request, res: Response) => {
  const backends = ModelCatalogService.getBackendsWithSummary();
  res.json(backends);
});

router.post('/backends', (req: Request, res: Response) => {
  const { name, base_url, api_key, detail_logging } = req.body as CreateBackendData;

  if (!name || !base_url) {
    res.status(400).json({ error: 'Name and base_url are required' });
    return;
  }

  const backend = BackendModel.create({ name, base_url, api_key, detail_logging });
  res.status(201).json(backend);
});

router.get('/backends/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const backend = ModelCatalogService.getBackendsWithSummary().find((item) => item.id === id);

  if (!backend) {
    res.status(404).json({ error: 'Backend not found' });
    return;
  }

  res.json(backend);
});

router.put('/backends/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const backend = BackendModel.findById(id);

  if (!backend) {
    res.status(404).json({ error: 'Backend not found' });
    return;
  }

  const { name, base_url, api_key, is_active, detail_logging } = req.body as UpdateBackendData;
  const updatedBackend = BackendModel.update(id, { name, base_url, api_key, is_active, detail_logging });
  await ModelCatalogService.handleBackendUpdated(id);
  res.json(ModelCatalogService.getBackendsWithSummary().find((item) => item.id === id) || updatedBackend);
});

router.delete('/backends/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const success = BackendModel.delete(id);

  if (!success) {
    res.status(404).json({ error: 'Backend not found' });
    return;
  }

  await ModelCatalogService.handleBackendUpdated(id);
  res.status(204).send();
});

router.get('/backends/:id/models', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const payload = ModelCatalogService.getBackendModelsResponse(id);

  if (!payload) {
    res.status(404).json({ error: 'Backend not found' });
    return;
  }

  res.json(payload);
});

router.post('/backends/:id/models/refresh', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const backend = BackendModel.findById(id);

  if (!backend) {
    res.status(404).json({ error: 'Backend not found' });
    return;
  }

  if (!backend.is_active) {
    res.status(409).json({ error: 'Inactive backends cannot refresh model cache' });
    return;
  }

  const cache = await ModelCatalogService.refreshBackendModels(id, { force: true, reason: 'admin-manual' });
  res.json({
    backend: ModelCatalogService.getBackendsWithSummary().find((item) => item.id === id) || backend,
    cache,
    snapshots: ModelCatalogService.getBackendModelsResponse(id)?.snapshots || [],
    models: ModelCatalogService.getBackendModelsResponse(id)?.models || [],
  });
});

router.get('/models/cache', (req: Request, res: Response) => {
  res.json(ModelCatalogService.getCacheOverview());
});

// ============ Permission Management ============

router.get('/permissions', (req: Request, res: Response) => {
  const permissions = PermissionModel.findAll();
  res.json(permissions);
});

router.get('/permissions/user/:userId', (req: Request, res: Response) => {
  const userId = Number(req.params.userId);
  const permissions = PermissionModel.findByUserId(userId);
  res.json(permissions);
});

router.get('/permissions/backend/:backendId', (req: Request, res: Response) => {
  const backendId = Number(req.params.backendId);
  const permissions = PermissionModel.findByBackendId(backendId);
  res.json(permissions);
});

router.post('/permissions', (req: Request, res: Response) => {
  const { user_id, backend_id } = req.body as CreatePermissionData;

  if (!user_id || !backend_id) {
    res.status(400).json({ error: 'user_id and backend_id are required' });
    return;
  }

  try {
    const permission = PermissionModel.create({ user_id, backend_id });
    res.status(201).json(permission);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      res.status(409).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to create permission' });
  }
});

router.delete('/permissions', (req: Request, res: Response) => {
  const { user_id, backend_id } = req.query as { user_id?: string; backend_id?: string };

  if (!user_id || !backend_id) {
    res.status(400).json({ error: 'user_id and backend_id are required' });
    return;
  }

  const success = PermissionModel.delete(Number(user_id), Number(backend_id));

  if (!success) {
    res.status(404).json({ error: 'Permission not found' });
    return;
  }

  res.status(204).send();
});

router.get('/model-rewrites', (req: Request, res: Response) => {
  res.json(ModelRewriteModel.findAll());
});

router.post('/model-rewrites', (req: Request, res: Response) => {
  const { source_model, target_model, is_active, force, note } = req.body as CreateModelRewriteData;

  if (!source_model?.trim() || !target_model?.trim()) {
    res.status(400).json({ error: 'source_model and target_model are required' });
    return;
  }

  try {
    const rule = ModelRewriteModel.create({
      source_model: source_model.trim(),
      target_model: target_model.trim(),
      is_active,
      force,
      note,
    });
    ModelCatalogService.loadRewriteMap();
    res.status(201).json(rule);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Rewrite rule already exists for this source_model' });
      return;
    }
    res.status(500).json({ error: 'Failed to create model rewrite rule' });
  }
});

router.put('/model-rewrites/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const existing = ModelRewriteModel.findById(id);
  if (!existing) {
    res.status(404).json({ error: 'Model rewrite rule not found' });
    return;
  }

  try {
    const updated = ModelRewriteModel.update(id, req.body as UpdateModelRewriteData);
    ModelCatalogService.loadRewriteMap();
    res.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Rewrite rule already exists for this source_model' });
      return;
    }
    res.status(500).json({ error: 'Failed to update model rewrite rule' });
  }
});

router.delete('/model-rewrites/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const success = ModelRewriteModel.delete(id);

  if (!success) {
    res.status(404).json({ error: 'Model rewrite rule not found' });
    return;
  }

  ModelCatalogService.loadRewriteMap();
  res.status(204).send();
});

// ============ Health Check ============

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: getUtcTimestamp() });
});

export default router;
