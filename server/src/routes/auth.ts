import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/User';
import { PermissionModel } from '../models/Permission';
import { User } from '../../../shared/types';

export interface AuthenticatedRequest extends Request {
  user?: User;
  allowedBackendIds?: number[];
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const apiKey = authHeader.substring(7);
  const user = UserModel.findByApiKey(apiKey);

  if (!user) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  req.user = user;
  req.allowedBackendIds = PermissionModel.getUserBackendIds(user.id);
  next();
}

export function requireBackendPermission(backendId?: number) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const targetBackendId = backendId || Number(req.params.backendId);

    if (!req.allowedBackendIds?.includes(targetBackendId)) {
      res.status(403).json({ error: 'Access denied to this backend' });
      return;
    }

    next();
  };
}
