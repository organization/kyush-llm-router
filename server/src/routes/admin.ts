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

function sendRewriteCycleError(res: Response, rules: ReturnType<typeof ModelRewriteModel.findAll>): boolean {
  const cycle = ModelCatalogService.detectRewriteCycle(rules);
  if (!cycle) {
    return false;
  }

  res.status(409).json({
    error: 'Model rewrite cycle detected',
    cycle,
  });
  return true;
}

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
  const { name, email, api_key, detail_logging, copy_reasoning_to_reasoning_content } = req.body as CreateUserData;

  if (!name?.trim()) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  try {
    const user = UserModel.create({
      name: name.trim(),
      email: email?.trim() || undefined,
      api_key: api_key?.trim() || undefined,
      detail_logging,
      copy_reasoning_to_reasoning_content,
    });

    res.status(201).json(user);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'API key already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
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

  const { name, email, api_key, is_active, detail_logging, copy_reasoning_to_reasoning_content } = req.body as UpdateUserData;

  if (typeof name === 'string' && !name.trim()) {
    res.status(400).json({ error: 'Name cannot be empty' });
    return;
  }

  try {
    const updatedUser = UserModel.update(id, {
      name: typeof name === 'string' ? name.trim() : undefined,
      email: typeof email === 'string' ? email.trim() || undefined : undefined,
      api_key: typeof api_key === 'string' ? api_key.trim() || undefined : undefined,
      is_active,
      detail_logging,
      copy_reasoning_to_reasoning_content,
    });

    res.json(updatedUser);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'API key already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
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

  const sourceModel = source_model.trim();
  const targetModel = target_model.trim();
  const timestamp = getUtcTimestamp();
  const candidateRules = [
    ...ModelRewriteModel.findAll(),
    {
      id: 0,
      source_model: sourceModel,
      target_model: targetModel,
      is_active: is_active === false ? false : true,
      force: !!force,
      note,
      created_at: timestamp,
      updated_at: timestamp,
    },
  ];
  if (sendRewriteCycleError(res, candidateRules)) {
    return;
  }

  try {
    const rule = ModelRewriteModel.create({
      source_model: sourceModel,
      target_model: targetModel,
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

  const data = req.body as UpdateModelRewriteData;
  if (typeof data.source_model === 'string' && !data.source_model.trim()) {
    res.status(400).json({ error: 'source_model cannot be empty' });
    return;
  }
  if (typeof data.target_model === 'string' && !data.target_model.trim()) {
    res.status(400).json({ error: 'target_model cannot be empty' });
    return;
  }

  const candidateRules = ModelRewriteModel.findAll().map((rule) => {
    if (rule.id !== id) {
      return rule;
    }

    return {
      ...rule,
      source_model: typeof data.source_model === 'string' ? data.source_model.trim() : rule.source_model,
      target_model: typeof data.target_model === 'string' ? data.target_model.trim() : rule.target_model,
      is_active: data.is_active !== undefined ? data.is_active : rule.is_active,
      force: data.force !== undefined ? data.force : rule.force,
      note: data.note !== undefined ? data.note : rule.note,
    };
  });
  if (sendRewriteCycleError(res, candidateRules)) {
    return;
  }

  try {
    const updated = ModelRewriteModel.update(id, {
      ...data,
      source_model: typeof data.source_model === 'string' ? data.source_model.trim() : undefined,
      target_model: typeof data.target_model === 'string' ? data.target_model.trim() : undefined,
    });
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
