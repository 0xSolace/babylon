/**
 * Unit tests for NFT claim validation
 */

import { describe, expect, test } from 'bun:test';
import {
  canUserClaim,
  isSimulatedTxHash,
  isValidWalletAddress,
  normalizeWalletAddress,
  SIMULATED_TX_PREFIX,
} from '@babylon/shared';

describe('isSimulatedTxHash', () => {
  test('identifies simulated hash', () => {
    expect(isSimulatedTxHash(`${SIMULATED_TX_PREFIX}123`)).toBe(true);
  });

  test('rejects real blockchain hash', () => {
    expect(isSimulatedTxHash('0x' + '1'.repeat(64))).toBe(false);
  });

  test('rejects empty/invalid', () => {
    expect(isSimulatedTxHash('')).toBe(false);
    expect(isSimulatedTxHash('not-simulated')).toBe(false);
  });
});

describe('normalizeWalletAddress', () => {
  test('converts to lowercase', () => {
    expect(normalizeWalletAddress('0xAbCdEf')).toBe('0xabcdef');
  });
});

describe('isValidWalletAddress', () => {
  const valid = '0x1234567890123456789012345678901234567890';

  test('accepts valid address', () => {
    expect(isValidWalletAddress(valid)).toBe(true);
  });

  test('rejects invalid formats', () => {
    expect(isValidWalletAddress('1234567890123456789012345678901234567890')).toBe(false); // no 0x
    expect(isValidWalletAddress('0x123')).toBe(false); // too short
    expect(isValidWalletAddress('0x' + '1'.repeat(41))).toBe(false); // too long
    expect(isValidWalletAddress('0x' + 'G'.repeat(40))).toBe(false); // invalid chars
  });

  test('rejects null/undefined/empty', () => {
    expect(isValidWalletAddress(null)).toBe(false);
    expect(isValidWalletAddress(undefined)).toBe(false);
    expect(isValidWalletAddress('')).toBe(false);
  });
});

describe('canUserClaim', () => {
  const validWallet = '0x1234567890123456789012345678901234567890';

  test('allows eligible user', () => {
    const result = canUserClaim({
      walletAddress: validWallet,
      assignedTokenId: 1,
      hasMinted: false,
    });
    expect(result.canClaim).toBe(true);
  });

  test('rejects no wallet', () => {
    const result = canUserClaim({
      walletAddress: null,
      assignedTokenId: 1,
      hasMinted: false,
    });
    expect(result).toEqual({ canClaim: false, reason: 'no_wallet' });
  });

  test('rejects invalid wallet', () => {
    const result = canUserClaim({
      walletAddress: 'invalid',
      assignedTokenId: 1,
      hasMinted: false,
    });
    expect(result).toEqual({ canClaim: false, reason: 'invalid_wallet' });
  });

  test('rejects no assigned NFT', () => {
    const result = canUserClaim({
      walletAddress: validWallet,
      assignedTokenId: null,
      hasMinted: false,
    });
    expect(result).toEqual({ canClaim: false, reason: 'not_assigned' });
  });

  test('rejects already minted', () => {
    const result = canUserClaim({
      walletAddress: validWallet,
      assignedTokenId: 1,
      hasMinted: true,
    });
    expect(result).toEqual({ canClaim: false, reason: 'already_claimed' });
  });
});
