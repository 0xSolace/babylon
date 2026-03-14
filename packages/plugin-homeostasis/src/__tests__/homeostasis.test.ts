/**
 * @fileoverview Tests for HomeostasisService
 *
 * TEST STRATEGY
 * =============
 * We test the homeostasis service in isolation using mocked runtime.
 * This allows us to:
 * - Control all inputs precisely
 * - Verify outputs without external dependencies
 * - Test edge cases that would be hard to reproduce in integration
 *
 * WHAT WE TEST
 * ============
 * 1. Initialization - correct starting state (physiological + psychological)
 * 2. Physiological Dynamics - accumulation, satisfaction, coupling
 * 3. Delta Application - queuing, sensitivity, batching
 * 4. Recovery Dynamics - return to baseline over time
 * 5. Saturation Effects - diminishing returns at extremes
 * 6. Clamping - values stay in valid ranges
 * 7. Resources - tracking, bounds, decay
 * 8. Burst Mode - testing utility works
 * 9. State Management - read/write APIs work correctly
 *
 * WHAT WE DON'T TEST
 * ==================
 * - Events (tested separately or in integration)
 * - Provider (tested separately)
 * - Persistence (requires real database)
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { IAgentRuntime, UUID } from '@elizaos/core';
import { HomeostasisService } from '../services/homeostasis-service.ts';
import type { DriveId, HomeostasisState, PhysiologicalId } from '../types.ts';

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Create a mock runtime for testing.
 *
 * WHY MOCK?
 * The real runtime has many dependencies (database, logging, services).
 * Mocking lets us test HomeostasisService in isolation.
 *
 * @param settings - Optional settings to inject
 */
function createMockRuntime(settings: Record<string, any> = {}): IAgentRuntime {
  // In-memory component storage (simulates database)
  const mockComponents = new Map<string, any>();

  return {
    agentId: 'test-agent-id' as UUID,

    // Return settings passed in, or null for defaults
    getSetting: (key: string) => settings[key] ?? null,

    // Mock logger (no-op)
    logger: {
      info: mock(() => {}),
      debug: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      success: mock(() => {}),
    },

    // In-memory component CRUD
    getComponent: mock(async (entityId: UUID, type: string) => {
      const key = `${entityId}-${type}`;
      return mockComponents.get(key) || null;
    }),
    createComponent: mock(async (component: any) => {
      const key = `${component.entityId}-${component.type}`;
      mockComponents.set(key, component);
      return true;
    }),
    updateComponent: mock(async (component: any) => {
      const key = `${component.entityId}-${component.type}`;
      mockComponents.set(key, component);
    }),

    // Mock event emission (no-op)
    emitEvent: mock(async () => {}),
  } as any;
}

// =============================================================================
// INITIALIZATION TESTS
// =============================================================================

describe('HomeostasisService', () => {
  describe('Initialization', () => {
    /**
     * Verify drives initialize near their configured baseline.
     *
     * WHY THIS TEST?
     * Ensures the initialization logic correctly reads configuration
     * and creates sensible initial state.
     */
    it('should create initial state with drives at baseline', async () => {
      const runtime = createMockRuntime({
        HOMEOSTASIS_SECURITY_BASELINE: 60,
        HOMEOSTASIS_SOCIAL_BASELINE: 40,
      });

      const service = new (HomeostasisService as any)(runtime);
      const drives = service.getDrives();

      // Should be near baselines (within variance of 5)
      expect(drives.security).toBeGreaterThan(50);
      expect(drives.security).toBeLessThan(70);
      expect(drives.social).toBeGreaterThan(30);
      expect(drives.social).toBeLessThan(50);
    });

    /**
     * Verify null baseline is handled correctly.
     *
     * WHY THIS TEST?
     * Null baseline is a special case - it disables recovery for that drive.
     * We need to ensure it doesn't cause NaN or other errors.
     */
    it('should support null baseline for no recovery', async () => {
      const runtime = createMockRuntime({
        HOMEOSTASIS_MEANING_BASELINE: 'null',
        HOMEOSTASIS_INITIAL_VARIANCE: 0, // Disable variance for predictable test
      });

      const service = new (HomeostasisService as any)(runtime);

      // Null baseline drives should initialize at 50 by default
      expect(service.getDrive('meaning')).toBe(50);
    });

    /**
     * Verify physiological state initializes correctly.
     *
     * WHY THIS TEST?
     * Physiological should start near 0 (satisfied) with small variance.
     */
    it('should initialize physiological state near 0 (satisfied)', async () => {
      const runtime = createMockRuntime({
        HOMEOSTASIS_INITIAL_VARIANCE: 5,
      });

      const service = new (HomeostasisService as any)(runtime);
      const phys = service.getPhysiological();

      // All physiological values should be low (near 0 = satisfied)
      expect(phys.hunger).toBeGreaterThanOrEqual(0);
      expect(phys.hunger).toBeLessThanOrEqual(10);
      expect(phys.fatigue).toBeGreaterThanOrEqual(0);
      expect(phys.fatigue).toBeLessThanOrEqual(10);
      expect(phys.hydration).toBeGreaterThanOrEqual(0);
      expect(phys.hydration).toBeLessThanOrEqual(10);
      expect(phys.health).toBeGreaterThanOrEqual(0);
      expect(phys.health).toBeLessThanOrEqual(10);
    });
  });

  // ===========================================================================
  // PHYSIOLOGICAL DYNAMICS TESTS
  // ===========================================================================

  describe('Physiological Dynamics', () => {
    /**
     * Verify physiological values accumulate over time.
     *
     * WHY THIS TEST?
     * Core physiological behavior - needs build up over time.
     * Hunger, fatigue, hydration should increase each tick.
     */
    it('should accumulate physiological needs over time', async () => {
      const runtime = createMockRuntime({
        HOMEOSTASIS_HUNGER_ACCUMULATION_RATE: 0.1, // 10% per tick for faster test
        HOMEOSTASIS_INITIAL_VARIANCE: 0,
      });

      const service = new (HomeostasisService as any)(runtime);

      // Start with satisfied (0)
      service.setState({
        physiological: { hunger: 0, fatigue: 0, hydration: 0, health: 0 },
      });

      const initialHunger = service.getPhysiologicalValue('hunger');
      expect(initialHunger).toBe(0);

      // Run a tick - hunger should accumulate
      await service.runTicks(1);

      const afterOneTickHunger = service.getPhysiologicalValue('hunger');
      // With 10% accumulation rate and starting at 0:
      // accumulation = (100 - 0) * 0.1 = 10
      expect(afterOneTickHunger).toBeGreaterThan(0);
      expect(afterOneTickHunger).toBeLessThan(20);

      // Run more ticks - should continue accumulating
      await service.runTicks(5);

      const afterMoreTicksHunger = service.getPhysiologicalValue('hunger');
      expect(afterMoreTicksHunger).toBeGreaterThan(afterOneTickHunger);
    });

    /**
     * Verify health doesn't auto-accumulate (default rate = 0).
     *
     * WHY THIS TEST?
     * Health is special - it doesn't decay on its own, only from events.
     */
    it('should not auto-accumulate health (rate = 0)', async () => {
      const runtime = createMockRuntime({
        HOMEOSTASIS_HEALTH_ACCUMULATION_RATE: 0, // Explicitly 0
        HOMEOSTASIS_INITIAL_VARIANCE: 0,
      });

      const service = new (HomeostasisService as any)(runtime);
      service.setState({
        physiological: { hunger: 0, fatigue: 0, hydration: 0, health: 0 },
      });

      // Run many ticks
      await service.runTicks(20);

      // Health should still be 0 (no auto-accumulation)
      expect(service.getPhysiologicalValue('health')).toBe(0);
    });

    /**
     * Verify negative deltas satisfy physiological needs.
     *
     * WHY THIS TEST?
     * When an agent "eats", hunger should decrease.
     * Negative deltas = satisfying needs.
     */
    it('should satisfy physiological needs with negative deltas', async () => {
      const runtime = createMockRuntime({
        HOMEOSTASIS_HUNGER_ACCUMULATION_RATE: 0, // Disable accumulation for test
        HOMEOSTASIS_INITIAL_VARIANCE: 0,
      });

      const service = new (HomeostasisService as any)(runtime);

      // Start hungry
      service.setState({
        physiological: { hunger: 80, fatigue: 0, hydration: 0, health: 0 },
      });

      // Propose negative delta (eating)
      service.proposePhysiologicalDelta(
        { hunger: -50 },
        { source: 'test', reason: 'ate_meal' }
      );

      await service.runTicks(1);

      // Hunger should have decreased
      expect(service.getPhysiologicalValue('hunger')).toBeLessThan(80);
      expect(service.getPhysiologicalValue('hunger')).toBeGreaterThanOrEqual(0);
    });

    /**
     * Verify physiological values are clamped to 0-100.
     *
     * WHY THIS TEST?
     * Physiological values must stay in valid range.
     */
    it('should clamp physiological values to 0-100', async () => {
      const runtime = createMockRuntime({
        HOMEOSTASIS_HUNGER_ACCUMULATION_RATE: 0,
        HOMEOSTASIS_INITIAL_VARIANCE: 0,
      });

      const service = new (HomeostasisService as any)(runtime);

      // Set near boundaries
      service.setState({
        physiological: { hunger: 95, fatigue: 5, hydration: 0, health: 0 },
      });

      // Try to push beyond bounds
      service.proposePhysiologicalDelta({ hunger: 20, fatigue: -20 });
      await service.runTicks(1);

      const phys = service.getPhysiological();
      expect(phys.hunger).toBeLessThanOrEqual(100);
      expect(phys.fatigue).toBeGreaterThanOrEqual(0);
    });

    /**
     * Verify physiological stress calculation.
     *
     * WHY THIS TEST?
     * Physiological stress is used for coupling. Must be calculated correctly.
     */
    it('should calculate physiological stress correctly', async () => {
      const runtime = createMockRuntime({ HOMEOSTASIS_INITIAL_VARIANCE: 0 });
      const service = new (HomeostasisService as any)(runtime);

      // Fully satisfied (stress = 0)
      service.setState({
        physiological: { hunger: 0, fatigue: 0, hydration: 0, health: 0 },
      });
      expect(service.getPhysiologicalStress()).toBe(0);

      // Fully deprived (stress = 1)
      service.setState({
        physiological: {
          hunger: 100,
          fatigue: 100,
          hydration: 100,
          health: 100,
        },
      });
      expect(service.getPhysiologicalStress()).toBe(1);

      // Half deprived (stress = 0.5)
      service.setState({
        physiological: { hunger: 50, fatigue: 50, hydration: 50, health: 50 },
      });
      expect(service.getPhysiologicalStress()).toBe(0.5);
    });

    /**
     * Verify physiological stress dampens psychological recovery.
     *
     * WHY THIS TEST?
     * Core coupling mechanism - high physiological stress should slow
     * psychological recovery, creating "survival mode".
     */
    it('should dampen psychological recovery when physiologically stressed', async () => {
      const runtime = createMockRuntime({
        HOMEOSTASIS_SECURITY_BASELINE: 70,
        HOMEOSTASIS_SECURITY_RECOVERY_RATE: 0.5,
        HOMEOSTASIS_PHYSIOLOGICAL_STRESS_THRESHOLD: 0.7,
        HOMEOSTASIS_HUNGER_ACCUMULATION_RATE: 0, // Disable accumulation
        HOMEOSTASIS_FATIGUE_ACCUMULATION_RATE: 0,
        HOMEOSTASIS_HYDRATION_ACCUMULATION_RATE: 0,
        HOMEOSTASIS_HEALTH_ACCUMULATION_RATE: 0,
        HOMEOSTASIS_INITIAL_VARIANCE: 0,
      });

      const service = new (HomeostasisService as any)(runtime);

      // LOW STRESS SCENARIO
      // Set physiological low (satisfied) and drive far from baseline
      service.setState({
        physiological: { hunger: 10, fatigue: 10, hydration: 10, health: 10 },
        drives: {
          security: 20,
          social: 50,
          status: 50,
          autonomy: 50,
          meaning: 50,
        },
      });

      await service.runTicks(5);
      const lowStressRecovery = service.getDrive('security');

      // HIGH STRESS SCENARIO
      // Set physiological high (deprived) and drive far from baseline
      service.setState({
        physiological: { hunger: 90, fatigue: 90, hydration: 90, health: 90 },
        drives: {
          security: 20,
          social: 50,
          status: 50,
          autonomy: 50,
          meaning: 50,
        },
      });

      await service.runTicks(5);
      const highStressRecovery = service.getDrive('security');

      // Low stress should recover MORE than high stress
      // (Both started at 20, moving toward 70)
      expect(lowStressRecovery).toBeGreaterThan(highStressRecovery);
    });
  });

  // ===========================================================================
  // DELTA APPLICATION TESTS
  // ===========================================================================

  describe('Delta Application', () => {
    /**
     * Verify deltas are queued and applied with sensitivity.
     *
     * WHY THIS TEST?
     * Core functionality - other plugins depend on being able to
     * affect drives. Sensitivity is key to per-drive tuning.
     */
    it('should queue and apply drive deltas with sensitivity', async () => {
      const runtime = createMockRuntime({
        HOMEOSTASIS_SECURITY_SENSITIVITY: 2.0, // Double sensitivity
      });

      const service = new (HomeostasisService as any)(runtime);
      const initialSecurity = service.getDrive('security');

      // Propose delta
      service.proposeDriveDelta({ security: -10 });

      // Delta should be queued, not applied yet
      // WHY? Deltas are batched and applied at tick time
      expect(service.getDrive('security')).toBe(initialSecurity);

      // Run a tick to apply
      await service.runTicks(1);

      // Delta should be applied with sensitivity multiplier
      // Expected: -10 * 2.0 * saturation = approximately -20
      const newSecurity = service.getDrive('security');
      expect(newSecurity).toBeLessThan(initialSecurity);
      expect(newSecurity).toBeGreaterThan(initialSecurity - 25); // Account for saturation
    });

    /**
     * Verify invalid deltas are rejected.
     *
     * WHY THIS TEST?
     * Invalid values (NaN, Infinity) would corrupt state. The service
     * must validate inputs and reject bad data.
     */
    it('should reject invalid deltas', async () => {
      const runtime = createMockRuntime({
        // Disable recovery to isolate delta behavior
        HOMEOSTASIS_SECURITY_RECOVERY_RATE: 0,
        HOMEOSTASIS_SOCIAL_RECOVERY_RATE: 0,
        HOMEOSTASIS_STATUS_RECOVERY_RATE: 0,
        HOMEOSTASIS_AUTONOMY_RECOVERY_RATE: 0,
        HOMEOSTASIS_MEANING_RECOVERY_RATE: 0,
      });
      const service = new (HomeostasisService as any)(runtime);

      const initialDrives = service.getDrives();

      // Try invalid deltas
      service.proposeDriveDelta({ security: NaN });
      service.proposeDriveDelta({ security: Infinity });
      service.proposeDriveDelta({ security: 'not a number' as any });

      await service.runTicks(1);

      // Drives should be unchanged (no recovery, invalid deltas rejected)
      expect(service.getDrives()).toEqual(initialDrives);
    });

    /**
     * Verify multiple deltas in same tick are batched.
     *
     * WHY THIS TEST?
     * Multiple plugins might affect the same drive in one tick.
     * They should be accumulated, not applied separately.
     */
    it('should batch multiple deltas in same tick', async () => {
      const runtime = createMockRuntime({
        HOMEOSTASIS_SECURITY_SENSITIVITY: 1.0,
        HOMEOSTASIS_SECURITY_RECOVERY_RATE: 0, // Disable recovery
        HOMEOSTASIS_SATURATION_FACTOR: 0, // Disable saturation for predictable test
      });

      const service = new (HomeostasisService as any)(runtime);
      const initialSecurity = service.getDrive('security');

      // Queue multiple deltas
      service.proposeDriveDelta({ security: -5 });
      service.proposeDriveDelta({ security: -5 });
      service.proposeDriveDelta({ security: -5 });

      // All should be batched and applied together
      await service.runTicks(1);

      const newSecurity = service.getDrive('security');

      // Should have accumulated exactly -15 (no saturation, no recovery)
      expect(newSecurity).toBeLessThan(initialSecurity - 10);
      expect(newSecurity).toBeGreaterThan(initialSecurity - 20);
    });
  });

  // ===========================================================================
  // RECOVERY DYNAMICS TESTS
  // ===========================================================================

  describe('Recovery Dynamics', () => {
    /**
     * Verify drives recover toward baseline over time.
     *
     * WHY THIS TEST?
     * Recovery is core to homeostasis - drives should naturally
     * return to equilibrium without external input.
     */
    it('should recover toward baseline over time', async () => {
      const runtime = createMockRuntime({
        HOMEOSTASIS_SECURITY_BASELINE: 70,
        HOMEOSTASIS_SECURITY_RECOVERY_RATE: 0.5,
      });

      const service = new (HomeostasisService as any)(runtime);

      // Set security low (far from baseline)
      service.setState({
        drives: {
          security: 20,
          social: 50,
          status: 50,
          autonomy: 50,
          meaning: 50,
        },
      });

      // Run multiple ticks to see recovery
      await service.runTicks(10);

      const finalSecurity = service.getDrive('security');

      // Should have moved toward baseline of 70
      expect(finalSecurity).toBeGreaterThan(20);
      expect(finalSecurity).toBeLessThan(80);
    });

    /**
     * Verify null baseline prevents recovery.
     *
     * WHY THIS TEST?
     * Null baseline means "this drive doesn't auto-recover".
     * Must verify this special case works correctly.
     */
    it('should not recover drives with null baseline', async () => {
      const runtime = createMockRuntime({
        HOMEOSTASIS_MEANING_BASELINE: 'null',
      });

      const service = new (HomeostasisService as any)(runtime);

      // Set meaning to arbitrary value
      service.setState({
        drives: {
          security: 50,
          social: 50,
          status: 50,
          autonomy: 50,
          meaning: 25,
        },
      });

      // Run multiple ticks
      await service.runTicks(10);

      // Meaning should not have recovered (still at 25)
      expect(service.getDrive('meaning')).toBe(25);
    });
  });

  // ===========================================================================
  // SATURATION TESTS
  // ===========================================================================

  describe('Saturation Effects', () => {
    /**
     * Verify diminishing returns at extremes.
     *
     * WHY THIS TEST?
     * Saturation creates more realistic dynamics - it's hard to push
     * security from 95 to 100 but easy from 50 to 55. This test
     * verifies that effect works.
     */
    it('should apply diminishing returns at extremes', async () => {
      const runtime = createMockRuntime({
        HOMEOSTASIS_SATURATION_FACTOR: 0.5,
      });

      const service = new (HomeostasisService as any)(runtime);

      // Test at low value (near extreme)
      service.setState({
        drives: {
          security: 10,
          social: 50,
          status: 50,
          autonomy: 50,
          meaning: 50,
        },
      });
      service.proposeDriveDelta({ security: -10 });
      await service.runTicks(1);
      const lowDelta = 10 - service.getDrive('security');

      // Reset and test at mid value (center)
      service.setState({
        drives: {
          security: 50,
          social: 50,
          status: 50,
          autonomy: 50,
          meaning: 50,
        },
      });
      service.proposeDriveDelta({ security: -10 });
      await service.runTicks(1);
      const midDelta = 50 - service.getDrive('security');

      // Mid-range deltas should be larger than extreme deltas
      // (saturation reduces effectiveness at extremes)
      expect(midDelta).toBeGreaterThan(lowDelta);
    });
  });

  // ===========================================================================
  // CLAMPING TESTS
  // ===========================================================================

  describe('Clamping', () => {
    /**
     * Verify drives stay within 0-100.
     *
     * WHY THIS TEST?
     * Drives must never exceed valid range. Clamping is the safety
     * net that ensures this regardless of what deltas are applied.
     */
    it('should clamp drives to 0-100 range', async () => {
      const runtime = createMockRuntime();
      const service = new (HomeostasisService as any)(runtime);

      // Try to push beyond bounds
      service.setState({
        drives: {
          security: 95,
          social: 5,
          status: 50,
          autonomy: 50,
          meaning: 50,
        },
      });
      service.proposeDriveDelta({ security: 20, social: -20 });
      await service.runTicks(1);

      const drives = service.getDrives();

      expect(drives.security).toBeLessThanOrEqual(100);
      expect(drives.social).toBeGreaterThanOrEqual(0);
    });
  });

  // ===========================================================================
  // RESOURCE TESTS
  // ===========================================================================

  describe('Resources', () => {
    /**
     * Verify simple numeric resource tracking.
     *
     * WHY THIS TEST?
     * Most resources are just numbers that accumulate.
     * This tests the basic case.
     */
    it('should track simple numeric resources', async () => {
      const runtime = createMockRuntime();
      const service = new (HomeostasisService as any)(runtime);

      service.reportResourceDelta({ money: 100 });
      await service.runTicks(1);

      expect(service.getResource('money')).toBe(100);

      service.reportResourceDelta({ money: 50 });
      await service.runTicks(1);

      expect(service.getResource('money')).toBe(150);
    });

    /**
     * Verify resource bounds enforcement.
     *
     * WHY THIS TEST?
     * Some resources have min/max (like energy 0-100).
     * Bounds must be enforced after deltas.
     */
    it('should support resources with bounds', async () => {
      const runtime = createMockRuntime();
      const service = new (HomeostasisService as any)(runtime);

      // Report resource with bounds
      service.reportResourceDelta({
        energy: { value: 80, min: 0, max: 100 },
      });
      await service.runTicks(1);

      expect(service.getResource('energy')).toBe(80);

      // Try to exceed max
      service.reportResourceDelta({ energy: 30 });
      await service.runTicks(1);

      // Should be clamped to max
      expect(service.getResource('energy')).toBeLessThanOrEqual(100);
    });

    /**
     * Verify resource decay over time.
     *
     * WHY THIS TEST?
     * Some resources (energy, attention) deplete over time.
     * Decay is percentage-based per tick.
     */
    it('should support resources with decay', async () => {
      const runtime = createMockRuntime();
      const service = new (HomeostasisService as any)(runtime);

      // Resource with 10% decay per tick
      service.reportResourceDelta({
        energy: { value: 100, decayRate: 0.1 },
      });

      // First tick applies the delta AND runs decay
      await service.runTicks(1);

      // After one tick with 10% decay: 100 - (100 * 0.1) = 90
      expect(service.getResource('energy')).toBe(90);

      // Run more ticks to see continued decay
      await service.runTicks(4);

      const finalEnergy = service.getResource('energy');
      // After 5 total ticks: ~59 (exponential decay)
      expect(finalEnergy).toBeLessThan(90);
      expect(finalEnergy).toBeGreaterThan(50);
    });

    /**
     * Verify resources are created lazily.
     *
     * WHY THIS TEST?
     * You shouldn't have to pre-declare resources. First delta
     * for a key should create it automatically.
     */
    it('should create resources lazily', async () => {
      const runtime = createMockRuntime();
      const service = new (HomeostasisService as any)(runtime);

      // Resource doesn't exist yet
      expect(service.getResource('unknown')).toBe(0);

      // Report delta creates it
      service.reportResourceDelta({ unknown: 42 });
      await service.runTicks(1);

      expect(service.getResource('unknown')).toBe(42);
    });
  });

  // ===========================================================================
  // BURST MODE TESTS
  // ===========================================================================

  describe('Burst Mode', () => {
    /**
     * Verify runTicks() simulates time correctly.
     *
     * WHY THIS TEST?
     * Burst mode is essential for testing - you can't wait 10 minutes
     * to see if recovery works. This verifies the utility works.
     */
    it('should run multiple ticks instantly', async () => {
      const runtime = createMockRuntime({
        HOMEOSTASIS_SECURITY_BASELINE: 70,
        HOMEOSTASIS_SECURITY_RECOVERY_RATE: 0.2,
      });

      const service = new (HomeostasisService as any)(runtime);
      service.setState({
        drives: {
          security: 20,
          social: 50,
          status: 50,
          autonomy: 50,
          meaning: 50,
        },
      });

      const startSecurity = service.getDrive('security');

      // Run 20 ticks instantly
      await service.runTicks(20);

      const endSecurity = service.getDrive('security');

      // Should have recovered significantly toward baseline of 70
      expect(endSecurity).toBeGreaterThan(startSecurity + 20);
    });
  });

  // ===========================================================================
  // STATE MANAGEMENT TESTS
  // ===========================================================================

  describe('State Management', () => {
    /**
     * Verify read APIs return correct data.
     *
     * WHY THIS TEST?
     * Other plugins depend on these APIs. They must work correctly.
     */
    it('should provide read access to physiological, drives, and resources', async () => {
      const runtime = createMockRuntime();
      const service = new (HomeostasisService as any)(runtime);

      // Physiological
      const phys = service.getPhysiological();
      expect(phys).toHaveProperty('hunger');
      expect(phys).toHaveProperty('fatigue');
      expect(phys).toHaveProperty('hydration');
      expect(phys).toHaveProperty('health');

      // Psychological
      const drives = service.getDrives();
      expect(drives).toHaveProperty('security');
      expect(drives).toHaveProperty('social');
      expect(drives).toHaveProperty('status');
      expect(drives).toHaveProperty('autonomy');
      expect(drives).toHaveProperty('meaning');

      const resources = service.getResources();
      expect(typeof resources).toBe('object');

      // Stress level
      const stress = service.getPhysiologicalStress();
      expect(typeof stress).toBe('number');
      expect(stress).toBeGreaterThanOrEqual(0);
      expect(stress).toBeLessThanOrEqual(1);
    });

    /**
     * Verify setState() works for testing (including physiological).
     *
     * WHY THIS TEST?
     * Tests need to put the service in specific states.
     * setState() must work correctly for all three layers.
     */
    it('should allow direct state setting for testing', async () => {
      const runtime = createMockRuntime();
      const service = new (HomeostasisService as any)(runtime);

      service.setState({
        physiological: { hunger: 30, fatigue: 40, hydration: 20, health: 10 },
        drives: {
          security: 25,
          social: 75,
          status: 60,
          autonomy: 40,
          meaning: 80,
        },
      });

      expect(service.getPhysiologicalValue('hunger')).toBe(30);
      expect(service.getPhysiologicalValue('fatigue')).toBe(40);
      expect(service.getDrive('security')).toBe(25);
      expect(service.getDrive('social')).toBe(75);
      expect(service.getDrive('meaning')).toBe(80);
    });
  });

  // ===========================================================================
  // SURVIVAL SYSTEM TESTS
  // ===========================================================================

  describe('Distress System', () => {
    /**
     * Verify distress score calculation with default weights.
     *
     * DEFAULT WEIGHTS: hunger=0.35, fatigue=0.25, health=0.30, hydration=0.10
     *
     * Example: hunger=80, fatigue=60, health=50, hydration=40
     * Distress = 80*0.35 + 60*0.25 + 50*0.30 + 40*0.10 = 28 + 15 + 15 + 4 = 62
     */
    it('should calculate distress score from weighted physiological values', async () => {
      const runtime = createMockRuntime();
      const service = new (HomeostasisService as any)(runtime);

      service.setState({
        physiological: { hunger: 80, fatigue: 60, health: 50, hydration: 40 },
      });

      const distress = service.getDistressScore();
      // 80*0.35 + 60*0.25 + 50*0.30 + 40*0.10 = 28 + 15 + 15 + 4 = 62
      expect(distress).toBeCloseTo(62, 1);
    });

    /**
     * Verify distress brackets are assigned correctly.
     */
    it('should return correct bracket for each distress range', async () => {
      const runtime = createMockRuntime();
      const service = new (HomeostasisService as any)(runtime);

      // Content: distress < 15 (all values ~10)
      // 10*0.35 + 10*0.25 + 10*0.30 + 10*0.10 = 10
      service.setState({
        physiological: { hunger: 10, fatigue: 10, health: 10, hydration: 10 },
      });
      expect(service.getDistressBracket()).toBe('content');

      // Aware: 15-30
      // 30*0.35 + 30*0.25 + 30*0.30 + 30*0.10 = 30 -> edge of aware/concerned
      // Let's use lower values: 25*0.35 + 20*0.25 + 20*0.30 + 20*0.10 = 8.75 + 5 + 6 + 2 = 21.75
      service.setState({
        physiological: { hunger: 25, fatigue: 20, health: 20, hydration: 20 },
      });
      expect(service.getDistressBracket()).toBe('aware');

      // Concerned: 30-50
      // 50*0.35 + 40*0.25 + 40*0.30 + 40*0.10 = 17.5 + 10 + 12 + 4 = 43.5
      service.setState({
        physiological: { hunger: 50, fatigue: 40, health: 40, hydration: 40 },
      });
      expect(service.getDistressBracket()).toBe('concerned');

      // Struggling: 70-85
      // 90*0.35 + 80*0.25 + 80*0.30 + 60*0.10 = 31.5 + 20 + 24 + 6 = 81.5
      service.setState({
        physiological: { hunger: 90, fatigue: 80, health: 80, hydration: 60 },
      });
      expect(service.getDistressBracket()).toBe('struggling');

      // Desperate: 85-95
      // 95*0.35 + 90*0.25 + 90*0.30 + 80*0.10 = 33.25 + 22.5 + 27 + 8 = 90.75
      service.setState({
        physiological: { hunger: 95, fatigue: 90, health: 90, hydration: 80 },
      });
      expect(service.getDistressBracket()).toBe('desperate');

      // Terminal: >= 95
      // 100*0.35 + 100*0.25 + 100*0.30 + 100*0.10 = 100
      service.setState({
        physiological: {
          hunger: 100,
          fatigue: 100,
          health: 100,
          hydration: 100,
        },
      });
      expect(service.getDistressBracket()).toBe('terminal');
    });

    /**
     * Verify primary contributor identification.
     */
    it('should identify primary distress contributor correctly', async () => {
      const runtime = createMockRuntime();
      const service = new (HomeostasisService as any)(runtime);

      // Hunger is highest weighted contributor
      service.setState({
        physiological: { hunger: 100, fatigue: 50, health: 50, hydration: 50 },
      });
      expect(service.getPrimaryDistressContributor()).toBe('hunger');

      // Health becomes primary when it's much higher
      service.setState({
        physiological: { hunger: 30, fatigue: 30, health: 100, hydration: 30 },
      });
      expect(service.getPrimaryDistressContributor()).toBe('health');
    });
  });

  describe('Lifecycle Management', () => {
    /**
     * Verify agent starts alive.
     */
    it('should start with alive status', async () => {
      const runtime = createMockRuntime();
      const service = new (HomeostasisService as any)(runtime);

      const lifecycle = service.getLifecycleState();
      expect(lifecycle.status).toBe('alive');
      expect(lifecycle.ticksInCrisis).toBe(0);
      expect(service.isAlive()).toBe(true);
      expect(service.isSuspended()).toBe(false);
      expect(service.isDead()).toBe(false);
    });

    /**
     * Verify crisis detection when distress exceeds threshold.
     * Default crisis threshold is 85.
     */
    it('should enter crisis when distress >= 85', async () => {
      const runtime = createMockRuntime();
      const service = new (HomeostasisService as any)(runtime);

      // Set physiological to trigger crisis (distress will be > 85)
      service.setState({
        physiological: { hunger: 95, fatigue: 90, health: 90, hydration: 80 },
      });

      // Run a tick to check lifecycle
      await service.runTicks(1);

      const lifecycle = service.getLifecycleState();
      expect(lifecycle.status).toBe('crisis');
      expect(lifecycle.ticksInCrisis).toBe(1);
    });

    /**
     * Verify crisis counter increments each tick.
     */
    it('should increment ticksInCrisis each tick while in crisis', async () => {
      const runtime = createMockRuntime();
      const service = new (HomeostasisService as any)(runtime);

      // Set high distress
      service.setState({
        physiological: { hunger: 95, fatigue: 90, health: 90, hydration: 80 },
      });

      // Run 5 ticks
      await service.runTicks(5);

      const lifecycle = service.getLifecycleState();
      expect(lifecycle.ticksInCrisis).toBe(5);
    });

    /**
     * Verify crisis resolution when distress drops.
     */
    it('should exit crisis when distress drops below threshold', async () => {
      const runtime = createMockRuntime();
      const service = new (HomeostasisService as any)(runtime);

      // Enter crisis
      service.setState({
        physiological: { hunger: 95, fatigue: 90, health: 90, hydration: 80 },
      });
      await service.runTicks(3);
      expect(service.getLifecycleState().status).toBe('crisis');

      // Reduce distress below threshold
      service.setState({
        physiological: { hunger: 30, fatigue: 30, health: 30, hydration: 30 },
      });
      await service.runTicks(1);

      const lifecycle = service.getLifecycleState();
      expect(lifecycle.status).toBe('alive');
      expect(lifecycle.ticksInCrisis).toBe(0);
    });

    /**
     * Verify death triggers after configured ticks.
     * Default: ticksUntilDeath=60, finalTicks=10
     * Total: 70 ticks to death
     */
    it('should trigger death after ticksUntilDeath + finalTicks', async () => {
      const runtime = createMockRuntime({
        HOMEOSTASIS_TICKS_UNTIL_DEATH: 5,
        HOMEOSTASIS_FINAL_TICKS: 2,
        HOMEOSTASIS_DEATH_MODE: 'suspended',
      });
      const service = new (HomeostasisService as any)(runtime);

      // Set terminal distress
      service.setState({
        physiological: {
          hunger: 100,
          fatigue: 100,
          health: 100,
          hydration: 100,
        },
      });

      // Run ticks: 5 (crisis) + 2 (final) = 7 ticks to suspended
      await service.runTicks(8);

      expect(service.isSuspended()).toBe(true);
      expect(service.getLifecycleState().status).toBe('suspended');
    });
  });

  describe('Revival', () => {
    /**
     * Verify suspended agents can be revived.
     */
    it('should revive from suspended state', async () => {
      const runtime = createMockRuntime({
        HOMEOSTASIS_TICKS_UNTIL_DEATH: 5,
        HOMEOSTASIS_FINAL_TICKS: 2,
        HOMEOSTASIS_DEATH_MODE: 'suspended',
      });
      const service = new (HomeostasisService as any)(runtime);

      // Enter suspended state
      service.setState({
        physiological: {
          hunger: 100,
          fatigue: 100,
          health: 100,
          hydration: 100,
        },
      });
      await service.runTicks(8);
      expect(service.isSuspended()).toBe(true);

      // Revive
      await service.revive();

      expect(service.isAlive()).toBe(true);
      expect(service.getLifecycleState().status).toBe('alive');
      expect(service.getLifecycleState().ticksInCrisis).toBe(0);

      // Physiological should be reset to moderate levels
      const physio = service.getPhysiological();
      expect(physio.hunger).toBeLessThan(50);
      expect(physio.fatigue).toBeLessThan(50);
    });

    /**
     * Verify revive throws for non-suspended agents.
     */
    it('should throw if trying to revive non-suspended agent', async () => {
      const runtime = createMockRuntime();
      const service = new (HomeostasisService as any)(runtime);

      expect(service.getLifecycleState().status).toBe('alive');

      await expect(service.revive()).rejects.toThrow(
        'Can only revive suspended agents'
      );
    });
  });
});
