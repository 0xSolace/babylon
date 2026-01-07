/**
 * Unit tests for NFT image proxy validation
 */

import { describe, expect, test } from 'bun:test';
import { getNftImageProxyUrl, isValidTokenId } from '@babylon/shared';

describe('isValidTokenId', () => {
  test('accepts valid token IDs 1-100', () => {
    expect(isValidTokenId(1)).toBe(true);
    expect(isValidTokenId(50)).toBe(true);
    expect(isValidTokenId(100)).toBe(true);
  });

  test('rejects out of range', () => {
    expect(isValidTokenId(0)).toBe(false);
    expect(isValidTokenId(101)).toBe(false);
    expect(isValidTokenId(-1)).toBe(false);
  });

  test('handles string input', () => {
    expect(isValidTokenId('50')).toBe(true);
    expect(isValidTokenId('abc')).toBe(false);
  });

  test('rejects floats', () => {
    expect(isValidTokenId(50.5)).toBe(false);
  });

  test('respects custom collection size', () => {
    expect(isValidTokenId(150, 200)).toBe(true);
    expect(isValidTokenId(201, 200)).toBe(false);
  });
});

describe('getNftImageProxyUrl', () => {
  test('generates correct proxy URLs', () => {
    expect(getNftImageProxyUrl(1)).toBe('/api/nft/image/1');
    expect(getNftImageProxyUrl(50)).toBe('/api/nft/image/50');
    expect(getNftImageProxyUrl(100)).toBe('/api/nft/image/100');
  });
});
