import { Router, Request, Response } from 'express';
import { UserModel } from '../models/User';
import { BackendModel } from '../models/Backend';
import { PermissionModel } from '../models/Permission';
import scriptRoutes from './scripts';
import { CreateUserData, CreateBackendData, CreatePermissionData, UpdateUserData, UpdateBackendData } from '../../../shared/types';
import { getUtcTimestamp } from '../utils/time';

const router: Router = Router();

router.use('/scripts', scriptRoutes);

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
  const backends = BackendModel.findAll();
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
  const backend = BackendModel.findById(id);

  if (!backend) {
    res.status(404).json({ error: 'Backend not found' });
    return;
  }

  res.json(backend);
});

router.put('/backends/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const backend = BackendModel.findById(id);

  if (!backend) {
    res.status(404).json({ error: 'Backend not found' });
    return;
  }

  const { name, base_url, api_key, is_active, detail_logging } = req.body as UpdateBackendData;
  const updatedBackend = BackendModel.update(id, { name, base_url, api_key, is_active, detail_logging });

  res.json(updatedBackend);
});

router.delete('/backends/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const success = BackendModel.delete(id);

  if (!success) {
    res.status(404).json({ error: 'Backend not found' });
    return;
  }

  res.status(204).send();
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

// ============ Health Check ============

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: getUtcTimestamp() });
});

export default router;
