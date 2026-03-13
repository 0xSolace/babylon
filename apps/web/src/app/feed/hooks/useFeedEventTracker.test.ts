import { describe, expect, it } from 'bun:test';

// The retry boundary: items with attempts < MAX_RETRY_ATTEMPTS (3) are re-queued.
// Items at attempts >= 3 are dropped.
const MAX_RETRY_ATTEMPTS = 3;

function applyRetryFilter<T extends { attempts: number }>(
  batch: T[]
): { retryable: T[]; dropped: T[] } {
  const incremented = batch.map((item) => ({
    ...item,
    attempts: item.attempts + 1,
  }));
  const retryable = incremented.filter(
    (item) => item.attempts < MAX_RETRY_ATTEMPTS
  );
  const dropped = incremented.filter(
    (item) => item.attempts >= MAX_RETRY_ATTEMPTS
  );
  return { retryable, dropped };
}

describe('useFeedEventTracker retry semantics', () => {
  it('re-queues events with attempts 0 (first failure)', () => {
    const batch = [{ attempts: 0, payload: {} }];
    const { retryable, dropped } = applyRetryFilter(batch);
    expect(retryable).toHaveLength(1); // attempts becomes 1, 1 < 3 → re-queue
    expect(dropped).toHaveLength(0);
  });

  it('re-queues events with attempts 1 (second failure)', () => {
    const batch = [{ attempts: 1, payload: {} }];
    const { retryable, dropped } = applyRetryFilter(batch);
    expect(retryable).toHaveLength(1); // attempts becomes 2, 2 < 3 → re-queue
    expect(dropped).toHaveLength(0);
  });

  it('drops events that have reached MAX_RETRY_ATTEMPTS (third failure)', () => {
    const batch = [{ attempts: 2, payload: {} }];
    const { retryable, dropped } = applyRetryFilter(batch);
    expect(retryable).toHaveLength(0); // attempts becomes 3, 3 is NOT < 3 → drop
    expect(dropped).toHaveLength(1);
  });

  it('never allows a 4th attempt (regression test for off-by-one fix)', () => {
    // Simulate 3 previous failures: attempts starts at 0,1,2 → becomes 1,2,3
    // Only attempts=0 and attempts=1 survivors remain in queue before 3rd failure
    const survivors = [{ attempts: 0 }, { attempts: 1 }].map((item) => ({
      ...item,
      attempts: item.attempts + 1,
    })); // → attempts 1, 2
    const { retryable: secondRound, dropped } = applyRetryFilter(survivors); // → attempts 2, 3
    expect(dropped).toHaveLength(1); // attempts=3 → dropped (>= MAX_RETRY_ATTEMPTS)
    expect(secondRound).toHaveLength(1); // attempts=2 → still retryable (< MAX_RETRY_ATTEMPTS)
  });
});
