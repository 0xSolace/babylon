/**
 * Central API client
 *
 * - Adds Authorization Bearer if a token provider is configured
 * - Handles Privy identity token via a dedicated provider
 * - Sends http-only cookies when possible (credentials: include)
 * - Normalizes errors into ApiRequestError
 *
 * can be moved to packages/shared/infra later.
 */

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? '';

// Providers injected by the app (e.g., useAuth)
let accessTokenProvider: (() => Promise<string | null>) | null = null;
let identityTokenProvider: (() => Promise<string | null>) | null = null;

export interface ApiErrorShape {
  code: string;
  message: string;
}

export class ApiRequestError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  auth?: boolean;
  withIdentityToken?: boolean;
  baseUrl?: string;
  autoRetryOn401?: boolean;
  body?: unknown;
}

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiErrorShape };

/** Configure the access token provider (exposed by useAuth). */
export function setAccessTokenProvider(provider: () => Promise<string | null>) {
  accessTokenProvider = provider;
}

/** Configure the identity token provider (Privy ID token). */
export function setIdentityTokenProvider(
  provider: () => Promise<string | null>
) {
  identityTokenProvider = provider;
}

/** Main API client */
export async function api<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    headers,
    auth = true,
    withIdentityToken = false,
    baseUrl = DEFAULT_BASE_URL,
    autoRetryOn401 = true,
    ...rest
  } = options;

  const resolvedUrl = resolveUrl(path, baseUrl);
  const finalHeaders = new Headers(headers ?? {});

  // Set Content-Type only for JSON bodies (not for FormData/Blob/etc.)
  const isJsonBody =
    body !== undefined &&
    !(body instanceof FormData) &&
    !(body instanceof Blob);
  if (isJsonBody && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  if (auth && !finalHeaders.has('Authorization')) {
    const token = await accessTokenProvider?.();
    if (token) {
      finalHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  if (withIdentityToken && !finalHeaders.has('privy-id-token')) {
    const idToken = await identityTokenProvider?.();
    if (idToken) {
      finalHeaders.set('privy-id-token', idToken);
    }
  }

  let response = await fetch(resolvedUrl, {
    ...rest,
    method,
    headers: finalHeaders,
    body:
      isJsonBody && body !== undefined
        ? JSON.stringify(body)
        : (body as BodyInit | undefined),
    credentials: auth ? 'include' : (rest.credentials ?? 'same-origin'),
  });

  // Single retry on 401 by forcing a token refresh via provider
  if (response.status === 401 && auth && autoRetryOn401) {
    const freshToken = await accessTokenProvider?.();
    if (freshToken) {
      finalHeaders.set('Authorization', `Bearer ${freshToken}`);
      response = await fetch(resolvedUrl, {
        ...rest,
        method,
        headers: finalHeaders,
        body:
          isJsonBody && body !== undefined
            ? JSON.stringify(body)
            : (body as BodyInit | undefined),
        credentials: 'include',
      });
    }
  }

  const parsed = await safeParseJson(response);

  if (!response.ok) {
    const errorPayload = normalizeError(parsed);
    throw new ApiRequestError(
      errorPayload.message,
      errorPayload.code,
      response.status
    );
  }

  return (parsed ?? {}) as T;
}

function resolveUrl(path: string, baseUrl: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

async function safeParseJson(response: Response): Promise<unknown | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeError(payload: unknown): ApiErrorShape {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    payload.error &&
    typeof (payload as { error: unknown }).error === 'object'
  ) {
    const error = (payload as { error: Record<string, unknown> }).error;
    return {
      code: typeof error.code === 'string' ? error.code : 'UNKNOWN',
      message:
        typeof error.message === 'string' ? error.message : 'An error occurred',
    };
  }

  return {
    code: 'UNKNOWN',
    message: 'An error occurred',
  };
}
