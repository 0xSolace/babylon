/**
 * @fileoverview Tests for plugin-motivation
 *
 * Tests the core functionality:
 * - Signal conversion (state → buckets)
 * - Pattern detection (signals → patterns)
 * - Frame filtering (patterns → filtered patterns)
 * - Output generation (patterns → priorities/constraints/opportunities)
 */

import { describe, expect, it } from 'bun:test';
import { maslowFrame } from '../frames/maslow.ts';
import { survivalFrame } from '../frames/survival.ts';
import type { Drives, Physiological, Resources } from '../homeostasis-types.ts';
import { patternsToConstraints } from '../output/constraints.ts';
import { patternsToOpportunities } from '../output/opportunities.ts';
import { patternsToPriorities } from '../output/priorities.ts';
import { detectPatterns } from '../patterns/index.ts';
// Import modules to test
import {
  driveToSignal,
  physiologicalToSignal,
  stateToSignals,
} from '../signals/index.ts';
import type {
  ActivePattern,
  MotivationPriority,
  SignalState,
} from '../types.ts';

// =============================================================================
// SIGNAL TESTS
// =============================================================================

describe('Signals', () => {
  describe('driveToSignal', () => {
    it('should return critical for values < 25', () => {
      expect(driveToSignal(10)).toBe('critical');
      expect(driveToSignal(24)).toBe('critical');
    });

    it('should return low for values 25-40', () => {
      expect(driveToSignal(25)).toBe('low');
      expect(driveToSignal(35)).toBe('low');
      expect(driveToSignal(39)).toBe('low');
    });

    it('should return balanced for values 40-55', () => {
      expect(driveToSignal(40)).toBe('balanced');
      expect(driveToSignal(50)).toBe('balanced');
      expect(driveToSignal(54)).toBe('balanced');
    });

    it('should return satisfied for values 55-75', () => {
      expect(driveToSignal(55)).toBe('satisfied');
      expect(driveToSignal(65)).toBe('satisfied');
      expect(driveToSignal(74)).toBe('satisfied');
    });

    it('should return abundant for values > 75', () => {
      expect(driveToSignal(75)).toBe('abundant');
      expect(driveToSignal(90)).toBe('abundant');
      expect(driveToSignal(100)).toBe('abundant');
    });
  });

  describe('physiologicalToSignal', () => {
    it('should return satisfied for values < 20', () => {
      expect(physiologicalToSignal(0)).toBe('satisfied');
      expect(physiologicalToSignal(19)).toBe('satisfied');
    });

    it('should return moderate for values 20-50', () => {
      expect(physiologicalToSignal(20)).toBe('moderate');
      expect(physiologicalToSignal(35)).toBe('moderate');
      expect(physiologicalToSignal(49)).toBe('moderate');
    });

    it('should return high for values 50-75', () => {
      expect(physiologicalToSignal(50)).toBe('high');
      expect(physiologicalToSignal(60)).toBe('high');
      expect(physiologicalToSignal(74)).toBe('high');
    });

    it('should return critical for values > 75', () => {
      expect(physiologicalToSignal(75)).toBe('critical');
      expect(physiologicalToSignal(90)).toBe('critical');
      expect(physiologicalToSignal(100)).toBe('critical');
    });
  });

  describe('stateToSignals', () => {
    it('should convert complete state to signals', () => {
      const drives: Drives = {
        security: 30, // low
        social: 50, // balanced
        status: 60, // satisfied
        autonomy: 20, // critical
        meaning: 80, // abundant
      };

      const physiological: Physiological = {
        hunger: 10, // satisfied
        fatigue: 40, // moderate
        hydration: 60, // high
        health: 5, // satisfied
      };

      const resources: Resources = {};

      const signals = stateToSignals(drives, physiological, resources);

      expect(signals.drives.security).toBe('low');
      expect(signals.drives.social).toBe('balanced');
      expect(signals.drives.status).toBe('satisfied');
      expect(signals.drives.autonomy).toBe('critical');
      expect(signals.drives.meaning).toBe('abundant');

      expect(signals.physiological.hunger).toBe('satisfied');
      expect(signals.physiological.fatigue).toBe('moderate');
      expect(signals.physiological.hydration).toBe('high');
      expect(signals.physiological.health).toBe('satisfied');

      expect(signals.physiologicalStress).toBe('high'); // max of individual signals
    });
  });
});

// =============================================================================
// PATTERN TESTS
// =============================================================================

describe('Patterns', () => {
  describe('detectPatterns', () => {
    it('should detect survival_mode when any physiological is critical', () => {
      const signals: SignalState = createSignals({
        physiological: {
          hunger: 'critical',
          fatigue: 'satisfied',
          hydration: 'satisfied',
          health: 'satisfied',
        },
        physiologicalStress: 'critical',
      });

      const patterns = detectPatterns(signals);
      const survivalPattern = patterns.find((p) => p.id === 'survival_mode');

      expect(survivalPattern).toBeDefined();
      expect(survivalPattern!.triggers).toContain('hunger');
      expect(survivalPattern!.intensity).toBeGreaterThanOrEqual(0.9);
    });

    it('should detect foundation_shaky when security is low', () => {
      const signals: SignalState = createSignals({
        drives: { security: 'low' },
      });

      const patterns = detectPatterns(signals);
      const foundationPattern = patterns.find(
        (p) => p.id === 'foundation_shaky'
      );

      expect(foundationPattern).toBeDefined();
      expect(foundationPattern!.triggers).toContain('security');
    });

    it('should detect seeking_connection when social is low and security is balanced', () => {
      const signals: SignalState = createSignals({
        drives: { social: 'low', security: 'balanced' },
      });

      const patterns = detectPatterns(signals);
      const connectionPattern = patterns.find(
        (p) => p.id === 'seeking_connection'
      );

      expect(connectionPattern).toBeDefined();
    });

    it('should NOT detect seeking_connection when security is also low', () => {
      const signals: SignalState = createSignals({
        drives: { social: 'low', security: 'low' },
      });

      const patterns = detectPatterns(signals);
      const connectionPattern = patterns.find(
        (p) => p.id === 'seeking_connection'
      );

      expect(connectionPattern).toBeUndefined();
    });

    it('should detect stable_foundation when security is satisfied and physiological is good', () => {
      const signals: SignalState = createSignals({
        drives: { security: 'satisfied' },
        physiologicalStress: 'satisfied',
      });

      const patterns = detectPatterns(signals);
      const stablePattern = patterns.find((p) => p.id === 'stable_foundation');

      expect(stablePattern).toBeDefined();
    });

    it('should detect multiple patterns simultaneously', () => {
      const signals: SignalState = createSignals({
        drives: {
          security: 'satisfied',
          social: 'abundant',
          autonomy: 'low',
        },
        physiologicalStress: 'satisfied',
      });

      const patterns = detectPatterns(signals);

      // Should have stable_foundation, socially_resourced, and freedom_constrained
      expect(patterns.find((p) => p.id === 'stable_foundation')).toBeDefined();
      expect(patterns.find((p) => p.id === 'socially_resourced')).toBeDefined();
      expect(
        patterns.find((p) => p.id === 'freedom_constrained')
      ).toBeDefined();
    });
  });
});

// =============================================================================
// FRAME TESTS
// =============================================================================

describe('Frames', () => {
  describe('maslowFrame', () => {
    it('should suppress growth patterns when in survival mode', () => {
      const signals: SignalState = createSignals({
        physiologicalStress: 'critical',
      });

      const patterns: ActivePattern[] = [
        { id: 'survival_mode', triggers: ['hunger'], intensity: 0.9 },
        { id: 'purpose_seeking', triggers: ['meaning'], intensity: 0.6 },
      ];

      const filtered = maslowFrame.filterPatterns(patterns, signals);

      // Should only keep survival_mode
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('survival_mode');
    });

    it('should suppress growth patterns when foundation is shaky', () => {
      const signals: SignalState = createSignals({
        drives: { security: 'low' },
      });

      const patterns: ActivePattern[] = [
        { id: 'foundation_shaky', triggers: ['security'], intensity: 0.6 },
        { id: 'purpose_seeking', triggers: ['meaning'], intensity: 0.5 },
        { id: 'recognition_hungry', triggers: ['status'], intensity: 0.5 },
      ];

      const filtered = maslowFrame.filterPatterns(patterns, signals);

      // Should filter out purpose_seeking and recognition_hungry
      expect(filtered.find((p) => p.id === 'foundation_shaky')).toBeDefined();
      expect(filtered.find((p) => p.id === 'purpose_seeking')).toBeUndefined();
      expect(
        filtered.find((p) => p.id === 'recognition_hungry')
      ).toBeUndefined();
    });

    it('should order patterns by hierarchy', () => {
      const signals: SignalState = createSignals({});

      // Use positive patterns that don't trigger filtering
      const patterns: ActivePattern[] = [
        { id: 'socially_resourced', triggers: ['social'], intensity: 0.6 },
        { id: 'seeking_connection', triggers: ['social'], intensity: 0.5 },
        { id: 'stable_foundation', triggers: ['security'], intensity: 0.7 },
      ];

      const filtered = maslowFrame.filterPatterns(patterns, signals);

      // Should be ordered by hierarchy: seeking_connection (3), stable_foundation (6), socially_resourced (7)
      expect(filtered.length).toBe(3);
      expect(filtered[0].id).toBe('seeking_connection');
      expect(filtered[1].id).toBe('stable_foundation');
      expect(filtered[2].id).toBe('socially_resourced');
    });

    it('should generate meaningful narrative', () => {
      const priorities: MotivationPriority[] = [
        { need: 'restore_security', intensity: 0.8, drivers: ['security'] },
      ];
      const constraints = [
        {
          type: 'risk_averse',
          because: 'security_low',
          guidance: 'Avoid risk',
        },
      ];
      const opportunities: any[] = [];

      const narrative = maslowFrame.generateNarrative(
        priorities,
        constraints,
        opportunities
      );

      expect(narrative).toContain('foundation');
      expect(narrative.length).toBeGreaterThan(20);
    });
  });

  describe('survivalFrame', () => {
    it('should activate when physiological stress is critical', () => {
      const signals: SignalState = createSignals({
        physiologicalStress: 'critical',
      });

      expect(survivalFrame.shouldActivate!(signals)).toBe(true);
    });

    it('should not activate when physiological stress is low', () => {
      const signals: SignalState = createSignals({
        physiologicalStress: 'moderate',
      });

      expect(survivalFrame.shouldActivate!(signals)).toBe(false);
    });
  });
});

// =============================================================================
// OUTPUT TESTS
// =============================================================================

describe('Output', () => {
  describe('patternsToPriorities', () => {
    it('should convert patterns to priorities', () => {
      const patterns: ActivePattern[] = [
        {
          id: 'foundation_shaky',
          triggers: ['security', 'health'],
          intensity: 0.8,
        },
        { id: 'seeking_connection', triggers: ['social'], intensity: 0.5 },
      ];

      const priorities = patternsToPriorities(patterns);

      expect(priorities.length).toBe(2);
      expect(priorities[0].need).toBe('restore_security');
      expect(priorities[0].intensity).toBe(0.8);
      expect(priorities[0].drivers).toContain('security');
      expect(priorities[0].drivers).toContain('health');

      expect(priorities[1].need).toBe('seek_connection');
    });
  });

  describe('patternsToConstraints', () => {
    it('should generate constraints from survival_mode', () => {
      const patterns: ActivePattern[] = [
        { id: 'survival_mode', triggers: ['hunger'], intensity: 0.9 },
      ];

      const constraints = patternsToConstraints(patterns);

      expect(constraints.some((c) => c.type === 'immediate_only')).toBe(true);
      expect(constraints.some((c) => c.type === 'conserve_resources')).toBe(
        true
      );
    });

    it('should generate risk_averse constraint from foundation_shaky', () => {
      const patterns: ActivePattern[] = [
        { id: 'foundation_shaky', triggers: ['security'], intensity: 0.7 },
      ];

      const constraints = patternsToConstraints(patterns);

      expect(constraints.some((c) => c.type === 'risk_averse')).toBe(true);
    });

    it('should add high_urgency constraint for high intensity patterns', () => {
      const patterns: ActivePattern[] = [
        { id: 'foundation_shaky', triggers: ['security'], intensity: 0.85 },
      ];

      const constraints = patternsToConstraints(patterns);

      expect(constraints.some((c) => c.type === 'high_urgency')).toBe(true);
    });
  });

  describe('patternsToOpportunities', () => {
    it('should generate opportunities from stable_foundation', () => {
      const patterns: ActivePattern[] = [
        {
          id: 'stable_foundation',
          triggers: ['security', 'physiological'],
          intensity: 0.7,
        },
      ];
      const signals = createSignals({});

      const opportunities = patternsToOpportunities(patterns, signals);

      expect(opportunities.some((o) => o.type === 'growth_available')).toBe(
        true
      );
    });

    it('should generate opportunities from socially_resourced', () => {
      const patterns: ActivePattern[] = [
        { id: 'socially_resourced', triggers: ['social'], intensity: 0.6 },
      ];
      const signals = createSignals({});

      const opportunities = patternsToOpportunities(patterns, signals);

      expect(opportunities.some((o) => o.type === 'leverage_connections')).toBe(
        true
      );
    });

    it('should sort opportunities by potential', () => {
      const patterns: ActivePattern[] = [
        { id: 'stable_foundation', triggers: ['security'], intensity: 0.7 },
        { id: 'socially_resourced', triggers: ['social'], intensity: 0.6 },
      ];
      const signals = createSignals({});

      const opportunities = patternsToOpportunities(patterns, signals);

      // Should be sorted by potential (highest first)
      for (let i = 1; i < opportunities.length; i++) {
        expect(opportunities[i - 1].potential).toBeGreaterThanOrEqual(
          opportunities[i].potential
        );
      }
    });
  });
});

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Create a SignalState with defaults and overrides.
 */
function createSignals(
  overrides: Partial<{
    drives: Partial<SignalState['drives']>;
    physiological: Partial<SignalState['physiological']>;
    physiologicalStress: SignalState['physiologicalStress'];
    resources: SignalState['resources'];
  }>
): SignalState {
  return {
    drives: {
      security: 'balanced',
      social: 'balanced',
      status: 'balanced',
      autonomy: 'balanced',
      meaning: 'balanced',
      ...overrides.drives,
    },
    physiological: {
      hunger: 'satisfied',
      fatigue: 'satisfied',
      hydration: 'satisfied',
      health: 'satisfied',
      ...overrides.physiological,
    },
    physiologicalStress: overrides.physiologicalStress || 'satisfied',
    resources: overrides.resources || {},
  };
}
