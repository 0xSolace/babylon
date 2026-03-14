/**
 * @fileoverview Tests for AppraisalService
 *
 * TEST STRATEGY
 * =============
 * We test the appraisal service in isolation using mocked runtime.
 * This allows us to:
 * - Control all inputs precisely
 * - Verify outputs without external dependencies
 * - Test edge cases that would be hard to reproduce in integration
 *
 * WHAT WE TEST
 * ============
 * 1. Publish - validation, ordering, replacement
 * 2. Get - retrieval, null handling
 * 3. GetAll - snapshot generation
 * 4. Clear - explicit removal
 * 5. Events - notification on changes
 *
 * WHAT WE DON'T TEST
 * ==================
 * - Provider (tested separately)
 * - Integration with motivation (integration test)
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { IAgentRuntime, UUID } from '@elizaos/core';
import { AppraisalEvents } from '../constants.ts';
import { AppraisalService } from '../services/appraisal-service.ts';
import type { Appraisal } from '../types.ts';

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Create a mock runtime for testing.
 *
 * WHY MOCK?
 * The real runtime has many dependencies. Mocking lets us test
 * AppraisalService in isolation.
 */
function createMockRuntime(): IAgentRuntime & {
  emitEvent: ReturnType<typeof mock>;
} {
  const emitEventMock = mock(() => {});

  return {
    agentId: 'test-agent-id' as UUID,
    character: { name: 'TestAgent' },
    getSetting: mock(() => null),
    getService: mock(() => null),
    logger: {
      info: mock(() => {}),
      debug: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      success: mock(() => {}),
    },
    emitEvent: emitEventMock,
  } as unknown as IAgentRuntime & { emitEvent: ReturnType<typeof mock> };
}

/**
 * Create a valid test appraisal.
 */
function createAppraisal<T>(
  overrides: Partial<Appraisal<T>> = {}
): Appraisal<T> {
  return {
    id: 'test-domain',
    ts: Date.now(),
    confidence: 0.8,
    source: 'test-plugin',
    payload: {} as T,
    ...overrides,
  };
}

// =============================================================================
// PUBLISH TESTS
// =============================================================================

describe('AppraisalService', () => {
  describe('Publish', () => {
    /**
     * Verify valid appraisals are accepted.
     */
    it('should accept valid appraisals', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      const appraisal = createAppraisal({
        id: 'money',
        confidence: 0.85,
        source: 'plugin-money',
        payload: { status: 'cautious' },
      });

      const result = service.publish(appraisal);

      expect(result).toBe(true);
      expect(service.get('money')).toEqual(appraisal);
    });

    /**
     * Verify newer appraisals replace older ones.
     */
    it('should replace older appraisals with newer ones', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      const older = createAppraisal({ id: 'money', ts: 1000, confidence: 0.5 });
      const newer = createAppraisal({ id: 'money', ts: 2000, confidence: 0.9 });

      service.publish(older);
      service.publish(newer);

      expect(service.get('money')?.ts).toBe(2000);
      expect(service.get('money')?.confidence).toBe(0.9);
    });

    /**
     * Verify older appraisals are rejected.
     */
    it('should reject appraisals with older timestamp', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      const newer = createAppraisal({ id: 'money', ts: 2000, confidence: 0.9 });
      const older = createAppraisal({ id: 'money', ts: 1000, confidence: 0.5 });

      service.publish(newer);
      const result = service.publish(older);

      expect(result).toBe(false);
      expect(service.get('money')?.ts).toBe(2000);
    });

    /**
     * Verify appraisals with same timestamp are rejected.
     */
    it('should reject appraisals with same timestamp', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      const first = createAppraisal({ id: 'money', ts: 1000, confidence: 0.5 });
      const second = createAppraisal({
        id: 'money',
        ts: 1000,
        confidence: 0.9,
      });

      service.publish(first);
      const result = service.publish(second);

      expect(result).toBe(false);
      expect(service.get('money')?.confidence).toBe(0.5);
    });

    /**
     * Verify missing id throws error.
     */
    it('should throw if id is missing', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      const appraisal = createAppraisal({ id: '' });

      expect(() => service.publish(appraisal)).toThrow(
        'Appraisal must include id'
      );
    });

    /**
     * Verify missing ts throws error.
     */
    it('should throw if ts is missing', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      const appraisal = createAppraisal();
      delete (appraisal as any).ts;

      expect(() => service.publish(appraisal)).toThrow(
        'Appraisal must include ts'
      );
    });

    /**
     * Verify missing source throws error.
     */
    it('should throw if source is missing', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      const appraisal = createAppraisal({ source: '' });

      expect(() => service.publish(appraisal)).toThrow(
        'Appraisal must include source'
      );
    });

    /**
     * Verify missing confidence throws error.
     */
    it('should throw if confidence is missing', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      const appraisal = createAppraisal();
      delete (appraisal as any).confidence;

      expect(() => service.publish(appraisal)).toThrow(
        'Appraisal must include confidence'
      );
    });

    /**
     * Verify confidence must be 0-1.
     */
    it('should throw if confidence is out of range', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      expect(() =>
        service.publish(createAppraisal({ confidence: -0.1 }))
      ).toThrow('Appraisal confidence must be between 0 and 1');

      expect(() =>
        service.publish(createAppraisal({ confidence: 1.1 }))
      ).toThrow('Appraisal confidence must be between 0 and 1');
    });

    /**
     * Verify event is emitted on publish.
     */
    it('should emit APPRAISAL_UPDATED event on publish', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      const appraisal = createAppraisal({ id: 'money' });
      service.publish(appraisal);

      expect(runtime.emitEvent).toHaveBeenCalledWith(
        AppraisalEvents.UPDATED,
        expect.objectContaining({
          appraisalId: 'money',
          appraisal,
        })
      );
    });

    /**
     * Verify previousAppraisal is included when replacing.
     */
    it('should include previousAppraisal in event when replacing', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      const older = createAppraisal({ id: 'money', ts: 1000 });
      const newer = createAppraisal({ id: 'money', ts: 2000 });

      service.publish(older);
      service.publish(newer);

      expect(runtime.emitEvent).toHaveBeenLastCalledWith(
        AppraisalEvents.UPDATED,
        expect.objectContaining({
          appraisalId: 'money',
          appraisal: newer,
          previousAppraisal: older,
        })
      );
    });
  });

  // ===========================================================================
  // GET TESTS
  // ===========================================================================

  describe('Get', () => {
    /**
     * Verify get returns correct appraisal.
     */
    it('should return appraisal by id', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      const appraisal = createAppraisal({
        id: 'money',
        payload: { status: 'good' },
      });
      service.publish(appraisal);

      const result = service.get<{ status: string }>('money');
      expect(result?.payload.status).toBe('good');
    });

    /**
     * Verify get returns null for unknown id.
     */
    it('should return null for unknown id', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      expect(service.get('unknown')).toBeNull();
    });
  });

  // ===========================================================================
  // GETALL TESTS
  // ===========================================================================

  describe('GetAll', () => {
    /**
     * Verify getAll returns all appraisals.
     */
    it('should return all appraisals as record', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      service.publish(createAppraisal({ id: 'money', ts: 1000 }));
      service.publish(createAppraisal({ id: 'power', ts: 1001 }));
      service.publish(createAppraisal({ id: 'notoriety', ts: 1002 }));

      const all = service.getAll();

      expect(Object.keys(all)).toHaveLength(3);
      expect(all.money).toBeDefined();
      expect(all.power).toBeDefined();
      expect(all.notoriety).toBeDefined();
    });

    /**
     * Verify getAll returns empty object when no appraisals.
     */
    it('should return empty object when no appraisals', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      const all = service.getAll();
      expect(Object.keys(all)).toHaveLength(0);
    });
  });

  // ===========================================================================
  // GETIDS TESTS
  // ===========================================================================

  describe('GetIds', () => {
    /**
     * Verify getIds returns all registered ids.
     */
    it('should return all registered appraisal ids', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      service.publish(createAppraisal({ id: 'money', ts: 1000 }));
      service.publish(createAppraisal({ id: 'power', ts: 1001 }));

      const ids = service.getIds();

      expect(ids).toContain('money');
      expect(ids).toContain('power');
      expect(ids).toHaveLength(2);
    });
  });

  // ===========================================================================
  // CLEAR TESTS
  // ===========================================================================

  describe('Clear', () => {
    /**
     * Verify clear removes appraisal.
     */
    it('should remove appraisal by id', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      service.publish(createAppraisal({ id: 'money' }));
      expect(service.get('money')).not.toBeNull();

      const result = service.clear('money');

      expect(result).toBe(true);
      expect(service.get('money')).toBeNull();
    });

    /**
     * Verify clear returns false for unknown id.
     */
    it('should return false when clearing unknown id', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      const result = service.clear('unknown');
      expect(result).toBe(false);
    });

    /**
     * Verify APPRAISAL_CLEARED event is emitted.
     */
    it('should emit APPRAISAL_CLEARED event', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      const appraisal = createAppraisal({ id: 'money' });
      service.publish(appraisal);
      service.clear('money');

      expect(runtime.emitEvent).toHaveBeenCalledWith(
        AppraisalEvents.CLEARED,
        expect.objectContaining({
          appraisalId: 'money',
          clearedAppraisal: appraisal,
        })
      );
    });
  });

  // ===========================================================================
  // MULTIPLE DOMAINS TESTS
  // ===========================================================================

  describe('Multiple Domains', () => {
    /**
     * Verify multiple domains can coexist independently.
     */
    it('should maintain separate appraisals per domain', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      service.publish(
        createAppraisal({ id: 'money', ts: 1000, confidence: 0.5 })
      );
      service.publish(
        createAppraisal({ id: 'power', ts: 1001, confidence: 0.7 })
      );
      service.publish(
        createAppraisal({ id: 'notoriety', ts: 1002, confidence: 0.9 })
      );

      expect(service.get('money')?.confidence).toBe(0.5);
      expect(service.get('power')?.confidence).toBe(0.7);
      expect(service.get('notoriety')?.confidence).toBe(0.9);
    });

    /**
     * Verify updating one domain doesn't affect others.
     */
    it('should not affect other domains when updating one', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      service.publish(
        createAppraisal({ id: 'money', ts: 1000, confidence: 0.5 })
      );
      service.publish(
        createAppraisal({ id: 'power', ts: 1001, confidence: 0.7 })
      );

      // Update money
      service.publish(
        createAppraisal({ id: 'money', ts: 2000, confidence: 0.9 })
      );

      // Power should be unchanged
      expect(service.get('power')?.confidence).toBe(0.7);
      expect(service.get('power')?.ts).toBe(1001);
    });

    /**
     * Verify clearing one domain doesn't affect others.
     */
    it('should not affect other domains when clearing one', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      service.publish(createAppraisal({ id: 'money', ts: 1000 }));
      service.publish(createAppraisal({ id: 'power', ts: 1001 }));

      service.clear('money');

      expect(service.get('money')).toBeNull();
      expect(service.get('power')).not.toBeNull();
    });
  });

  // ===========================================================================
  // STOP TESTS
  // ===========================================================================

  describe('Stop', () => {
    /**
     * Verify stop clears all appraisals.
     */
    it('should clear all appraisals on stop', async () => {
      const runtime = createMockRuntime();
      const service = await AppraisalService.start(runtime);

      service.publish(createAppraisal({ id: 'money', ts: 1000 }));
      service.publish(createAppraisal({ id: 'power', ts: 1001 }));

      await service.stop();

      expect(service.getIds()).toHaveLength(0);
    });
  });
});
