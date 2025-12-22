/**
 * Head-to-Head Benchmark Infrastructure Tests
 *
 * @deprecated These tests are skipped because SimulationEngine and MetricsVisualizer
 * were deprecated during an architecture migration. The simulation functionality
 * was moved to the main game engine. Re-enable these tests when the benchmark
 * infrastructure is updated to use the new game engine API.
 */
import { describe, it } from 'bun:test';
import type { SimulationResult } from '../SimulationEngine';

describe('Head-to-Head Benchmark Infrastructure', () => {
  // @deprecated SimulationEngine was removed during architecture migration.
  // These tests would verify PnL history tracking through the simulation.
  describe.skip('SimulationEngine PnL History', () => {
    it('should initialize with empty pnlHistory and return it after run()', async () => {
      // Test disabled: SimulationEngine is deprecated.
      // Would create a mock snapshot, initialize engine, run simulation,
      // and verify pnlHistory is returned correctly.
    });
  });

  // @deprecated MetricsVisualizer was removed during architecture migration.
  // These tests would verify the comparison logic for benchmark results.
  describe.skip('MetricsVisualizer Comparison Logic', () => {
    // Mock Result Helper
    const _createMockResult = (
      id: string,
      pnl: number,
      history: number[]
    ): SimulationResult => ({
      id,
      agentId: id,
      benchmarkId: 'bench-1',
      startTime: 0,
      endTime: 1000,
      ticksProcessed: history.length,
      actions: [],
      metrics: {
        totalPnl: pnl,
        predictionMetrics: {
          accuracy: 0.5,
          totalPositions: 0,
          correctPredictions: 0,
          incorrectPredictions: 0,
          avgPnlPerPosition: 0,
        },
        perpMetrics: {
          winRate: 0.5,
          totalTrades: 0,
          profitableTrades: 0,
          avgPnlPerTrade: 0,
          maxDrawdown: 0,
        },
        socialMetrics: {
          postsCreated: 0,
          groupsJoined: 0,
          messagesReceived: 0,
          reputationGained: 0,
        },
        timing: { totalDuration: 0, avgResponseTime: 0, maxResponseTime: 0 },
        optimalityScore: 50,
      },
      trajectory: { states: [], actions: [], rewards: [], windowId: '' },
      pnlHistory: history.map((val, idx) => ({ tick: idx, pnl: val })),
    });

    it.skip('should correctly merge PnL histories of equal length', () => {
      // Test disabled: MetricsVisualizer is deprecated.
      // Would verify mergePnlHistory() correctly combines two equal-length histories.
    });

    it.skip('should handle unequal history lengths (fill with final value)', () => {
      // Test disabled: MetricsVisualizer is deprecated.
      // Would verify mergePnlHistory() handles different-length histories by
      // carrying forward the final value from the shorter history.
    });

    it.skip('should generate ASCII chart string', () => {
      // Test disabled: MetricsVisualizer is deprecated.
      // Would verify generateAsciiComparison() produces correct output format.
    });
  });
});
