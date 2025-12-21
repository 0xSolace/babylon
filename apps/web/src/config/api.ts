/**
 * API Configuration for Babylon
 *
 * Centralized API configuration for the decentralized frontend.
 * The frontend is deployed to IPFS/CloudFront and calls the API backend at a separate URL.
 */

function getHostname(): string | null {
  return typeof window !== 'undefined' ? window.location.hostname : null;
}

function isProductionHost(hostname: string | null): boolean {
  if (!hostname) return false;
  return hostname === 'babylon.market' || hostname.endsWith('.babylon.market');
}

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  const hostname = getHostname();
  if (!hostname) {
    if (process.env.API_BASE_URL) {
      return process.env.API_BASE_URL;
    }
    return 'http://localhost:5007';
  }

  if (isProductionHost(hostname)) return 'https://api.babylon.market';
  if (hostname.includes('testnet')) return 'https://api.testnet.babylon.market';
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${window.location.protocol}//${window.location.host}`;
  }

  return window.location.origin;
}

export function getIpfsGatewayUrl(): string {
  if (process.env.NEXT_PUBLIC_IPFS_GATEWAY)
    return process.env.NEXT_PUBLIC_IPFS_GATEWAY;
  if (isProductionHost(getHostname())) return 'https://ipfs.babylon.market';
  if (process.env.JEJU_STORAGE_SERVICE_URL) {
    return process.env.JEJU_STORAGE_SERVICE_URL;
  }
  return 'https://ipfs.jeju.network';
}

export function getStorageApiUrl(): string {
  if (process.env.NEXT_PUBLIC_STORAGE_API_URL)
    return process.env.NEXT_PUBLIC_STORAGE_API_URL;
  if (isProductionHost(getHostname())) return 'https://storage.babylon.market';
  if (process.env.JEJU_STORAGE_SERVICE_URL) {
    return process.env.JEJU_STORAGE_SERVICE_URL;
  }
  return 'http://localhost:5001';
}

export function getWsBaseUrl(): string {
  return getApiBaseUrl().replace(/^http/, 'ws');
}

export const API_ENDPOINTS = {
  auth: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    session: '/api/auth/session',
    verify: '/api/auth/verify',
  },
  game: {
    state: '/api/game/state',
    tick: '/api/game/tick',
    agents: '/api/game/agents',
    card: '/api/game/card',
  },
  markets: {
    list: '/api/markets',
    create: '/api/markets/create',
    resolve: '/api/markets/resolve',
    bet: '/api/markets/bet',
  },
  feed: {
    posts: '/api/feed/posts',
    trending: '/api/feed/trending',
    create: '/api/posts/create',
  },
  profile: {
    me: '/api/profile/me',
    update: '/api/profile/update',
    portfolio: '/api/portfolio',
  },
  agents: {
    list: '/api/agents',
    register: '/api/agents/register',
    status: '/api/agents/status',
  },
  sse: {
    feed: '/api/sse/feed',
    markets: '/api/sse/markets',
    game: '/api/sse/game',
  },
  a2a: { endpoint: '/a2a', discover: '/a2a/.well-known/agent.json' },
  mcp: { endpoint: '/mcp' },
  health: '/api/health',
} as const;

export function buildApiUrl(
  endpoint: string,
  params?: Record<string, string | number | boolean>
): string {
  const url = new URL(endpoint, getApiBaseUrl());
  if (params) {
    Object.entries(params).forEach(([k, v]) =>
      url.searchParams.set(k, String(v))
    );
  }
  return url.toString();
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(buildApiUrl(endpoint), {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `API ${response.status}: ${errorBody || response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

export const apiConfig = {
  getBaseUrl: getApiBaseUrl,
  getIpfsGateway: getIpfsGatewayUrl,
  getStorageApi: getStorageApiUrl,
  getWsUrl: getWsBaseUrl,
  endpoints: API_ENDPOINTS,
  buildUrl: buildApiUrl,
  fetch: apiFetch,
} as const;

export default apiConfig;
