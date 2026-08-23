/**
 * The ONLY place in the app allowed to call fetch() against the election
 * API. Every other module must go through `apiRequest`.
 *
 * Responsibilities: build the URL (base + explicit tenantId when needed),
 * enforce a request timeout, unwrap the success/failure envelope, and retry transient
 * failures. It does NOT decide how errors are presented — that's
 * errors.ts's job. This module only returns data or throws a typed error.
 *
 * Deliberately does NOT send a Cache-Control request header: the staging
 * API's CORS policy only allows Content-Type/Authorization, so a
 * Cache-Control header fails the browser's preflight silently (the actual
 * request never gets sent, no server-side log entry, UI just shows a
 * generic network error). It's also unnecessary — POSTs are never
 * browser-cached regardless of headers.
 */

import type { ApiEnvelope, ApiErrorCode } from './types';
import { NETWORK_ERROR_CODE, type ClientErrorCode } from './errors';

const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAYS_MS = [1_000, 3_000, 8_000];

export class ApiRequestError extends Error {
  readonly code: ClientErrorCode;
  readonly status?: number;

  constructor(code: ClientErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  /** Bearer token for authenticated calls (e.g. cast-vote). */
  token?: string;
  /** Tenant context for tenant-scoped REST endpoints. */
  tenantId?: string;
  /** Fetch cache mode, primarily `no-store` for public tenant configuration. */
  cache?: RequestCache;
  /**
   * Next.js ISR window in seconds for this request, forwarded as
   * `next: { revalidate }`. Only meaningful for GETs made from a Server
   * Component/route — ignored by the browser's fetch implementation.
   */
  revalidate?: number;
}

export interface ApiResult<T, M = undefined> {
  data: T;
  meta?: M;
}

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured');
  }
  return baseUrl;
}

function buildUrl(
  path: string,
  query?: ApiRequestOptions['query'],
  tenantId?: string
): string {
  const url = new URL(path.replace(/^\//, ''), ensureTrailingSlash(getApiBaseUrl()));

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  if (tenantId) {
    url.searchParams.set('tenantId', tenantId);
  }
  return url.toString();
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function isRetryable(code: ClientErrorCode): boolean {
  return code === NETWORK_ERROR_CODE || code === 'INTERNAL';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function performFetch<T, M>(
  url: string,
  init: RequestInit
): Promise<ApiResult<T, M>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiRequestError(NETWORK_ERROR_CODE, 'Request timed out');
    }
    throw new ApiRequestError(NETWORK_ERROR_CODE, 'Unable to reach the server');
  } finally {
    clearTimeout(timeoutId);
  }

  let envelope: ApiEnvelope<T, M>;
  try {
    envelope = await response.json();
  } catch {
    throw new ApiRequestError(
      NETWORK_ERROR_CODE,
      'Received an unreadable response from the server',
      response.status
    );
  }

  if (envelope.success) {
    return { data: envelope.data, meta: envelope.meta };
  }

  throw new ApiRequestError(
    envelope.error.code as ApiErrorCode,
    envelope.error.message,
    response.status
  );
}

export async function apiRequest<T, M = undefined>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<ApiResult<T, M>> {
  const url = buildUrl(path, options.query, options.tenantId);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const init: RequestInit & { next?: { revalidate?: number } } = {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    ...(options.cache !== undefined ? { cache: options.cache } : {}),
    ...(options.revalidate !== undefined ? { next: { revalidate: options.revalidate } } : {}),
  };

  let lastError: ApiRequestError | undefined;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await performFetch<T, M>(url, init);
    } catch (err) {
      const apiError =
        err instanceof ApiRequestError
          ? err
          : new ApiRequestError(NETWORK_ERROR_CODE, 'Unable to reach the server');

      lastError = apiError;

      const isLastAttempt = attempt === RETRY_DELAYS_MS.length;
      if (isLastAttempt || !isRetryable(apiError.code)) {
        throw apiError;
      }

      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  // Unreachable — the loop above always returns or throws — but keeps
  // TypeScript satisfied about the function's return type.
  throw lastError ?? new ApiRequestError(NETWORK_ERROR_CODE, 'Unable to reach the server');
}
