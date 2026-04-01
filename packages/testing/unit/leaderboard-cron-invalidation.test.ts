/**
 * Unit Tests: Leaderboard Cache Invalidation from Points Recompute Cron
 *
 * Verifies that the points-recompute cron job invalidates the leaderboard
 * cache after completing, so rankings update immediately.
 *
 * Run with: bun test packages/testing/unit/leaderboard-cron-invalidation.test.ts
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { NextRequest } from 'next/server';

// ─── Mock state ──────────────────────────────────────────────────────────────

const mockInvalidateCachePattern = mock(async () => undefined);
const mockRecordCronExecution = mock(() => undefined);

const mockBulkBackfillFromBalance = mock(async () => 5);
const mockMarkZeroTotalPointsDirty = mock(async () => 3);
const mockRecomputeDirtyUsers = mock(async () => ({
  processed: 8,
  errors: 0,
}));
const mockSnapshotAllUsers = mock(async () => 100);

// ─── Module mocks ────────────────────────────────────────────────────────────

const _actualBabylonApi = await import('@babylon/api');
mock.module('@babylon/api', () => ({
  ..._actualBabylonApi,
  invalidateCachePattern: mockInvalidateCachePattern,
  recordCronExecution: mockRecordCronExecution,
  withCronAuth:
    (_jobName: string, handler: (request: NextRequest) => Promise<Response>) =>
    (request: NextRequest) =>
      handler(request),
  withErrorHandling:
    (handler: (request: NextRequest) => Promise<Response>) =>
    (request: NextRequest) =>
      handler(request),
}));

mock.module('@babylon/engine', () => ({
  TotalPointsService: {
    bulkBackfillFromBalance: mockBulkBackfillFromBalance,
    markZeroTotalPointsDirty: mockMarkZeroTotalPointsDirty,
    recomputeDirtyUsers: mockRecomputeDirtyUsers,
    snapshotAllUsers: mockSnapshotAllUsers,
  },
}));

const _actualShared = await import('@babylon/shared');
mock.module('@babylon/shared', () => ({
  ..._actualShared,
  logger: {
    info: mock(() => undefined),
    warn: mock(() => undefined),
    error: mock(() => undefined),
    debug: mock(() => undefined),
  },
}));

const routeModule = await import('@/app/api/cron/points-recompute/route');

function makeRequest(): NextRequest {
  return new Request('http://localhost:3000/api/cron/points-recompute', {
    headers: { 'x-cron-secret': 'test-secret' },
  }) as NextRequest;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Points recompute → leaderboard cache invalidation', () => {
  beforeEach(() => {
    mockInvalidateCachePattern.mockClear();
    mockRecordCronExecution.mockClear();
    mockBulkBackfillFromBalance.mockClear();
    mockMarkZeroTotalPointsDirty.mockClear();
    mockRecomputeDirtyUsers.mockClear();
    mockBulkBackfillFromBalance.mockResolvedValue(5);
    mockMarkZeroTotalPointsDirty.mockResolvedValue(3);
    mockRecomputeDirtyUsers.mockResolvedValue({ processed: 8, errors: 0 });
  });

  test('invalidates leaderboard cache after successful recompute', async () => {
    // The route exports GET and POST — use GET for testing
    const handler = routeModule.GET ?? routeModule.POST;
    const response = await handler(makeRequest());
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(mockInvalidateCachePattern).toHaveBeenCalledTimes(1);
    expect(mockInvalidateCachePattern).toHaveBeenCalledWith('*', {
      namespace: 'leaderboard',
    });
  });

  test('invalidation happens after recompute, before recording cron execution', async () => {
    const callOrder: string[] = [];

    mockRecomputeDirtyUsers.mockImplementation(async () => {
      callOrder.push('recompute');
      return { processed: 1, errors: 0 };
    });
    mockInvalidateCachePattern.mockImplementation(async () => {
      callOrder.push('invalidate');
    });
    mockRecordCronExecution.mockImplementation(() => {
      callOrder.push('record');
    });

    const handler = routeModule.GET ?? routeModule.POST;
    await handler(makeRequest());

    expect(callOrder).toEqual(['recompute', 'invalidate', 'record']);
  });

  test('cron still succeeds if cache invalidation fails', async () => {
    mockInvalidateCachePattern.mockRejectedValue(
      new Error('Redis connection refused')
    );

    const handler = routeModule.GET ?? routeModule.POST;
    const response = await handler(makeRequest());
    const body = await response.json();

    // Cron should still report success — invalidation failure is non-fatal
    expect(body.success).toBe(true);
    expect(mockInvalidateCachePattern).toHaveBeenCalledTimes(1);
  });
});
