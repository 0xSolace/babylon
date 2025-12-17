/**
 * Unruggable Game Service Tests
 */

import { describe, expect, it } from 'bun:test';
import {
  createUnruggableGameService,
  UNRUGGABLE_CHECKLIST,
  UnruggableGameService,
} from '../unruggable-game-service';

describe('UnruggableGameService', () => {
  const service = createUnruggableGameService({
    treasuryAddress: '0x1234567890123456789012345678901234567890',
    dailyWithdrawalLimit: 10n * 10n ** 18n,
    councilMembers: [
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333',
    ],
    jnsName: 'babylon.jeju',
    erc8004ServiceId: 'babylon-game-1',
    frontendCid: 'QmExampleFrontendCid',
    backupCronNodes: ['node1.example.com', 'node2.example.com'],
  });

  describe('checkStatus', () => {
    it('should return comprehensive status', async () => {
      const status = await service.checkStatus();

      expect(status).toHaveProperty('isUnruggable');
      expect(status).toHaveProperty('score');
      expect(status).toHaveProperty('issues');
      expect(status).toHaveProperty('warnings');
      expect(status).toHaveProperty('treasury');
      expect(status).toHaveProperty('operator');
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('discovery');
      expect(status).toHaveProperty('frontend');
      expect(status).toHaveProperty('recovery');
    });

    it('should have score between 0 and 100', async () => {
      const status = await service.checkStatus();

      expect(status.score).toBeGreaterThanOrEqual(0);
      expect(status.score).toBeLessThanOrEqual(100);
    });
  });

  describe('getRecoveryProcedure', () => {
    it('should return operator takeover procedure', () => {
      const procedure = service.getRecoveryProcedure('operator_down');

      expect(procedure.type).toBe('operator_takeover');
      expect(procedure.steps.length).toBeGreaterThan(0);
      expect(procedure.requiredApprovals).toBe(0);
    });

    it('should return key rotation procedure', () => {
      const procedure = service.getRecoveryProcedure('key_compromised');

      expect(procedure.type).toBe('key_rotation');
      expect(procedure.requiredApprovals).toBe(2);
    });

    it('should return state recovery procedure', () => {
      const procedure = service.getRecoveryProcedure('state_corrupted');

      expect(procedure.type).toBe('state_recovery');
      expect(procedure.steps.length).toBeGreaterThan(0);
    });

    it('should return frontend recovery procedure', () => {
      const procedure = service.getRecoveryProcedure('frontend_unavailable');

      expect(procedure.type).toBe('full_restart');
      expect(procedure.estimatedTime).toBeDefined();
    });
  });
});

describe('UNRUGGABLE_CHECKLIST', () => {
  it('should have required items', () => {
    expect(UNRUGGABLE_CHECKLIST.required.length).toBeGreaterThan(0);

    for (const item of UNRUGGABLE_CHECKLIST.required) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('label');
    }
  });

  it('should have recommended items', () => {
    expect(UNRUGGABLE_CHECKLIST.recommended.length).toBeGreaterThan(0);

    for (const item of UNRUGGABLE_CHECKLIST.recommended) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('label');
    }
  });

  it('should cover all critical areas', () => {
    const requiredIds = UNRUGGABLE_CHECKLIST.required.map((i) => i.id);

    expect(requiredIds).toContain('treasury_funded');
    expect(requiredIds).toContain('operator_registered');
    expect(requiredIds).toContain('state_encrypted');
    expect(requiredIds).toContain('heartbeat_active');
    expect(requiredIds).toContain('takeover_enabled');
    expect(requiredIds).toContain('frontend_on_ipfs');
  });
});

describe('createUnruggableGameService', () => {
  it('should create service with default config', () => {
    const service = createUnruggableGameService();

    expect(service).toBeInstanceOf(UnruggableGameService);
  });

  it('should merge provided config with defaults', () => {
    const service = createUnruggableGameService({
      jnsName: 'custom.jeju',
    });

    expect(service).toBeDefined();
  });
});
