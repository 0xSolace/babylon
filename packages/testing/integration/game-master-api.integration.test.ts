import { beforeAll, describe, expect, test } from 'bun:test';
import { getDevCredentials } from '@babylon/api';

const BASE_URL =
  process.env.TEST_API_URL ||
  process.env.TEST_BASE_URL ||
  'http://localhost:3000';

let serverAvailable = false;
let devAdminToken: string | null = null;
let cronSecret: string | null = null;

function requireServer(): void {
  if (!serverAvailable) {
    throw new Error(`TEST SKIPPED: Server not available at ${BASE_URL}`);
  }
}

async function adminRequest(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (devAdminToken) headers['x-dev-admin-token'] = devAdminToken;

  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(20000),
  });
}

async function cronRequest(path: string, options: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cronSecret}`,
      ...(options.headers as Record<string, string>),
    },
    signal: AbortSignal.timeout(30000),
  });
}

describe('Game Master Halliday API', () => {
  beforeAll(async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/health`, {
        signal: AbortSignal.timeout(5000),
      });
      serverAvailable = response.ok;
    } catch {
      serverAvailable = false;
    }

    const creds = getDevCredentials();
    devAdminToken = creds?.devAdminToken ?? null;
    cronSecret = process.env.CRON_SECRET || creds?.cronSecret || null;
  });

  test('GET /api/admin/game-master returns dashboard data', async () => {
    requireServer();

    const response = await adminRequest('/api/admin/game-master');
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(typeof payload.enabled).toBe('boolean');
    expect(typeof payload.autoRunEnabled).toBe('boolean');
    expect(Array.isArray(payload.latestRuns)).toBe(true);
    expect(Array.isArray(payload.pendingActions)).toBe(true);
    expect(Array.isArray(payload.activeDirectives)).toBe(true);
    expect(Array.isArray(payload.recentMessages)).toBe(true);
  });

  test('POST /api/admin/game-master can trigger a manual pulse', async () => {
    requireServer();

    const response = await adminRequest('/api/admin/game-master', {
      method: 'POST',
      body: JSON.stringify({ action: 'run_pulse' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(
      payload.runType === 'pulse' ||
        payload.runType === 'reactive' ||
        payload.runType === null
    ).toBe(true);
  });

  test('GET /api/cron/game-master-tick executes with cron auth', async () => {
    requireServer();
    if (!cronSecret) {
      throw new Error('TEST SKIPPED: No cron secret available');
    }

    const response = await cronRequest('/api/cron/game-master-tick');
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(typeof payload.success).toBe('boolean');
    expect(
      payload.runType === 'daily' ||
        payload.runType === 'pulse' ||
        payload.runType === 'reactive' ||
        payload.runType === null
    ).toBe(true);
  });

  test('POST /api/admin/game-master/actions/:id/retry rejects non-failed actions', async () => {
    requireServer();

    const dashboardResponse = await adminRequest('/api/admin/game-master');
    const dashboard = await dashboardResponse.json();

    expect(dashboardResponse.status).toBe(200);

    const nonFailedAction = dashboard.pendingActions.find(
      (action: { id: string; status: string }) => action.status !== 'failed'
    );

    if (!nonFailedAction) {
      throw new Error(
        'TEST SKIPPED: No non-failed Game Master action available'
      );
    }

    const retryResponse = await adminRequest(
      `/api/admin/game-master/actions/${nonFailedAction.id}/retry`,
      { method: 'POST' }
    );
    const payload = await retryResponse.json();

    expect(retryResponse.status).toBeGreaterThanOrEqual(400);
    expect(typeof payload.error?.message).toBe('string');
  });
});
