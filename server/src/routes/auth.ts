import { UserModel } from '../models/User';
import { PermissionModel } from '../models/Permission';

import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types/hono';

export const authenticate: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401);
  }

  const apiKey = authHeader.substring(7);
  const user = UserModel.findByApiKey(apiKey);

  if (!user) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  c.set('user', user);
  c.set('allowedBackendIds', PermissionModel.getUserBackendIds(user.id));
  await next();
  return;
};
