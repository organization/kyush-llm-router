import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import {
  CreateBackendInputSchema,
  CreateModelRewriteInputSchema,
  CreatePermissionInputSchema,
  CreateUserInputSchema,
  UpdateBackendInputSchema,
  UpdateModelRewriteInputSchema,
  UpdateUserInputSchema,
} from '@kyush/shared';

import scriptRoutes from './scripts.js';

import { UserModel } from '../models/User.js';
import { BackendModel } from '../models/Backend.js';
import { ModelRewriteModel } from '../models/ModelRewrite.js';
import { PermissionModel } from '../models/Permission.js';

import { getUtcTimestamp } from '../utils/time.js';
import { ModelCatalogService } from '../services/ModelCatalogService.js';
import { AnalyticsService } from '../services/AnalyticsService.js';

import type { AppEnv } from '../types/hono.js';

const router = new Hono<AppEnv>();

router.route('/scripts', scriptRoutes);

router.get('/dashboard/summary', (c) => {
  const days = c.req.query('days') ? Number(c.req.query('days')) : 30;
  return c.json(AnalyticsService.getDashboardSummary(days));
});

// ============ User Management ============

router.get('/users', (c) => {
  return c.json(UserModel.findAll());
});

router.post('/users', zValidator('json', CreateUserInputSchema), (c) => {
  const data = c.req.valid('json');

  try {
    const user = UserModel.create(data);
    return c.json(user, 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      return c.json({ error: 'API key already exists' }, 409);
    }
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

router.get('/users/:id', (c) => {
  const id = Number(c.req.param('id'));
  const user = UserModel.findById(id);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }
  return c.json(user);
});

router.put('/users/:id', zValidator('json', UpdateUserInputSchema), (c) => {
  const id = Number(c.req.param('id'));
  const user = UserModel.findById(id);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  try {
    const updatedUser = UserModel.update(id, c.req.valid('json'));
    return c.json(updatedUser);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      return c.json({ error: 'API key already exists' }, 409);
    }
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

router.delete('/users/:id', (c) => {
  const id = Number(c.req.param('id'));
  const success = UserModel.delete(id);
  if (!success) {
    return c.json({ error: 'User not found' }, 404);
  }
  return c.body(null, 204);
});

router.post('/users/:id/regenerate-api-key', (c) => {
  const id = Number(c.req.param('id'));
  const user = UserModel.findById(id);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const newApiKey = UserModel.regenerateApiKey(id);
  if (!newApiKey) {
    return c.json({ error: 'Failed to regenerate API key' }, 500);
  }

  return c.json({ ...user, api_key: newApiKey });
});

// ============ Backend Management ============

router.get('/backends', (c) => {
  return c.json(ModelCatalogService.getBackendsWithSummary());
});

router.post('/backends', zValidator('json', CreateBackendInputSchema), (c) => {
  const backend = BackendModel.create(c.req.valid('json'));
  return c.json(backend, 201);
});

router.get('/backends/:id', (c) => {
  const id = Number(c.req.param('id'));
  const backend = ModelCatalogService.getBackendsWithSummary().find(
    (item) => item.id === id,
  );
  if (!backend) {
    return c.json({ error: 'Backend not found' }, 404);
  }
  return c.json(backend);
});

router.put(
  '/backends/:id',
  zValidator('json', UpdateBackendInputSchema),
  async (c) => {
    const id = Number(c.req.param('id'));
    const backend = BackendModel.findById(id);
    if (!backend) {
      return c.json({ error: 'Backend not found' }, 404);
    }

    const updatedBackend = BackendModel.update(id, c.req.valid('json'));
    await ModelCatalogService.handleBackendUpdated(id);
    return c.json(
      ModelCatalogService.getBackendsWithSummary().find(
        (item) => item.id === id,
      ) || updatedBackend,
    );
  },
);

router.delete('/backends/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const success = BackendModel.delete(id);
  if (!success) {
    return c.json({ error: 'Backend not found' }, 404);
  }
  await ModelCatalogService.handleBackendUpdated(id);
  return c.body(null, 204);
});

router.get('/backends/:id/models', (c) => {
  const id = Number(c.req.param('id'));
  const payload = ModelCatalogService.getBackendModelsResponse(id);
  if (!payload) {
    return c.json({ error: 'Backend not found' }, 404);
  }
  return c.json(payload);
});

router.post('/backends/:id/models/refresh', async (c) => {
  const id = Number(c.req.param('id'));
  const backend = BackendModel.findById(id);
  if (!backend) {
    return c.json({ error: 'Backend not found' }, 404);
  }

  if (!backend.is_active) {
    return c.json(
      { error: 'Inactive backends cannot refresh model cache' },
      409,
    );
  }

  const cache = await ModelCatalogService.refreshBackendModels(id, {
    force: true,
    reason: 'admin-manual',
  });
  return c.json({
    backend:
      ModelCatalogService.getBackendsWithSummary().find(
        (item) => item.id === id,
      ) || backend,
    cache,
    snapshots:
      ModelCatalogService.getBackendModelsResponse(id)?.snapshots || [],
    models: ModelCatalogService.getBackendModelsResponse(id)?.models || [],
  });
});

router.get('/models/cache', (c) => {
  return c.json(ModelCatalogService.getCacheOverview());
});

// ============ Permission Management ============

router.get('/permissions', (c) => {
  return c.json(PermissionModel.findAll());
});

router.get('/permissions/user/:userId', (c) => {
  const userId = Number(c.req.param('userId'));
  return c.json(PermissionModel.findByUserId(userId));
});

router.get('/permissions/backend/:backendId', (c) => {
  const backendId = Number(c.req.param('backendId'));
  return c.json(PermissionModel.findByBackendId(backendId));
});

router.post(
  '/permissions',
  zValidator('json', CreatePermissionInputSchema),
  (c) => {
    try {
      const permission = PermissionModel.create(c.req.valid('json'));
      return c.json(permission, 201);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        return c.json({ error: error.message }, 409);
      }
      return c.json({ error: 'Failed to create permission' }, 500);
    }
  },
);

router.delete('/permissions', (c) => {
  const user_id = c.req.query('user_id');
  const backend_id = c.req.query('backend_id');

  if (!user_id || !backend_id) {
    return c.json({ error: 'user_id and backend_id are required' }, 400);
  }

  const success = PermissionModel.delete(Number(user_id), Number(backend_id));
  if (!success) {
    return c.json({ error: 'Permission not found' }, 404);
  }
  return c.body(null, 204);
});

router.get('/model-rewrites', (c) => {
  return c.json(ModelRewriteModel.findAll());
});

router.post(
  '/model-rewrites',
  zValidator('json', CreateModelRewriteInputSchema),
  (c) => {
    try {
      const rule = ModelRewriteModel.create(c.req.valid('json'));
      ModelCatalogService.loadRewriteMap();
      return c.json(rule, 201);
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        return c.json(
          { error: 'Rewrite rule already exists for this source_model' },
          409,
        );
      }
      return c.json({ error: 'Failed to create model rewrite rule' }, 500);
    }
  },
);

router.put(
  '/model-rewrites/:id',
  zValidator('json', UpdateModelRewriteInputSchema),
  (c) => {
    const id = Number(c.req.param('id'));
    const existing = ModelRewriteModel.findById(id);
    if (!existing) {
      return c.json({ error: 'Model rewrite rule not found' }, 404);
    }

    try {
      const updated = ModelRewriteModel.update(id, c.req.valid('json'));
      ModelCatalogService.loadRewriteMap();
      return c.json(updated);
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        return c.json(
          { error: 'Rewrite rule already exists for this source_model' },
          409,
        );
      }
      return c.json({ error: 'Failed to update model rewrite rule' }, 500);
    }
  },
);

router.delete('/model-rewrites/:id', (c) => {
  const id = Number(c.req.param('id'));
  const success = ModelRewriteModel.delete(id);
  if (!success) {
    return c.json({ error: 'Model rewrite rule not found' }, 404);
  }
  ModelCatalogService.loadRewriteMap();
  return c.body(null, 204);
});

// ============ Health Check ============

router.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: getUtcTimestamp() });
});

export default router;
