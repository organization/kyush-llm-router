import type { Hono } from 'hono';

export interface TestResponse {
  status: number;
  body: any;
  text: string;
  headers: Record<string, string>;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface CookieJar {
  get(): Map<string, string>;
  update(setCookie: string[]): void;
}

function parseSetCookie(
  setCookie: string[],
): { key: string; value: string; expired: boolean }[] {
  return setCookie.map((sc) => {
    const eq = sc.indexOf('=');
    const semi = sc.indexOf(';');
    const key = sc.slice(0, eq);
    const value = sc.slice(eq + 1, semi === -1 ? undefined : semi);
    const expired = /Max-Age=0\b/.test(sc);
    return { key, value, expired };
  });
}

function createCookieJar(): CookieJar {
  const cookies = new Map<string, string>();
  return {
    get: () => cookies,
    update: (setCookie: string[]) => {
      for (const { key, value, expired } of parseSetCookie(setCookie)) {
        if (expired || value === '') {
          cookies.delete(key);
        } else {
          cookies.set(key, value);
        }
      }
    },
  };
}

export class TestRequest implements PromiseLike<TestResponse> {
  private _headers: Record<string, string> = {};
  private _body?: unknown;
  private _expectedStatus?: number;

  constructor(
    private app: Hono,
    private method: HttpMethod,
    private path: string,
    private cookieJar?: CookieJar,
  ) {}

  set(key: string, value: string): this {
    this._headers[key.toLowerCase()] = value;
    return this;
  }

  send(body: unknown): this {
    this._body = body;
    return this;
  }

  expect(status: number): this {
    this._expectedStatus = status;
    return this;
  }

  private buildRequestInit(): RequestInit {
    const headers: Record<string, string> = { ...this._headers };
    if (this.cookieJar) {
      const jar = this.cookieJar.get();
      if (jar.size > 0) {
        headers.cookie = Array.from(jar.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');
      }
    }

    const init: RequestInit = { method: this.method, headers };
    if (this._body !== undefined && this._body !== null) {
      headers['content-type'] = headers['content-type'] || 'application/json';
      init.body =
        typeof this._body === 'string'
          ? this._body
          : JSON.stringify(this._body);
    }
    return init;
  }

  private async execute(): Promise<TestResponse> {
    const init = this.buildRequestInit();
    const url = `http://localhost${this.path.startsWith('/') ? this.path : `/${this.path}`}`;
    const res = await this.app.request(url, init);
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }

    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });

    if (this.cookieJar) {
      const setCookie =
        typeof res.headers.getSetCookie === 'function'
          ? res.headers.getSetCookie()
          : res.headers.get('set-cookie')
            ? [res.headers.get('set-cookie')!]
            : [];
      if (setCookie.length > 0) {
        this.cookieJar.update(setCookie);
      }
    }

    if (
      this._expectedStatus !== undefined &&
      res.status !== this._expectedStatus
    ) {
      throw new Error(
        `Expected status ${this._expectedStatus} but got ${res.status}. Body: ${text.slice(0, 500)}`,
      );
    }

    return { status: res.status, body, text, headers };
  }

  then<TResult1 = TestResponse, TResult2 = never>(
    onFulfilled?:
      | ((value: TestResponse) => TResult1 | PromiseLike<TResult1>)
      | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onFulfilled ?? null, onRejected ?? null);
  }
}

export interface TestAgent {
  get: (path: string) => TestRequest;
  post: (path: string) => TestRequest;
  put: (path: string) => TestRequest;
  delete: (path: string) => TestRequest;
}

function createAgent(app: Hono): TestAgent {
  const jar = createCookieJar();
  return {
    get: (path: string) => new TestRequest(app, 'GET', path, jar),
    post: (path: string) => new TestRequest(app, 'POST', path, jar),
    put: (path: string) => new TestRequest(app, 'PUT', path, jar),
    delete: (path: string) => new TestRequest(app, 'DELETE', path, jar),
  };
}

interface RequestFactory {
  (app: Hono): {
    get: (path: string) => TestRequest;
    post: (path: string) => TestRequest;
    put: (path: string) => TestRequest;
    delete: (path: string) => TestRequest;
  };
  agent: (app: Hono) => TestAgent;
}

const request: RequestFactory = ((app: Hono) => ({
  get: (path: string) => new TestRequest(app, 'GET', path),
  post: (path: string) => new TestRequest(app, 'POST', path),
  put: (path: string) => new TestRequest(app, 'PUT', path),
  delete: (path: string) => new TestRequest(app, 'DELETE', path),
})) as RequestFactory;

request.agent = createAgent;

export default request;
export { request };
