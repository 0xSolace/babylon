import { setTimeout as delay } from 'node:timers/promises';

const DEFAULT_BASE_URL =
  process.env.TEST_API_URL ||
  process.env.TEST_BASE_URL ||
  'http://localhost:3000';

export async function waitForServerAvailability(
  baseUrl: string = DEFAULT_BASE_URL,
  attempts: number = 10,
  timeoutMs: number = 5000
): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      });
      if (response.ok) {
        return true;
      }
    } catch {}

    if (attempt < attempts) {
      await delay(1000);
    }
  }

  return false;
}

export async function waitForEndpointAvailability(
  url: string,
  init: RequestInit,
  isAvailable: (response: Response) => boolean,
  attempts: number = 10,
  timeoutMs: number = 5000
): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (isAvailable(response)) {
        return true;
      }
    } catch {}

    if (attempt < attempts) {
      await delay(1000);
    }
  }

  return false;
}

export function requireServer(
  serverAvailable: boolean,
  baseUrl: string = DEFAULT_BASE_URL
): void {
  if (!serverAvailable) {
    throw new Error(`Integration test requires a live server at ${baseUrl}`);
  }
}

export function requireAuth(
  serverAvailable: boolean,
  devAdminToken: string | null,
  baseUrl: string = DEFAULT_BASE_URL
): void {
  requireServer(serverAvailable, baseUrl);
  if (!devAdminToken) {
    throw new Error(
      'Integration test requires a dev admin token for authenticated coverage'
    );
  }
}
