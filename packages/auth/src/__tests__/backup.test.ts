/**
 * Key Backup Tests
 */

import { describe, expect, it } from 'bun:test';
import { KeyBackupManager } from '../recovery/backup';
import type { DID } from '../types/index';

describe('KeyBackupManager', () => {
  const manager = new KeyBackupManager({
    iterations: 1000, // Lower for tests
    saltLength: 16,
    ivLength: 12,
  });

  const testUserId =
    'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID;
  const testPassword = 'secure-test-password-123';

  describe('createBackup', () => {
    it('should create an encrypted backup', async () => {
      const backup = await manager.createBackup(testUserId, testPassword);

      expect(backup.version).toBe(1);
      expect(backup.userId).toBe(testUserId);
      expect(backup.encryptedKey).toStartWith('0x');
      expect(backup.salt).toStartWith('0x');
      expect(backup.iv).toStartWith('0x');
      expect(backup.iterations).toBe(1000);
      expect(backup.createdAt).toBeGreaterThan(0);
    });

    it('should create different backups with same password', async () => {
      const backup1 = await manager.createBackup(testUserId, testPassword);
      const backup2 = await manager.createBackup(testUserId, testPassword);

      // Salt and IV should be different
      expect(backup1.salt).not.toBe(backup2.salt);
      expect(backup1.iv).not.toBe(backup2.iv);
    });
  });

  describe('verifyBackup', () => {
    it('should verify backup with correct password', async () => {
      const backup = await manager.createBackup(testUserId, testPassword);
      const isValid = await manager.verifyBackup(backup, testPassword);

      expect(isValid).toBe(true);
    });

    it('should reject backup with wrong password', async () => {
      const backup = await manager.createBackup(testUserId, testPassword);

      await expect(
        manager.verifyBackup(backup, 'wrong-password')
      ).rejects.toThrow();
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore key material from backup', async () => {
      const backup = await manager.createBackup(testUserId, testPassword);
      const restored = await manager.restoreFromBackup(backup, testPassword);

      expect(restored).toBeInstanceOf(Uint8Array);
      expect(restored.length).toBe(32); // SHA-256 hash length
    });
  });

  describe('exportToJSON / importFromJSON', () => {
    it('should export and import backup as JSON', async () => {
      const backup = await manager.createBackup(testUserId, testPassword);
      const json = KeyBackupManager.exportToJSON(backup);
      const imported = KeyBackupManager.importFromJSON(json);

      expect(imported.userId).toBe(backup.userId);
      expect(imported.encryptedKey).toBe(backup.encryptedKey);
      expect(imported.salt).toBe(backup.salt);
      expect(imported.iv).toBe(backup.iv);
    });

    it('should reject invalid JSON', () => {
      expect(() => KeyBackupManager.importFromJSON('{}')).toThrow(
        'Invalid backup format'
      );
    });
  });

  describe('exportToBase64 / importFromBase64', () => {
    it('should export and import backup as base64', async () => {
      const backup = await manager.createBackup(testUserId, testPassword);
      const base64 = KeyBackupManager.exportToBase64(backup);
      const imported = KeyBackupManager.importFromBase64(base64);

      expect(imported.userId).toBe(backup.userId);
    });
  });
});
