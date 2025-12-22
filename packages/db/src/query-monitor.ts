/**
 * Query monitoring for performance tracking
 *
 * Provides query timing statistics for slow query detection
 */

interface SlowQueryStats {
  count: number;
  avgDuration: number;
  maxDuration: number;
}

class QueryMonitor {
  private queries: Map<string, { durations: number[] }> = new Map();
  private readonly maxSamples = 100;

  /**
   * Record a query execution
   */
  recordQuery(queryName: string, durationMs: number): void {
    let stats = this.queries.get(queryName);
    if (!stats) {
      stats = { durations: [] };
      this.queries.set(queryName, stats);
    }

    stats.durations.push(durationMs);
    if (stats.durations.length > this.maxSamples) {
      stats.durations.shift();
    }
  }

  /**
   * Get slow query statistics
   */
  getSlowQueryStats(): Record<string, SlowQueryStats> {
    const result: Record<string, SlowQueryStats> = {};

    for (const [query, { durations }] of this.queries) {
      if (durations.length === 0) continue;

      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const max = Math.max(...durations);

      // Only report queries with avg > 100ms as "slow"
      if (avg > 100 || max > 500) {
        result[query] = {
          count: durations.length,
          avgDuration: avg,
          maxDuration: max,
        };
      }
    }

    return result;
  }

  /**
   * Clear all recorded queries
   */
  reset(): void {
    this.queries.clear();
  }
}

export const queryMonitor = new QueryMonitor();
