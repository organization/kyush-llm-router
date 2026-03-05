import { Backend } from '../../../shared/types';
import { BackendModel } from '../models/Backend';

export class RouterService {
  static selectBackend(allowedBackendIds: number[]): Backend | null {
    if (allowedBackendIds.length === 0) {
      return null;
    }

    const backends = BackendModel.findAll()
      .filter(b => b.is_active && allowedBackendIds.includes(b.id));

    if (backends.length === 0) {
      return null;
    }

    const roundRobinIndex = Math.floor(Math.random() * backends.length);
    return backends[roundRobinIndex];
  }

  static async forwardRequest(
    backend: Backend,
    path: string,
    method: string,
    headers: Record<string, string>,
    body?: unknown
  ): Promise<{ status: number; data: unknown }> {
    const backendUrl = backend.base_url.replace(/\/$/, '') + path;

    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (backend.api_key) {
      fetchHeaders['Authorization'] = `Bearer ${backend.api_key}`;
    }

    try {
      const response = await fetch(backendUrl, {
        method,
        headers: fetchHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json().catch(() => ({}));

      return {
        status: response.status,
        data,
      };
    } catch (error) {
      return {
        status: 502,
        data: { error: 'Failed to forward request to backend' },
      };
    }
  }
}
