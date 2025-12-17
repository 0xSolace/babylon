/**
 * Extended Key Backup Tests
 *
 * Edge cases, error handling, and concurrent operations
 */

import { describe, expect, it } from 'bun:test';
import { KeyBackupManager } from '../recovery/backup';
import type { DID, KeyBackup } from '../types/index';

describe('KeyBackupManager Extended', () => {
  const manager = new KeyBackupManager({
    iterations: 1000,
    saltLength: 16,
    ivLength: 12,
  });

  describe('edge cases - input validation', () => {
    it('should handle empty password', async () => {
      const userId =
        'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID;

      // Empty password should still work (though not recommended)
      const backup = await manager.createBackup(userId, '');
      expect(backup.encryptedKey).toStartWith('0x');

      const isValid = await manager.verifyBackup(backup, '');
      expect(isValid).toBe(true);
    });

    it('should handle very long passwords', async () => {
      const userId =
        'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID;
      const longPassword = 'a'.repeat(10000);

      const backup = await manager.createBackup(userId, longPassword);
      const isValid = await manager.verifyBackup(backup, longPassword);
      expect(isValid).toBe(true);
    });

    it('should handle unicode passwords', async () => {
      const userId =
        'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID;
      const unicodePassword = '密码🔐パスワード🔑';

      const backup = await manager.createBackup(userId, unicodePassword);
      const isValid = await manager.verifyBackup(backup, unicodePassword);
      expect(isValid).toBe(true);
    });

    it('should handle special characters in password', async () => {
      const userId =
        'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID;
      const specialPassword = '!@#$%^&*(){}[]|\\:";\'<>,.?/~`';

      const backup = await manager.createBackup(userId, specialPassword);
      const isValid = await manager.verifyBackup(backup, specialPassword);
      expect(isValid).toBe(true);
    });
  });

  describe('edge cases - corrupted backups', () => {
    it('should reject backup with corrupted encryptedKey', async () => {
      const userId =
        'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID;
      const backup = await manager.createBackup(userId, 'password');

      // Corrupt the encrypted key
      const corruptedBackup: KeyBackup = {
        ...backup,
        encryptedKey: '0xdeadbeef' as `0x${string}`,
      };

      await expect(
        manager.verifyBackup(corruptedBackup, 'password')
      ).rejects.toThrow();
    });

    it('should reject backup with corrupted salt', async () => {
      const userId =
        'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID;
      const backup = await manager.createBackup(userId, 'password');

      // Corrupt the salt
      const corruptedBackup: KeyBackup = {
        ...backup,
        salt: '0xbadcafe' as `0x${string}`,
      };

      await expect(
        manager.verifyBackup(corruptedBackup, 'password')
      ).rejects.toThrow();
    });

    it('should reject backup with corrupted IV', async () => {
      const userId =
        'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID;
      const backup = await manager.createBackup(userId, 'password');

      // Corrupt the IV
      const corruptedBackup: KeyBackup = {
        ...backup,
        iv: '0xbad' as `0x${string}`,
      };

      await expect(
        manager.verifyBackup(corruptedBackup, 'password')
      ).rejects.toThrow();
    });
  });

  describe('edge cases - JSON import/export', () => {
    it('should reject malformed JSON', () => {
      expect(() => KeyBackupManager.importFromJSON('not valid json')).toThrow();
    });

    it('should reject backup missing userId', () => {
      const json = JSON.stringify({
        encryptedKey: '0x123',
        salt: '0x456',
        iv: '0x789',
      });
      expect(() => KeyBackupManager.importFromJSON(json)).toThrow(
        'Invalid backup format'
      );
    });

    it('should reject backup missing encryptedKey', () => {
      const json = JSON.stringify({
        userId: 'did:jeju:testnet:0x123',
        salt: '0x456',
        iv: '0x789',
      });
      expect(() => KeyBackupManager.importFromJSON(json)).toThrow(
        'Invalid backup format'
      );
    });

    it('should handle extra fields in JSON gracefully', async () => {
      const userId =
        'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID;
      const backup = await manager.createBackup(userId, 'password');

      const json = JSON.stringify({
        ...backup,
        extraField: 'should be ignored',
        anotherExtra: 123,
      });

      const imported = KeyBackupManager.importFromJSON(json);
      expect(imported.userId).toBe(userId);
    });
  });

  describe('edge cases - base64 import/export', () => {
    it('should reject invalid base64', () => {
      expect(() =>
        KeyBackupManager.importFromBase64('not!valid@base64#$%')
      ).toThrow();
    });

    it('should reject valid base64 with invalid JSON content', () => {
      const invalidJson = btoa('not json');
      expect(() => KeyBackupManager.importFromBase64(invalidJson)).toThrow();
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple concurrent backups', async () => {
      const userIds = [
        'did:jeju:testnet:0x1111111111111111111111111111111111111111' as DID,
        'did:jeju:testnet:0x2222222222222222222222222222222222222222' as DID,
        'did:jeju:testnet:0x3333333333333333333333333333333333333333' as DID,
        'did:jeju:testnet:0x4444444444444444444444444444444444444444' as DID,
        'did:jeju:testnet:0x5555555555555555555555555555555555555555' as DID,
      ];

      // Create backups concurrently
      const backups = await Promise.all(
        userIds.map((userId, i) => manager.createBackup(userId, `password${i}`))
      );

      expect(backups).toHaveLength(5);

      // Each backup should be unique
      const salts = new Set(backups.map((b) => b.salt));
      expect(salts.size).toBe(5);

      // Each backup should be verifiable
      const verifications = await Promise.all(
        backups.map((backup, i) => manager.verifyBackup(backup, `password${i}`))
      );
      expect(verifications.every((v) => v === true)).toBe(true);
    });

    it('should handle concurrent restore operations', async () => {
      const userId =
        'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID;
      const backup = await manager.createBackup(userId, 'password');

      // Restore concurrently multiple times
      const restorations = await Promise.all([
        manager.restoreFromBackup(backup, 'password'),
        manager.restoreFromBackup(backup, 'password'),
        manager.restoreFromBackup(backup, 'password'),
      ]);

      // All restorations should produce identical results
      const firstResult = Array.from(restorations[0]);
      for (const restored of restorations) {
        expect(Array.from(restored)).toEqual(firstResult);
      }
    });
  });

  describe('data integrity', () => {
    it('should produce deterministic key material for same DID', async () => {
      const userId =
        'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID;

      // Create two backups with different passwords
      const backup1 = await manager.createBackup(userId, 'password1');
      const backup2 = await manager.createBackup(userId, 'password2');

      // Restore both
      const restored1 = await manager.restoreFromBackup(backup1, 'password1');
      const restored2 = await manager.restoreFromBackup(backup2, 'password2');

      // Key material should be the same (derived from userId)
      expect(Array.from(restored1)).toEqual(Array.from(restored2));
    });

    it('should produce different key material for different DIDs', async () => {
      const userId1 =
        'did:jeju:testnet:0x1111111111111111111111111111111111111111' as DID;
      const userId2 =
        'did:jeju:testnet:0x2222222222222222222222222222222222222222' as DID;

      const backup1 = await manager.createBackup(userId1, 'password');
      const backup2 = await manager.createBackup(userId2, 'password');

      const restored1 = await manager.restoreFromBackup(backup1, 'password');
      const restored2 = await manager.restoreFromBackup(backup2, 'password');

      expect(Array.from(restored1)).not.toEqual(Array.from(restored2));
    });
  });

  describe('iteration count variations', () => {
    it('should work with minimum iterations', async () => {
      const lowIterManager = new KeyBackupManager({ iterations: 1 });
      const userId =
        'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID;

      const backup = await lowIterManager.createBackup(userId, 'password');
      expect(backup.iterations).toBe(1);

      const isValid = await lowIterManager.verifyBackup(backup, 'password');
      expect(isValid).toBe(true);
    });

    it('should use correct iteration count from backup during verification', async () => {
      const userId =
        'did:jeju:testnet:0x1234567890abcdef1234567890abcdef12345678' as DID;

      // Create with 500 iterations
      const manager500 = new KeyBackupManager({ iterations: 500 });
      const backup = await manager500.createBackup(userId, 'password');
      expect(backup.iterations).toBe(500);

      // Verify with a manager configured for different iterations
      // It should use the backup's iteration count
      const manager1000 = new KeyBackupManager({ iterations: 1000 });
      const isValid = await manager1000.verifyBackup(backup, 'password');
      expect(isValid).toBe(true);
    });
  });
});
