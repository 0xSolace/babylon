/**
 * API Fetch Wrapper
 *
 * Rewrites relative /api/ URLs to the backend API server for static deployments.
 */

import { getApiBaseUrl } from '@/config/api';

const API_PREFIXES = ['/api/', '/a2a', '/mcp'] as const;

function isApiUrl(url: string): boolean {
  return API_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function getUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return String(input);
}

function isCrossOrigin(url: string): boolean {
  return (
    typeof window !== 'undefined' && !url.startsWith(window.location.origin)
  );
}

export function rewriteApiUrl(url: string): string {
  if (!isApiUrl(url)) return url;

  const baseUrl = getApiBaseUrl();

  // Don't double /api prefix
  if (baseUrl.endsWith('/api') && url.startsWith('/api/')) {
    return `${baseUrl}${url.slice(4)}`;
  }

  // Don't rewrite same-origin requests
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (baseUrl === origin || baseUrl === `${origin}/api`) {
      return url;
    }
  }

  return `${baseUrl}${url}`;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const originalUrl = getUrlString(input);
  const url = rewriteApiUrl(originalUrl);

  const finalInit: RequestInit = {
    ...init,
    credentials: isCrossOrigin(url)
      ? 'include'
      : init?.credentials || 'same-origin',
  };

  if (typeof input === 'string' || input instanceof URL) {
    return fetch(url, finalInit);
  }

  // Clone Request with new URL
  return fetch(new Request(url, input), finalInit);
}

let patched = false;

export function setupGlobalFetch(): void {
  if (typeof window === 'undefined' || patched) return;

  const originalFetch = window.fetch;

  (window.fetch as (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>) = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url = getUrlString(input);

    if (!isApiUrl(url)) {
      return originalFetch(input, init);
    }

    const rewrittenUrl = rewriteApiUrl(url);
    if (rewrittenUrl === url) {
      return originalFetch(input, init);
    }

    const finalInit: RequestInit = {
      ...init,
      credentials: isCrossOrigin(rewrittenUrl)
        ? 'include'
        : init?.credentials || 'same-origin',
    };

    if (typeof input === 'string' || input instanceof URL) {
      return originalFetch(rewrittenUrl, finalInit);
    }

    // Reconstruct Request with new URL
    return originalFetch(new Request(rewrittenUrl, input), finalInit);
  };

  patched = true;
}

export function resetGlobalFetch(): void {
  patched = false;
}
