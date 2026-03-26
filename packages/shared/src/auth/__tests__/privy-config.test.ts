import { describe, expect, test } from 'bun:test';

describe('privyConfig', () => {
  test('keeps EVM chain config aligned while enabling mixed EVM and Solana wallets', async () => {
    const previousChainId = process.env.NEXT_PUBLIC_CHAIN_ID;
    const previousRpcUrl = process.env.NEXT_PUBLIC_RPC_URL;

    process.env.NEXT_PUBLIC_CHAIN_ID = '1';
    process.env.NEXT_PUBLIC_RPC_URL = 'https://example.invalid';

    const moduleUrl = new URL('../privy-config.ts', import.meta.url);
    const { privyConfig } = (await import(
      `${moduleUrl.href}?t=${Date.now()}`
    )) as typeof import('../privy-config');

    const {
      appearance,
      defaultChain,
      supportedChains,
      loginMethods,
      loginMethodsAndOrder,
    } = privyConfig.config;
    if (!defaultChain) throw new Error('Expected defaultChain to be set');
    if (!supportedChains) throw new Error('Expected supportedChains to be set');
    if (!loginMethods) throw new Error('Expected loginMethods to be set');
    if (!loginMethodsAndOrder)
      throw new Error('Expected loginMethodsAndOrder to be set');

    expect(defaultChain.id).toBe(1);
    expect(supportedChains.map((chain) => chain.id)).toEqual([1]);
    expect(appearance?.walletChainType).toBe('ethereum-and-solana');
    expect(loginMethods).toContain('farcaster');
    expect(loginMethods).toEqual([
      'telegram',
      'twitter',
      'wallet',
      'farcaster',
      'email',
      'discord',
    ]);
    expect(loginMethodsAndOrder.primary).toEqual([
      'telegram',
      'twitter',
      'phantom',
      'farcaster',
      'email',
    ]);

    process.env.NEXT_PUBLIC_CHAIN_ID = previousChainId;
    process.env.NEXT_PUBLIC_RPC_URL = previousRpcUrl;
  });
});
