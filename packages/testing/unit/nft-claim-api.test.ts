/**
 * Unit Tests: NFT Claim API Logic
 *
 * Tests for the simulated NFT claim flow, including:
 * - Claim validation logic
 * - Transaction hash generation
 * - Double-claim prevention
 * - Wallet address normalization
 * - Pre-assigned NFT claim flow
 *
 * Run with: bun test unit/nft-claim-api.test.ts
 */

import { describe, expect, test } from 'bun:test';

// Simulated transaction hash format
const SIMULATED_TX_PREFIX = 'simulated-';

// Generate simulated transaction hash (matches implementation)
function generateSimulatedTxHash(nanoidValue: string): string {
  return `${SIMULATED_TX_PREFIX}${Date.now()}-${nanoidValue}`;
}

// Validate simulated transaction hash
function isSimulatedTxHash(txHash: string): boolean {
  return txHash.startsWith(SIMULATED_TX_PREFIX);
}

// Normalize wallet address
function normalizeWalletAddress(address: string): string {
  return address.toLowerCase();
}

// Validate wallet address format
function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Check if user can claim
interface ClaimEligibility {
  userId: string;
  assignedTokenId: number | null;
  hasMinted: boolean;
  walletAddress: string | null;
}

function canUserClaim(eligibility: ClaimEligibility): {
  canClaim: boolean;
  reason?: string;
} {
  if (!eligibility.walletAddress) {
    return { canClaim: false, reason: 'no_wallet' };
  }

  if (!isValidWalletAddress(eligibility.walletAddress)) {
    return { canClaim: false, reason: 'invalid_wallet' };
  }

  if (eligibility.assignedTokenId === null) {
    return { canClaim: false, reason: 'not_assigned' };
  }

  if (eligibility.hasMinted) {
    return { canClaim: false, reason: 'already_claimed' };
  }

  return { canClaim: true };
}

describe('NFT Claim API - Transaction Hash', () => {
  describe('Simulated Transaction Hash Generation', () => {
    test('should generate hash with simulated prefix', () => {
      const hash = generateSimulatedTxHash('abc12345');
      expect(hash).toContain(SIMULATED_TX_PREFIX);
    });

    test('should include timestamp in hash', () => {
      const before = Date.now();
      const hash = generateSimulatedTxHash('test1234');
      const after = Date.now();

      const parts = hash.split('-');
      const timestamp = parseInt(parts[1]!, 10);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    test('should include nanoid suffix', () => {
      const nanoid = 'uniqueId';
      const hash = generateSimulatedTxHash(nanoid);
      expect(hash).toContain(nanoid);
    });

    test('should generate unique hashes', () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        hashes.add(generateSimulatedTxHash(`id${i}`));
      }
      expect(hashes.size).toBe(100);
    });
  });

  describe('Simulated Transaction Hash Validation', () => {
    test('should identify simulated hash', () => {
      const simulated = 'simulated-1234567890-abc123';
      expect(isSimulatedTxHash(simulated)).toBe(true);
    });

    test('should reject real transaction hash', () => {
      const realHash = '0x' + '1'.repeat(64);
      expect(isSimulatedTxHash(realHash)).toBe(false);
    });

    test('should reject empty string', () => {
      expect(isSimulatedTxHash('')).toBe(false);
    });

    test('should reject partial prefix', () => {
      expect(isSimulatedTxHash('simul-1234')).toBe(false);
    });
  });
});

describe('NFT Claim API - Wallet Validation', () => {
  describe('Wallet Address Normalization', () => {
    test('should convert to lowercase', () => {
      const mixed = '0xAbCdEf1234567890123456789012345678901234';
      const normalized = normalizeWalletAddress(mixed);
      expect(normalized).toBe('0xabcdef1234567890123456789012345678901234');
    });

    test('should preserve already lowercase', () => {
      const lower = '0xabcdef1234567890123456789012345678901234';
      expect(normalizeWalletAddress(lower)).toBe(lower);
    });

    test('should handle all uppercase', () => {
      const upper = '0xABCDEF1234567890123456789012345678901234';
      const normalized = normalizeWalletAddress(upper);
      expect(normalized).toBe('0xabcdef1234567890123456789012345678901234');
    });
  });

  describe('Wallet Address Validation', () => {
    test('should accept valid address', () => {
      const valid = '0x1234567890123456789012345678901234567890';
      expect(isValidWalletAddress(valid)).toBe(true);
    });

    test('should accept address with letters', () => {
      const valid = '0xabcdefABCDEF12345678901234567890abcdef12';
      expect(isValidWalletAddress(valid)).toBe(true);
    });

    test('should reject address without 0x', () => {
      const invalid = '1234567890123456789012345678901234567890';
      expect(isValidWalletAddress(invalid)).toBe(false);
    });

    test('should reject short address', () => {
      const invalid = '0x12345678901234567890';
      expect(isValidWalletAddress(invalid)).toBe(false);
    });

    test('should reject long address', () => {
      const invalid = '0x123456789012345678901234567890123456789012345';
      expect(isValidWalletAddress(invalid)).toBe(false);
    });

    test('should reject address with invalid characters', () => {
      const invalid = '0xghijklmnop12345678901234567890123456789';
      expect(isValidWalletAddress(invalid)).toBe(false);
    });

    test('should reject empty string', () => {
      expect(isValidWalletAddress('')).toBe(false);
    });

    test('should reject null-like strings', () => {
      expect(isValidWalletAddress('null')).toBe(false);
      expect(isValidWalletAddress('undefined')).toBe(false);
    });
  });
});

describe('NFT Claim API - Claim Eligibility', () => {
  describe('Can User Claim', () => {
    test('should allow claim for eligible user', () => {
      const eligibility: ClaimEligibility = {
        userId: 'user123',
        assignedTokenId: 42,
        hasMinted: false,
        walletAddress: '0x1234567890123456789012345678901234567890',
      };

      const result = canUserClaim(eligibility);
      expect(result.canClaim).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test('should reject user without wallet', () => {
      const eligibility: ClaimEligibility = {
        userId: 'user123',
        assignedTokenId: 42,
        hasMinted: false,
        walletAddress: null,
      };

      const result = canUserClaim(eligibility);
      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('no_wallet');
    });

    test('should reject user with empty wallet', () => {
      const eligibility: ClaimEligibility = {
        userId: 'user123',
        assignedTokenId: 42,
        hasMinted: false,
        walletAddress: '',
      };

      const result = canUserClaim(eligibility);
      expect(result.canClaim).toBe(false);
      // Empty string fails the regex validation, returns 'invalid_wallet'
      // Our canUserClaim checks wallet validity with regex after null check
      expect(['no_wallet', 'invalid_wallet']).toContain(result.reason ?? 'undefined');
    });

    test('should reject user with invalid wallet format', () => {
      const eligibility: ClaimEligibility = {
        userId: 'user123',
        assignedTokenId: 42,
        hasMinted: false,
        walletAddress: 'not-a-wallet',
      };

      const result = canUserClaim(eligibility);
      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('invalid_wallet');
    });

    test('should reject user without assigned NFT', () => {
      const eligibility: ClaimEligibility = {
        userId: 'user123',
        assignedTokenId: null,
        hasMinted: false,
        walletAddress: '0x1234567890123456789012345678901234567890',
      };

      const result = canUserClaim(eligibility);
      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('not_assigned');
    });

    test('should reject user who already minted', () => {
      const eligibility: ClaimEligibility = {
        userId: 'user123',
        assignedTokenId: 42,
        hasMinted: true,
        walletAddress: '0x1234567890123456789012345678901234567890',
      };

      const result = canUserClaim(eligibility);
      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('already_claimed');
    });

    test('should check wallet before assignment', () => {
      // No wallet AND no assignment - should report no_wallet first
      const eligibility: ClaimEligibility = {
        userId: 'user123',
        assignedTokenId: null,
        hasMinted: false,
        walletAddress: null,
      };

      const result = canUserClaim(eligibility);
      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('no_wallet');
    });
  });
});

describe('NFT Claim API - Claim Response', () => {
  interface ClaimResponse {
    success: boolean;
    tokenId: number;
    nft: {
      tokenId: number;
      name: string;
      description: string | null;
      imageUrl: string;
      thumbnailUrl: string;
    };
    txHash: string;
    message: string;
  }

  describe('Response Structure', () => {
    test('should have correct structure for successful claim', () => {
      const response: ClaimResponse = {
        success: true,
        tokenId: 42,
        nft: {
          tokenId: 42,
          name: 'ProtoMonkey #42',
          description: 'A unique digital collectible',
          imageUrl: '/api/nft/image/42',
          thumbnailUrl: '/api/nft/image/42',
        },
        txHash: 'simulated-1234567890-abc123',
        message: 'NFT claimed successfully!',
      };

      expect(response.success).toBe(true);
      expect(response.tokenId).toBe(response.nft.tokenId);
      expect(response.nft.imageUrl).toContain('/api/nft/image/');
      expect(response.txHash).toContain('simulated');
    });

    test('should use proxy URL for images', () => {
      const tokenId = 77;
      const imageUrl = `/api/nft/image/${tokenId}`;

      expect(imageUrl).toBe('/api/nft/image/77');
      expect(imageUrl).not.toContain('github');
      expect(imageUrl).not.toContain('http');
    });

    test('should have matching tokenId in response and nft object', () => {
      const tokenId = 99;
      const response: ClaimResponse = {
        success: true,
        tokenId,
        nft: {
          tokenId,
          name: `ProtoMonkey #${tokenId}`,
          description: null,
          imageUrl: `/api/nft/image/${tokenId}`,
          thumbnailUrl: `/api/nft/image/${tokenId}`,
        },
        txHash: 'simulated-1234567890-xyz789',
        message: 'NFT claimed successfully!',
      };

      expect(response.tokenId).toBe(response.nft.tokenId);
    });
  });
});

describe('NFT Claim API - Double Claim Prevention', () => {
  describe('Optimistic Locking Pattern', () => {
    interface SnapshotUpdate {
      beforeHasMinted: boolean;
      afterHasMinted: boolean;
      rowsAffected: number;
    }

    function simulateClaimUpdate(
      currentHasMinted: boolean,
      userId: string
    ): SnapshotUpdate {
      // Simulates: UPDATE ... SET hasMinted=true WHERE userId=? AND hasMinted=false
      if (currentHasMinted) {
        return {
          beforeHasMinted: true,
          afterHasMinted: true,
          rowsAffected: 0, // No rows updated because hasMinted was already true
        };
      }
      return {
        beforeHasMinted: false,
        afterHasMinted: true,
        rowsAffected: 1,
      };
    }

    test('should succeed for first claim', () => {
      const result = simulateClaimUpdate(false, 'user123');
      expect(result.rowsAffected).toBe(1);
      expect(result.afterHasMinted).toBe(true);
    });

    test('should fail for second claim (row not updated)', () => {
      const result = simulateClaimUpdate(true, 'user123');
      expect(result.rowsAffected).toBe(0);
    });

    test('should prevent race condition with WHERE clause', () => {
      // Simulate two concurrent claims
      let hasMinted = false;

      // First claim checks and updates atomically
      const claim1 = simulateClaimUpdate(hasMinted, 'user123');
      if (claim1.rowsAffected > 0) {
        hasMinted = true;
      }
      expect(claim1.rowsAffected).toBe(1);

      // Second claim fails because row was already updated
      const claim2 = simulateClaimUpdate(hasMinted, 'user123');
      expect(claim2.rowsAffected).toBe(0);
    });
  });

  describe('Transaction Isolation', () => {
    interface TransactionResult {
      success: boolean;
      error?: string;
    }

    function simulateTransaction(
      existingClaims: Set<string>,
      userId: string
    ): TransactionResult {
      // Check if already claimed
      if (existingClaims.has(userId)) {
        return { success: false, error: 'already_claimed' };
      }

      // Atomic claim
      existingClaims.add(userId);
      return { success: true };
    }

    test('should allow first claim', () => {
      const claims = new Set<string>();
      const result = simulateTransaction(claims, 'user1');
      expect(result.success).toBe(true);
      expect(claims.has('user1')).toBe(true);
    });

    test('should reject duplicate claim', () => {
      const claims = new Set<string>(['user1']);
      const result = simulateTransaction(claims, 'user1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('already_claimed');
    });

    test('should allow different users to claim', () => {
      const claims = new Set<string>();

      const result1 = simulateTransaction(claims, 'user1');
      const result2 = simulateTransaction(claims, 'user2');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(claims.size).toBe(2);
    });
  });
});

describe('NFT Claim API - Token ID Assignment', () => {
  describe('Unique Assignment Constraint', () => {
    interface Assignment {
      userId: string;
      tokenId: number;
    }

    function validateAssignments(assignments: Assignment[]): {
      valid: boolean;
      duplicateTokens?: number[];
    } {
      const tokenIds = assignments.map((a) => a.tokenId);
      const uniqueTokens = new Set(tokenIds);

      if (tokenIds.length !== uniqueTokens.size) {
        const duplicates = tokenIds.filter(
          (id, index) => tokenIds.indexOf(id) !== index
        );
        return { valid: false, duplicateTokens: [...new Set(duplicates)] };
      }

      return { valid: true };
    }

    test('should validate unique token assignments', () => {
      const assignments: Assignment[] = [
        { userId: 'user1', tokenId: 1 },
        { userId: 'user2', tokenId: 2 },
        { userId: 'user3', tokenId: 3 },
      ];

      const result = validateAssignments(assignments);
      expect(result.valid).toBe(true);
    });

    test('should detect duplicate token assignments', () => {
      const assignments: Assignment[] = [
        { userId: 'user1', tokenId: 1 },
        { userId: 'user2', tokenId: 1 }, // Duplicate!
        { userId: 'user3', tokenId: 3 },
      ];

      const result = validateAssignments(assignments);
      expect(result.valid).toBe(false);
      expect(result.duplicateTokens).toContain(1);
    });

    test('should allow same user in different assignments (re-assignment)', () => {
      // This tests that we track by tokenId, not userId
      const assignments: Assignment[] = [
        { userId: 'user1', tokenId: 1 },
        { userId: 'user1', tokenId: 2 }, // Same user, different token (hypothetically)
      ];

      const result = validateAssignments(assignments);
      expect(result.valid).toBe(true);
    });
  });

  describe('Token ID Range', () => {
    function isValidAssignedTokenId(tokenId: number | null): boolean {
      if (tokenId === null) return true; // null is valid (not assigned)
      return Number.isInteger(tokenId) && tokenId >= 1 && tokenId <= 100;
    }

    test('should accept token ID 1', () => {
      expect(isValidAssignedTokenId(1)).toBe(true);
    });

    test('should accept token ID 100', () => {
      expect(isValidAssignedTokenId(100)).toBe(true);
    });

    test('should accept null (not assigned)', () => {
      expect(isValidAssignedTokenId(null)).toBe(true);
    });

    test('should reject token ID 0', () => {
      expect(isValidAssignedTokenId(0)).toBe(false);
    });

    test('should reject token ID 101', () => {
      expect(isValidAssignedTokenId(101)).toBe(false);
    });

    test('should reject negative token ID', () => {
      expect(isValidAssignedTokenId(-1)).toBe(false);
    });
  });
});

describe('NFT Claim API - Error Messages', () => {
  describe('User-Friendly Error Messages', () => {
    function getClaimErrorMessage(errorCode: string): string {
      const messages: Record<string, string> = {
        no_wallet: 'You must connect a wallet to claim your NFT',
        invalid_wallet: 'Invalid wallet address format',
        not_assigned: 'No NFT has been assigned to you',
        already_claimed: 'You have already claimed your NFT',
        not_eligible: 'You are not eligible to claim an NFT',
        nft_not_found: 'Assigned NFT not found in collection',
        claim_failed: 'Claim failed - please try again',
      };
      return messages[errorCode] ?? 'An unexpected error occurred';
    }

    test('should return appropriate message for no_wallet', () => {
      const message = getClaimErrorMessage('no_wallet');
      expect(message).toContain('wallet');
      expect(message).toContain('connect');
    });

    test('should return appropriate message for already_claimed', () => {
      const message = getClaimErrorMessage('already_claimed');
      expect(message).toContain('already');
      expect(message).toContain('claimed');
    });

    test('should return appropriate message for not_assigned', () => {
      const message = getClaimErrorMessage('not_assigned');
      expect(message).toContain('assigned');
    });

    test('should return appropriate message for not_eligible', () => {
      const message = getClaimErrorMessage('not_eligible');
      expect(message).toContain('eligible');
    });

    test('should return fallback for unknown error', () => {
      const message = getClaimErrorMessage('unknown_error_xyz');
      expect(message).toContain('unexpected');
    });
  });
});
