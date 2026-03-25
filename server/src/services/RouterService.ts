import { Backend } from '../../../shared/types';
import { BackendModel } from '../models/Backend';

export class RouterService {
  private static prepareRequestBody(body?: unknown): string | Uint8Array | ArrayBuffer | undefined {
    if (body === undefined || body === null) {
      return undefined;
    }

    if (typeof body === 'string') {
      return body;
    }

    if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
      return body;
    }

    return JSON.stringify(body);
  }

  static selectBackend(allowedBackendIds: number[]): Backend | null {
    if (allowedBackendIds.length === 0) {
      return null;
    }

    const allBackends = BackendModel.findAll();
    const backends = allBackends
      .filter(b => (b.is_active === true) && allowedBackendIds.includes(b.id));

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
  ): Promise<{ status: number; data: unknown; headers: Record<string, string> }> {
    let backendPath = path;
    if (backend.base_url.includes('/v1')) {
      backendPath = path.replace(/^\/v1/, '');
    }
    
    const backendUrl = backend.base_url.replace(/\/$/, '') + backendPath;

    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };
    const preparedBody = this.prepareRequestBody(body);

    // Always let fetch/undici compute Content-Length from the final outgoing body.
    delete fetchHeaders['content-length'];
    delete fetchHeaders['Content-Length'];

    if (backend.api_key) {
      fetchHeaders['Authorization'] = `Bearer ${backend.api_key}`;
    }

    try {
      const response = await fetch(backendUrl, {
        method,
        headers: fetchHeaders,
        body: preparedBody,
      });

      const data = await response.json().catch(() => ({}));
      const responseHeaders = Object.fromEntries(response.headers.entries());

      return {
        status: response.status,
        data,
        headers: responseHeaders,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // Extract detailed error information from error cause
      let cause: string | undefined;
      let errorType: string;
      
      if (error instanceof Error && error.cause) {
        const causeError = error.cause as any;
        const causeCode = causeError.code || causeError.errno;
        const causeSyscall = causeError.syscall;
        const causeAddress = causeError.address || causeError.hostname;
        const causePort = causeError.port;
        
        if (causeCode === 'ECONNREFUSED') {
          errorType = 'Backend connection refused';
          cause = causeAddress && causePort 
            ? `Backend server at ${causeAddress}:${causePort} is not accepting connections`
            : 'Backend server is not accepting connections';
        } else if (causeCode === 'ETIMEDOUT' || causeCode === 'ECONNABORTED') {
          errorType = 'Backend request timeout';
          cause = 'Connection to backend timed out';
        } else if (causeCode === 'ENOTFOUND') {
          errorType = 'Backend unreachable';
          cause = causeAddress ? `Could not resolve hostname: ${causeAddress}` : 'Could not resolve backend hostname';
        } else if (causeCode === 'EPIPE' || causeSyscall === 'write') {
          errorType = 'Backend connection lost';
          cause = causeSyscall ? `Connection broken during ${causeSyscall} operation` : 'Connection broken during operation';
        } else {
          errorType = 'Backend connection error';
          cause = `${causeCode || 'Unknown error'} during ${causeSyscall || 'connection'}`;
        }
      } else if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('ECONNABORTED')) {
        errorType = 'Backend request timeout';
        cause = 'Connection timed out after 30s';
      } else if (errorMsg.includes('aborted')) {
        errorType = 'Request aborted';
        cause = 'Request was aborted before completion';
      } else {
        errorType = 'Failed to forward request to backend';
        cause = errorMsg;
      }

      const detailedError = {
        error: errorType,
        cause: cause,
        backend: backend.base_url,
        path: path,
      };

      return {
        status: 502,
        data: detailedError,
        headers: {},
      };
    }
  }
}
