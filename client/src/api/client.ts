import type { User, Backend, Permission, RequestLog, UsageStats, BackendMetrics, UserScript, CreateScriptData, UpdateScriptData } from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  users: {
    getAll: (): Promise<User[]> => fetchJson<User[]>(`${API_BASE}/admin/users`),
    getById: (id: number): Promise<User> => fetchJson<User>(`${API_BASE}/admin/users/${id}`),
    create: (data: { name: string; email?: string }): Promise<User> =>
      fetchJson<User>(`${API_BASE}/admin/users`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<User>): Promise<User> =>
      fetchJson<User>(`${API_BASE}/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number): Promise<void> =>
      fetchJson<void>(`${API_BASE}/admin/users/${id}`, { method: 'DELETE' }),
    regenerateApiKey: (id: number): Promise<User> =>
      fetchJson<User>(`${API_BASE}/admin/users/${id}/regenerate-api-key`, { method: 'POST' }),
  },

  backends: {
    getAll: (): Promise<Backend[]> => fetchJson<Backend[]>(`${API_BASE}/admin/backends`),
    getById: (id: number): Promise<Backend> => fetchJson<Backend>(`${API_BASE}/admin/backends/${id}`),
    create: (data: { name: string; base_url: string; api_key?: string }): Promise<Backend> =>
      fetchJson<Backend>(`${API_BASE}/admin/backends`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Backend>): Promise<Backend> =>
      fetchJson<Backend>(`${API_BASE}/admin/backends/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number): Promise<void> =>
      fetchJson<void>(`${API_BASE}/admin/backends/${id}`, { method: 'DELETE' }),
  },

  permissions: {
    getAll: (): Promise<Permission[]> => fetchJson<Permission[]>(`${API_BASE}/admin/permissions`),
    getByUser: (userId: number): Promise<Permission[]> =>
      fetchJson<Permission[]>(`${API_BASE}/admin/permissions/user/${userId}`),
    getByBackend: (backendId: number): Promise<Permission[]> =>
      fetchJson<Permission[]>(`${API_BASE}/admin/permissions/backend/${backendId}`),
    create: (data: { user_id: number; backend_id: number }): Promise<Permission> =>
      fetchJson<Permission>(`${API_BASE}/admin/permissions`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (userId: number, backendId: number): Promise<void> =>
      fetchJson<void>(`${API_BASE}/admin/permissions?user_id=${userId}&backend_id=${backendId}`, { method: 'DELETE' }),
  },

  scripts: {
    getAll: (): Promise<UserScript[]> => fetchJson<UserScript[]>(`${API_BASE}/admin/scripts`),
    getById: (id: number): Promise<UserScript> => fetchJson<UserScript>(`${API_BASE}/admin/scripts/${id}`),
    create: (data: CreateScriptData): Promise<UserScript> =>
      fetchJson<UserScript>(`${API_BASE}/admin/scripts`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: UpdateScriptData): Promise<UserScript> =>
      fetchJson<UserScript>(`${API_BASE}/admin/scripts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number): Promise<void> =>
      fetchJson<void>(`${API_BASE}/admin/scripts/${id}`, { method: 'DELETE' }),
    activate: (id: number): Promise<UserScript> =>
      fetchJson<UserScript>(`${API_BASE}/admin/scripts/${id}/activate`, { method: 'POST' }),
    deactivate: (id: number): Promise<UserScript> =>
      fetchJson<UserScript>(`${API_BASE}/admin/scripts/${id}/deactivate`, { method: 'POST' }),
    test: (id: number, context: { user?: User; backend?: Backend; request: { method: string; path: string; headers: Record<string, string>; body: unknown; isStream: boolean } }): Promise<{ success: boolean; error?: string; executionTime?: number }> =>
      fetchJson(`${API_BASE}/admin/scripts/${id}/test`, { method: 'POST', body: JSON.stringify(context) }),
  },

  analytics: {
    getUsage: (userId?: number, backendId?: number, days: number = 30): Promise<UsageStats[]> => {
      const params = new URLSearchParams();
      if (userId) params.append('userId', String(userId));
      if (backendId) params.append('backendId', String(backendId));
      params.append('days', String(days));
      return fetchJson<UsageStats[]>(`${API_BASE}/admin/analytics/usage?${params}`);
    },
    getRequests: (limit: number = 100, offset: number = 0): Promise<RequestLog[]> =>
      fetchJson<RequestLog[]>(`${API_BASE}/admin/analytics/requests?limit=${limit}&offset=${offset}`),
    getMetrics: (backendId?: number, days: number = 30): Promise<BackendMetrics[]> => {
      const params = new URLSearchParams();
      if (backendId) params.append('backendId', String(backendId));
      params.append('days', String(days));
      return fetchJson<BackendMetrics[]>(`${API_BASE}/admin/analytics/metrics?${params}`);
    },
  },
};
