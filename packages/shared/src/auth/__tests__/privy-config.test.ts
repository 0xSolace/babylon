import { describe, expect, test } from 'bun:test';
import { CHAIN } from '../../constants/chains';
import { privyConfig } from '../privy-config';

describe('privyConfig', () => {
  test('keeps EVM chain config aligned while enabling mixed EVM and Solana wallets', () => {
    const { appearance, defaultChain, supportedChains, loginMethodsAndOrder } =
      privyConfig.config;
    if (!defaultChain) throw new Error('Expected defaultChain to be set');
    if (!supportedChains) throw new Error('Expected supportedChains to be set');
    if (!loginMethodsAndOrder)
      throw new Error('Expected loginMethodsAndOrder to be set');

    expect(defaultChain).toBe(CHAIN);
    expect(supportedChains).toEqual([CHAIN]);
    expect(appearance?.walletChainType).toBe('ethereum-and-solana');
    expect(loginMethodsAndOrder.primary).toEqual([
      'twitter',
      'phantom',
      'farcaster',
      'email',
    ]);
    expect(loginMethodsAndOrder.primary).toHaveLength(4);
    expect(loginMethodsAndOrder.overflow).toContain('telegram');
    expect(loginMethodsAndOrder.overflow?.[0]).toBe('telegram');
  });
});
