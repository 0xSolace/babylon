/**
 * Dynamics Module Tests
 *
 * Tests confidence and decay functionality.
 */

import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_CONFIDENCE_CONFIG,
  getConfidenceLabel,
  isConfident,
  mergeEvidence,
  updateConfidence,
} from '../src/dynamics/confidence';
import {
  calculateDecayMultiplier,
  DECAY_PRESETS,
  getDecayLabel,
  getEffectiveValue,
  isExpired,
} from '../src/dynamics/decay';

describe('Confidence', () => {
  describe('updateConfidence', () => {
    it('should increase confidence on reinforcement', () => {
      const newConfidence = updateConfidence(50, 'reinforce');
      expect(newConfidence).toBeGreaterThan(50);
      expect(newConfidence).toBeLessThanOrEqual(100);
    });

    it('should decrease confidence on contradiction', () => {
      const newConfidence = updateConfidence(50, 'contradict');
      expect(newConfidence).toBeLessThan(50);
      expect(newConfidence).toBeGreaterThanOrEqual(
        DEFAULT_CONFIDENCE_CONFIG.minConfidence
      );
    });

    it('should not change confidence on neutral', () => {
      const newConfidence = updateConfidence(50, 'neutral');
      expect(newConfidence).toBe(50);
    });

    it('should have diminishing returns at high confidence', () => {
      const boost1 = updateConfidence(30, 'reinforce') - 30;
      const boost2 = updateConfidence(80, 'reinforce') - 80;
      expect(boost1).toBeGreaterThan(boost2);
    });

    it('should not exceed 100', () => {
      const newConfidence = updateConfidence(99, 'reinforce');
      expect(newConfidence).toBeLessThanOrEqual(100);
    });

    it('should not go below min confidence', () => {
      let confidence = 50;
      for (let i = 0; i < 10; i++) {
        confidence = updateConfidence(confidence, 'contradict');
      }
      expect(confidence).toBeGreaterThanOrEqual(
        DEFAULT_CONFIDENCE_CONFIG.minConfidence
      );
    });
  });

  describe('isConfident', () => {
    it('should return true for high confidence', () => {
      expect(isConfident(80)).toBe(true);
      expect(isConfident(40)).toBe(true);
    });

    it('should return false for low confidence', () => {
      expect(isConfident(20)).toBe(false);
      expect(isConfident(39)).toBe(false);
    });

    it('should respect custom threshold', () => {
      expect(isConfident(50, 60)).toBe(false);
      expect(isConfident(50, 40)).toBe(true);
    });
  });

  describe('getConfidenceLabel', () => {
    it('should return correct labels', () => {
      expect(getConfidenceLabel(90)).toBe('very high');
      expect(getConfidenceLabel(70)).toBe('high');
      expect(getConfidenceLabel(50)).toBe('moderate');
      expect(getConfidenceLabel(30)).toBe('low');
      expect(getConfidenceLabel(10)).toBe('very low');
    });
  });

  describe('mergeEvidence', () => {
    it('should merge and deduplicate evidence', () => {
      const existing = ['a', 'b'];
      const newEv = ['b', 'c'];
      const merged = mergeEvidence(existing, newEv);
      expect(merged).toContain('a');
      expect(merged).toContain('b');
      expect(merged).toContain('c');
      expect(merged.filter((x) => x === 'b').length).toBe(1);
    });

    it('should respect max limit', () => {
      const existing = ['a', 'b', 'c', 'd', 'e'];
      const newEv = ['f', 'g', 'h', 'i', 'j'];
      const merged = mergeEvidence(existing, newEv, 5);
      expect(merged.length).toBe(5);
    });

    it('should prioritize new evidence', () => {
      const existing = ['old'];
      const newEv = ['new1', 'new2'];
      const merged = mergeEvidence(existing, newEv, 2);
      expect(merged).toContain('new1');
      expect(merged).toContain('new2');
    });
  });
});

describe('Decay', () => {
  describe('calculateDecayMultiplier', () => {
    it('should return 1 for age 0', () => {
      expect(calculateDecayMultiplier(0)).toBe(1);
    });

    it('should return 0.5 at half-life', () => {
      const halfLife = DECAY_PRESETS.standard.halfLifeMs;
      const multiplier = calculateDecayMultiplier(
        halfLife,
        DECAY_PRESETS.standard
      );
      expect(Math.abs(multiplier - 0.5)).toBeLessThan(0.001);
    });

    it('should return 0.25 at 2x half-life', () => {
      const halfLife = DECAY_PRESETS.standard.halfLifeMs;
      const multiplier = calculateDecayMultiplier(
        halfLife * 2,
        DECAY_PRESETS.standard
      );
      expect(Math.abs(multiplier - 0.25)).toBeLessThan(0.001);
    });

    it('should return 1 for permanent preset', () => {
      const multiplier = calculateDecayMultiplier(
        1000000000,
        DECAY_PRESETS.permanent
      );
      expect(multiplier).toBe(1);
    });

    it('should not go below minValue', () => {
      const veryOldAge = DECAY_PRESETS.standard.halfLifeMs * 100;
      const multiplier = calculateDecayMultiplier(
        veryOldAge,
        DECAY_PRESETS.standard
      );
      expect(multiplier).toBeGreaterThanOrEqual(
        DECAY_PRESETS.standard.minValue
      );
    });
  });

  describe('getEffectiveValue', () => {
    it('should return base value for fresh memory', () => {
      const now = Date.now();
      const value = getEffectiveValue(100, now, DECAY_PRESETS.standard, now);
      expect(value).toBe(100);
    });

    it('should decay over time', () => {
      const now = Date.now();
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
      const value = getEffectiveValue(
        100,
        oneWeekAgo,
        DECAY_PRESETS.standard,
        now
      );
      expect(value).toBeLessThan(100);
      expect(value).toBeGreaterThan(0);
    });
  });

  describe('isExpired', () => {
    it('should return false for fresh memory', () => {
      const now = Date.now();
      expect(isExpired(now, DECAY_PRESETS.standard, now)).toBe(false);
    });

    it('should return true for very old memory', () => {
      const now = Date.now();
      const veryOld = now - DECAY_PRESETS.standard.halfLifeMs * 100;
      expect(isExpired(veryOld, DECAY_PRESETS.standard, now)).toBe(true);
    });

    it('should never expire for permanent preset', () => {
      const now = Date.now();
      const veryOld = now - 365 * 24 * 60 * 60 * 1000 * 100; // 100 years
      expect(isExpired(veryOld, DECAY_PRESETS.permanent, now)).toBe(false);
    });
  });

  describe('getDecayLabel', () => {
    it('should return fresh for new memory', () => {
      const now = Date.now();
      expect(getDecayLabel(now, DECAY_PRESETS.standard, now)).toBe('fresh');
    });

    it('should return stale for old memory', () => {
      const now = Date.now();
      const old = now - DECAY_PRESETS.standard.halfLifeMs * 10;
      expect(getDecayLabel(old, DECAY_PRESETS.standard, now)).toBe('stale');
    });
  });
});
