import { describe, expect, test } from 'bun:test';

describe('privyConfig', () => {
  test('is single-chain and provisions both Ethereum and Solana embedded wallets', async () => {
    const previousChainId = process.env.NEXT_PUBLIC_CHAIN_ID;
    const previousRpcUrl = process.env.NEXT_PUBLIC_RPC_URL;

    const moduleUrl = new URL('../privy-config.ts', import.meta.url);
    const { privyConfig } = (await import(
      `${moduleUrl.href}?t=${Date.now()}`
    )) as typeof import('../privy-config');

    const { defaultChain, supportedChains, embeddedWallets } =
      privyConfig.config;
    if (!defaultChain) throw new Error('Expected defaultChain to be set');
    if (!supportedChains) throw new Error('Expected supportedChains to be set');

    expect(supportedChains.map((chain) => chain.id)).toEqual([defaultChain.id]);
    expect(embeddedWallets?.ethereum?.createOnLogin).toBe(
      'users-without-wallets'
    );
    expect(embeddedWallets?.solana?.createOnLogin).toBe(
      'users-without-wallets'
    );

    process.env.NEXT_PUBLIC_CHAIN_ID = previousChainId;
    process.env.NEXT_PUBLIC_RPC_URL = previousRpcUrl;
  });
});
