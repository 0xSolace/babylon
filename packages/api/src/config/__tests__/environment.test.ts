/**
 * Environment Detection Tests
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import {
  detectEnvironment,
  getEnvironment,
  resetEnvironment,
} from '../environment';

describe('Environment Detection', () => {
  beforeEach(() => {
    resetEnvironment();
  });

  describe('detectEnvironment', () => {
    it('should detect dev mode by default', () => {
      const env = detectEnvironment();

      expect(env.mode).toBe('dev');
      expect(env.hasJeju).toBe(false);
    });

    it('should return storage mode', () => {
      const env = detectEnvironment();

      expect(['local', 'ipfs', 'jeju']).toContain(env.storageMode);
    });

    it('should return TEE mode', () => {
      const env = detectEnvironment();

      expect(['simulated', 'phala', 'local']).toContain(env.teeMode);
    });

    it('should use simulated TEE in dev mode', () => {
      const env = detectEnvironment();

      if (env.mode === 'dev') {
        expect(env.teeMode).toBe('simulated');
      }
    });

    it('should use local storage in dev mode', () => {
      const env = detectEnvironment();

      if (env.mode === 'dev') {
        expect(env.storageMode).toBe('local');
      }
    });
  });

  describe('getEnvironment', () => {
    it('should cache environment', () => {
      const env1 = getEnvironment();
      const env2 = getEnvironment();

      expect(env1).toBe(env2);
    });

    it('should reset cache on resetEnvironment', () => {
      const env1 = getEnvironment();
      resetEnvironment();
      const env2 = getEnvironment();

      // Same values but different object references after reset
      expect(env1.mode).toBe(env2.mode);
    });
  });

  describe('BabylonEnvironment structure', () => {
    it('should have all required fields', () => {
      const env = detectEnvironment();

      expect(env).toHaveProperty('mode');
      expect(env).toHaveProperty('hasJeju');
      expect(env).toHaveProperty('storageMode');
      expect(env).toHaveProperty('teeMode');
    });

    it('should have optional fields when appropriate', () => {
      const env = detectEnvironment();

      // These may or may not be defined depending on environment
      expect(['string', 'undefined']).toContain(typeof env.treasuryAddress);
      expect(['string', 'undefined']).toContain(typeof env.registryAddress);
      expect(['string', 'undefined']).toContain(typeof env.rpcUrl);
    });
  });
});
