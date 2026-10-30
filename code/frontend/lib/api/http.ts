import type { ApiError } from '@interviewlab/core';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: ApiError,
  ) {
    super(detail.message);
    this.name = 'ApiClientError';
  }
}
export const SESSION_CHANGED = 'interviewlab:session-changed';
export const SESSION_INVALIDATED = 'interviewlab:session-invalidated';
export function notifySessionChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_CHANGED));
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(SESSION_CHANGED);
      channel.postMessage('refresh');
      channel.close();
    }
  }
}
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: HeadersInit;
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}
function isApiError(value: unknown): value is ApiError {
  if (!value || typeof value !== 'object') return false;
  const error = value as Record<string, unknown>;
  return (
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    typeof error.retryable === 'boolean' &&
    typeof error.request_id === 'string'
  );
}
/** Browser-only HTTP transport. No token storage, redirects or automatic write retries. */
export function createApiClient(fetcher: typeof fetch = (...args) => fetch(...args)) {
  return async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const target = new URL('/api/v1' + path, 'http://same-origin.invalid');
    if (
      !path.startsWith('/') ||
      path.startsWith('//') ||
      path.includes('\\') ||
      target.hash ||
      !target.pathname.startsWith('/api/v1/')
    )
      throw new Error('Use a path relative to /api/v1');
    const headers = new Headers(options.headers);
    headers.set('accept', 'application/json');
    if (options.body !== undefined) headers.set('content-type', 'application/json');
    if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
    const timeout = AbortSignal.timeout(options.timeoutMs ?? 10000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    let response: Response | undefined;
    let data: unknown;
    try {
      response = await fetcher(target.pathname + target.search, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        signal,
      });
      if (response.status === 204) return undefined as T;
      if (response.headers.get('content-type')?.includes('application/json'))
        data = await response.json().catch((error) => {
          if (signal.aborted) throw error;
          return undefined;
        });
    } catch {
      if (options.signal?.aborted) throw options.signal.reason;
      throw new ApiClientError(response?.status ?? 0, {
        code: timeout.aborted ? 'request_timeout' : 'backend_unavailable',
        message: timeout.aborted ? '请求超时，请稍后重试。' : '暂时无法连接服务，请稍后重试。',
        retryable: true,
        request_id: response?.headers.get('x-request-id') ?? '',
      });
    }
    if (!response.ok) {
      if (response.status === 401 && !path.startsWith('/auth/') && typeof window !== 'undefined')
        window.dispatchEvent(new Event(SESSION_INVALIDATED));
      throw new ApiClientError(
        response.status,
        isApiError(data)
          ? data
          : {
              code: 'http_error',
              message: '请求未能完成，请稍后重试。',
              retryable: response.status >= 500 || response.status === 429,
              request_id: response.headers.get('x-request-id') ?? '',
            },
      );
    }
    if (data === undefined)
      throw new ApiClientError(response.status, {
        code: 'invalid_response',
        message: '服务返回了无法识别的响应。',
        retryable: false,
        request_id: response.headers.get('x-request-id') ?? '',
      });
    return data as T;
  };
}
export const apiRequest = createApiClient();

/** Same-origin cookie transport for server events; no separate identity or token client. */
export function apiEvents(path: string): EventSource {
  const url = new URL('/api/v1' + path, window.location.origin);
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    url.origin !== window.location.origin ||
    !url.pathname.startsWith('/api/v1/')
  )
    throw new Error('Use a relative API event path');
  return new EventSource(url.pathname + url.search);
}
