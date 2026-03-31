import { afterEach, describe, expect, test } from 'bun:test';
import { getContractAddresses } from '@babylon/contracts';

const ORIGINAL_ENV = {
  NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  BABYLON_DIAMOND_ADDRESS: process.env.BABYLON_DIAMOND_ADDRESS,
  NEXT_PUBLIC_DIAMOND_ADDRESS: process.env.NEXT_PUBLIC_DIAMOND_ADDRESS,
  NEXT_PUBLIC_IDENTITY_REGISTRY: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY,
  NEXT_PUBLIC_REPUTATION_SYSTEM: process.env.NEXT_PUBLIC_REPUTATION_SYSTEM,
  NEXT_PUBLIC_PREDICTION_MARKET_FACET:
    process.env.NEXT_PUBLIC_PREDICTION_MARKET_FACET,
  NEXT_PUBLIC_BABYLON_ORACLE: process.env.NEXT_PUBLIC_BABYLON_ORACLE,
};

function restoreEnv(): void {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

afterEach(() => {
  restoreEnv();
});

describe('contract address loader', () => {
  test('uses environment overrides for a freshly deployed Base mainnet', () => {
    process.env.NEXT_PUBLIC_CHAIN_ID = '8453';
    process.env.BABYLON_DIAMOND_ADDRESS =
      '0x1111111111111111111111111111111111111111';
    process.env.NEXT_PUBLIC_IDENTITY_REGISTRY =
      '0x2222222222222222222222222222222222222222';
    process.env.NEXT_PUBLIC_REPUTATION_SYSTEM =
      '0x3333333333333333333333333333333333333333';
    process.env.NEXT_PUBLIC_PREDICTION_MARKET_FACET =
      '0x4444444444444444444444444444444444444444';
    process.env.NEXT_PUBLIC_BABYLON_ORACLE =
      '0x5555555555555555555555555555555555555555';

    const contracts = getContractAddresses();

    expect(contracts.network).toBe('base');
    expect(contracts.chainId).toBe(8453);
    expect(contracts.diamond).toBe(
      '0x1111111111111111111111111111111111111111'
    );
    expect(contracts.identityRegistry).toBe(
      '0x2222222222222222222222222222222222222222'
    );
    expect(contracts.reputationSystem).toBe(
      '0x3333333333333333333333333333333333333333'
    );
    expect(contracts.predictionMarketFacet).toBe(
      '0x4444444444444444444444444444444444444444'
    );
    expect(contracts.babylonOracle).toBe(
      '0x5555555555555555555555555555555555555555'
    );
  });
});
