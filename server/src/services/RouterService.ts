import { BackendModel } from '../models/Backend';

import type { Backend } from '../../../shared/types';

interface BackendForwardError {
  error: string;
  cause?: string;
  backend: string;
  path: string;
}

interface ErrorCauseShape {
  code?: string;
  errno?: string;
  syscall?: string;
  address?: string;
  hostname?: string;
  port?: number;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Coerces an unknown error.cause field into the small subset of fields we
 * actually look at when classifying upstream connection failures. Falls back
 * to an empty object so callers can read fields without nullish guards.
 */
const readErrorCause = (cause: unknown): ErrorCauseShape => {
  if (!isObject(cause)) return {};
  return {
    code: typeof cause.code === 'string' ? cause.code : undefined,
    errno: typeof cause.errno === 'string' ? cause.errno : undefined,
    syscall: typeof cause.syscall === 'string' ? cause.syscall : undefined,
    address:
      typeof cause.address === 'string'
        ? cause.address
        : typeof cause.hostname === 'string'
          ? cause.hostname
          : undefined,
    port: typeof cause.port === 'number' ? cause.port : undefined,
  };
};

/**
 * Translates an upstream fetch failure into a structured `{ error, cause }`
 * pair. Used by both the JSON and SSE forwarding paths so the message
 * surface stays consistent across them.
 */
const classifyForwardError = (
  error: unknown,
): { error: string; cause?: string } => {
  const errorMsg = error instanceof Error ? error.message : 'Unknown error';

  if (error instanceof Error && error.cause !== undefined) {
    const cause = readErrorCause(error.cause);
    const code = cause.code ?? cause.errno;

    if (code === 'ECONNREFUSED') {
      return {
        error: 'Backend connection refused',
        cause:
          cause.address && cause.port
            ? `Backend server at ${cause.address}:${cause.port} is not accepting connections`
            : 'Backend server is not accepting connections',
      };
    }
    if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
      return {
        error: 'Backend request timeout',
        cause: 'Connection to backend timed out',
      };
    }
    if (code === 'ENOTFOUND') {
      return {
        error: 'Backend unreachable',
        cause: cause.address
          ? `Could not resolve hostname: ${cause.address}`
          : 'Could not resolve backend hostname',
      };
    }
    if (code === 'EPIPE' || cause.syscall === 'write') {
      return {
        error: 'Backend connection lost',
        cause: cause.syscall
          ? `Connection broken during ${cause.syscall} operation`
          : 'Connection broken during operation',
      };
    }
    return {
      error: 'Backend connection error',
      cause: `${code ?? 'Unknown error'} during ${cause.syscall ?? 'connection'}`,
    };
  }

  if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('ECONNABORTED')) {
    return {
      error: 'Backend request timeout',
      cause: 'Connection timed out after 30s',
    };
  }
  if (errorMsg.includes('aborted')) {
    return {
      error: 'Request aborted',
      cause: 'Request was aborted before completion',
    };
  }
  return { error: 'Failed to forward request to backend', cause: errorMsg };
};

const buildForwardErrorPayload = (
  backend: Backend,
  path: string,
  error: unknown,
): BackendForwardError => {
  const { error: errorType, cause } = classifyForwardError(error);
  return { error: errorType, cause, backend: backend.base_url, path };
};

const prepareRequestBody = (
  body?: unknown,
): string | Uint8Array | ArrayBuffer | undefined => {
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array || body instanceof ArrayBuffer) return body;
  return JSON.stringify(body);
};

const rawFetch = async (
  backend: Backend,
  path: string,
  method: string,
  headers: Record<string, string>,
  body?: unknown,
): Promise<Response> => {
  const backendPath = backend.base_url.includes('/v1')
    ? path.replace(/^\/v1/, '')
    : path;
  const backendUrl = backend.base_url.replace(/\/$/, '') + backendPath;

  const fetchHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  const preparedBody = prepareRequestBody(body);

  // Always let fetch/undici compute Content-Length from the final outgoing body.
  delete fetchHeaders['content-length'];
  delete fetchHeaders['Content-Length'];
  delete fetchHeaders.authorization;
  delete fetchHeaders.Authorization;
  delete fetchHeaders['content-type'];
  delete fetchHeaders['Content-Type'];

  if (preparedBody !== undefined) {
    fetchHeaders['Content-Type'] = 'application/json';
  }

  if (backend.api_key) {
    fetchHeaders.Authorization = `Bearer ${backend.api_key}`;
  }

  return fetch(backendUrl, {
    method,
    headers: fetchHeaders,
    body: preparedBody,
  });
};

export const RouterService = {
  selectBackend(allowedBackendIds: number[]): Backend | null {
    if (allowedBackendIds.length === 0) return null;

    const backends = BackendModel.findAll().filter(
      (b) => b.is_active === true && allowedBackendIds.includes(b.id),
    );
    if (backends.length === 0) return null;

    const roundRobinIndex = Math.floor(Math.random() * backends.length);
    return backends[roundRobinIndex];
  },

  async forwardRequest(
    backend: Backend,
    path: string,
    method: string,
    headers: Record<string, string>,
    body?: unknown,
  ): Promise<{
    status: number;
    data: unknown;
    headers: Record<string, string>;
  }> {
    try {
      const response = await rawFetch(backend, path, method, headers, body);
      const data: unknown = await response.json().catch(() => ({}));
      const responseHeaders = Object.fromEntries(response.headers.entries());
      return { status: response.status, data, headers: responseHeaders };
    } catch (error) {
      return {
        status: 502,
        data: buildForwardErrorPayload(backend, path, error),
        headers: {},
      };
    }
  },

  async forwardStreamRequest(
    backend: Backend,
    path: string,
    method: string,
    headers: Record<string, string>,
    body?: unknown,
  ): Promise<
    | { response: Response }
    | { status: number; data: unknown; headers: Record<string, string> }
  > {
    try {
      const response = await rawFetch(backend, path, method, headers, body);
      return { response };
    } catch (error) {
      return {
        status: 502,
        data: buildForwardErrorPayload(backend, path, error),
        headers: {},
      };
    }
  },
};
