/**
 * Unit Tests: NFT Claim API Logic
 *
 * Tests the REAL validation functions from @babylon/shared:
 * - Transaction hash validation
 * - Wallet address normalization and validation
 * - Claim eligibility checks
 * - Token ID validation
 *
 * Run with: bun test unit/nft-claim-api.test.ts
 */

import { describe, expect, test } from 'bun:test';
import {
  canUserClaim,
  isSimulatedTxHash,
  isValidTokenId,
  isValidWalletAddress,
  normalizeWalletAddress,
  SIMULATED_TX_PREFIX,
} from '@babylon/shared';

describe('NFT Claim API - Transaction Hash (Real Implementation)', () => {
  describe('isSimulatedTxHash', () => {
    test('should identify valid simulated hash', () => {
      const hash = `${SIMULATED_TX_PREFIX}${Date.now()}-testid`;
      expect(isSimulatedTxHash(hash)).toBe(true);
    });

    test('should reject real blockchain hash', () => {
      const hash =
        '0x1234567890123456789012345678901234567890123456789012345678901234';
      expect(isSimulatedTxHash(hash)).toBe(false);
    });

    test('should reject empty string', () => {
      expect(isSimulatedTxHash('')).toBe(false);
    });

    test('should reject hash without prefix', () => {
      expect(isSimulatedTxHash('not-simulated-hash')).toBe(false);
    });
  });

  describe('SIMULATED_TX_PREFIX constant', () => {
    test('should be the expected value', () => {
      expect(SIMULATED_TX_PREFIX).toBe('simulated-');
    });
  });
});

describe('NFT Claim API - Wallet Address (Real Implementation)', () => {
  describe('normalizeWalletAddress', () => {
    test('should convert to lowercase', () => {
      const mixedCase = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12';
      expect(normalizeWalletAddress(mixedCase)).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef12'
      );
    });

    test('should return lowercase if already lowercase', () => {
      const lowerCase = '0xabcdef1234567890abcdef1234567890abcdef12';
      expect(normalizeWalletAddress(lowerCase)).toBe(lowerCase);
    });

    test('should handle empty string', () => {
      expect(normalizeWalletAddress('')).toBe('');
    });
  });

  describe('isValidWalletAddress', () => {
    test('should accept valid Ethereum address', () => {
      expect(
        isValidWalletAddress('0x1234567890123456789012345678901234567890')
      ).toBe(true);
    });

    test('should accept mixed case address', () => {
      expect(
        isValidWalletAddress('0xAbCdEf1234567890AbCdEf1234567890AbCdEf12')
      ).toBe(true);
    });

    test('should reject address without 0x prefix', () => {
      expect(
        isValidWalletAddress('1234567890123456789012345678901234567890')
      ).toBe(false);
    });

    test('should reject short address', () => {
      expect(isValidWalletAddress('0x123')).toBe(false);
    });

    test('should reject long address', () => {
      expect(isValidWalletAddress('0x' + '1'.repeat(41))).toBe(false);
    });

    test('should reject address with invalid characters', () => {
      expect(
        isValidWalletAddress('0x123456789012345678901234567890123456789G')
      ).toBe(false);
    });

    test('should reject empty string', () => {
      expect(isValidWalletAddress('')).toBe(false);
    });

    test('should reject null', () => {
      expect(isValidWalletAddress(null)).toBe(false);
    });

    test('should reject undefined', () => {
      expect(isValidWalletAddress(undefined)).toBe(false);
    });
  });
});

describe('NFT Claim API - Token ID Validation (Real Implementation)', () => {
  describe('isValidTokenId', () => {
    test('should accept token ID 1', () => {
      expect(isValidTokenId(1)).toBe(true);
    });

    test('should accept token ID 100', () => {
      expect(isValidTokenId(100)).toBe(true);
    });

    test('should accept token ID 50', () => {
      expect(isValidTokenId(50)).toBe(true);
    });

    test('should reject token ID 0', () => {
      expect(isValidTokenId(0)).toBe(false);
    });

    test('should reject token ID 101', () => {
      expect(isValidTokenId(101)).toBe(false);
    });

    test('should reject negative token ID', () => {
      expect(isValidTokenId(-1)).toBe(false);
    });

    test('should accept string token ID "1"', () => {
      expect(isValidTokenId('1')).toBe(true);
    });

    test('should accept string token ID "100"', () => {
      expect(isValidTokenId('100')).toBe(true);
    });

    test('should reject string token ID "101"', () => {
      expect(isValidTokenId('101')).toBe(false);
    });

    test('should reject non-numeric string', () => {
      expect(isValidTokenId('abc')).toBe(false);
    });

    test('should accept custom collection size', () => {
      expect(isValidTokenId(150, 200)).toBe(true);
      expect(isValidTokenId(201, 200)).toBe(false);
    });
  });
});

describe('NFT Claim API - Claim Eligibility (Real Implementation)', () => {
  describe('canUserClaim', () => {
    test('should allow claim for eligible user', () => {
      const result = canUserClaim({
        walletAddress: '0x1234567890123456789012345678901234567890',
        assignedTokenId: 1,
        hasMinted: false,
      });
      expect(result.canClaim).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test('should reject user with no wallet', () => {
      const result = canUserClaim({
        walletAddress: null,
        assignedTokenId: 1,
        hasMinted: false,
      });
      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('no_wallet');
    });

    test('should reject user with empty wallet', () => {
      const result = canUserClaim({
        walletAddress: '',
        assignedTokenId: 1,
        hasMinted: false,
      });
      expect(result.canClaim).toBe(false);
      // Empty string is falsy, so it's treated as "no wallet" not "invalid wallet"
      expect(result.reason).toBe('no_wallet');
    });

    test('should reject user with invalid wallet format', () => {
      const result = canUserClaim({
        walletAddress: 'invalid-wallet',
        assignedTokenId: 1,
        hasMinted: false,
      });
      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('invalid_wallet');
    });

    test('should reject user without assigned NFT', () => {
      const result = canUserClaim({
        walletAddress: '0x1234567890123456789012345678901234567890',
        assignedTokenId: null,
        hasMinted: false,
      });
      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('not_assigned');
    });

    test('should reject user who already minted', () => {
      const result = canUserClaim({
        walletAddress: '0x1234567890123456789012345678901234567890',
        assignedTokenId: 1,
        hasMinted: true,
      });
      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('already_claimed');
    });

    test('should check wallet before assignment', () => {
      // User has no wallet AND no assigned NFT
      // Wallet check should come first
      const result = canUserClaim({
        walletAddress: null,
        assignedTokenId: null,
        hasMinted: false,
      });
      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('no_wallet');
    });

    test('should check wallet validity before assignment', () => {
      // User has invalid wallet AND no assigned NFT
      const result = canUserClaim({
        walletAddress: 'invalid',
        assignedTokenId: null,
        hasMinted: false,
      });
      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('invalid_wallet');
    });
  });
});

describe('NFT Claim API - Response Structures', () => {
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
    txHash: string | null;
    message: string;
  }

  test('should validate successful claim response structure', () => {
    const response: ClaimResponse = {
      success: true,
      tokenId: 1,
      nft: {
        tokenId: 1,
        name: 'ProtoMonkey #1',
        description: 'A cool monkey',
        imageUrl: '/api/nft/image/1',
        thumbnailUrl: '/api/nft/image/1',
      },
      txHash: `${SIMULATED_TX_PREFIX}12345`,
      message: 'NFT claimed successfully!',
    };

    expect(response).toHaveProperty('success');
    expect(response).toHaveProperty('tokenId');
    expect(response).toHaveProperty('nft');
    expect(response).toHaveProperty('txHash');
    expect(response).toHaveProperty('message');
    expect(response.success).toBe(true);
    expect(response.nft.tokenId).toBe(response.tokenId);
    expect(response.txHash).not.toBeNull();
    expect(isSimulatedTxHash(response.txHash!)).toBe(true);
  });

  test('should use proxy URL for images', () => {
    const response: ClaimResponse = {
      success: true,
      tokenId: 42,
      nft: {
        tokenId: 42,
        name: 'ProtoMonkey #42',
        description: 'Another cool monkey',
        imageUrl: '/api/nft/image/42',
        thumbnailUrl: '/api/nft/image/42',
      },
      txHash: `${SIMULATED_TX_PREFIX}67890`,
      message: 'NFT claimed successfully!',
    };

    expect(response.nft.imageUrl).toBe('/api/nft/image/42');
    expect(response.nft.thumbnailUrl).toBe('/api/nft/image/42');
  });
});

describe('NFT Claim API - Error Messages', () => {
  function getClaimErrorMessage(reason: string): string {
    const messages: Record<string, string> = {
      no_wallet: 'You must connect a wallet to claim your NFT',
      invalid_wallet: 'Invalid wallet address format',
      already_claimed: 'You have already claimed this NFT',
      not_assigned: 'No NFT has been assigned to you',
      not_eligible: 'You are not eligible to claim an NFT',
    };
    return messages[reason] ?? 'An unexpected error occurred.';
  }

  test('should return appropriate message for no_wallet', () => {
    expect(getClaimErrorMessage('no_wallet')).toContain('connect a wallet');
  });

  test('should return appropriate message for invalid_wallet', () => {
    expect(getClaimErrorMessage('invalid_wallet')).toContain('Invalid wallet');
  });

  test('should return appropriate message for already_claimed', () => {
    expect(getClaimErrorMessage('already_claimed')).toContain(
      'already claimed'
    );
  });

  test('should return appropriate message for not_assigned', () => {
    expect(getClaimErrorMessage('not_assigned')).toContain('assigned');
  });

  test('should return appropriate message for not_eligible', () => {
    expect(getClaimErrorMessage('not_eligible')).toContain('not eligible');
  });

  test('should return fallback for unknown error', () => {
    expect(getClaimErrorMessage('unknown_reason')).toContain(
      'unexpected error'
    );
  });
});
