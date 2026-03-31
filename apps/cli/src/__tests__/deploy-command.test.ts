import { describe, expect, test } from 'bun:test';
import {
  buildDeploymentEnvUpdates,
  parseDeploymentOutput,
} from '../commands/deploy';

describe('deploy command helpers', () => {
  test('parses current prediction and perp facet addresses from forge output', () => {
    const output = `
Diamond (Proxy): 0x1111111111111111111111111111111111111111
DiamondCutFacet: 0x2222222222222222222222222222222222222222
DiamondLoupeFacet: 0x3333333333333333333333333333333333333333
PredictionMarketFacet: 0x4444444444444444444444444444444444444444
OracleFacet: 0x5555555555555555555555555555555555555555
GameOracleFacet: 0x6666666666666666666666666666666666666666
ReferralSystemFacet: 0x9999999999999999999999999999999999999999
PerpAdminFacet: 0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
PerpCollateralFacet: 0xcccccccccccccccccccccccccccccccccccccccc
PerpOrderFacet: 0xdddddddddddddddddddddddddddddddddddddddd
PerpSettlementFacet: 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
PerpViewFacet: 0xffffffffffffffffffffffffffffffffffffffff
IdentityRegistry: 0x1212121212121212121212121212121212121212
ReputationSystem: 0x1313131313131313131313131313131313131313
BabylonGameOracle: 0x1414141414141414141414141414141414141414
BanManager: 0x1515151515151515151515151515151515151515
ChainlinkOracle (Mock): 0x1616161616161616161616161616161616161616
MockOracle: 0x1717171717171717171717171717171717171717
MockUSDC: 0x1818181818181818181818181818181818181818
`;

    const parsed = parseDeploymentOutput(output);

    expect(parsed.diamond).toBe('0x1111111111111111111111111111111111111111');
    expect(parsed.gameOracleFacet).toBe(
      '0x6666666666666666666666666666666666666666'
    );
    expect(parsed.perpAdminFacet).toBe(
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    );
    expect(parsed.perpCollateralFacet).toBe(
      '0xcccccccccccccccccccccccccccccccccccccccc'
    );
    expect(parsed.perpOrderFacet).toBe(
      '0xdddddddddddddddddddddddddddddddddddddddd'
    );
    expect(parsed.perpSettlementFacet).toBe(
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    );
    expect(parsed.perpViewFacet).toBe(
      '0xffffffffffffffffffffffffffffffffffffffff'
    );
    expect(parsed.mockUsdc).toBe('0x1818181818181818181818181818181818181818');
  });

  test('builds environment updates for deployed facets and chain metadata', () => {
    const updates = buildDeploymentEnvUpdates(
      {
        diamond: '0x1111111111111111111111111111111111111111',
        identityRegistry: '0x2222222222222222222222222222222222222222',
        reputationSystem: '0x3333333333333333333333333333333333333333',
        predictionMarketFacet: '0x4444444444444444444444444444444444444444',
        oracleFacet: '0x5555555555555555555555555555555555555555',
        perpAdminFacet: '0x6666666666666666666666666666666666666666',
        perpViewFacet: '0x7777777777777777777777777777777777777777',
        mockUsdc: '0x8888888888888888888888888888888888888888',
      },
      8453
    );

    expect(updates.BABYLON_DIAMOND_ADDRESS).toBe(
      '0x1111111111111111111111111111111111111111'
    );
    expect(updates.NEXT_PUBLIC_DIAMOND_ADDRESS).toBe(
      '0x1111111111111111111111111111111111111111'
    );
    expect(updates.BABYLON_CHAIN_ID).toBe('8453');
    expect(updates.NEXT_PUBLIC_PERP_ADMIN_FACET).toBe(
      '0x6666666666666666666666666666666666666666'
    );
    expect(updates.NEXT_PUBLIC_PERP_VIEW_FACET).toBe(
      '0x7777777777777777777777777777777777777777'
    );
    expect(updates.NEXT_PUBLIC_MOCK_USDC).toBe(
      '0x8888888888888888888888888888888888888888'
    );
    expect(updates.NEXT_PUBLIC_LIQUIDITY_POOL_FACET).toBeUndefined();
    expect(updates.NEXT_PUBLIC_PERPETUAL_MARKET_FACET).toBeUndefined();
    expect(updates.NEXT_PUBLIC_PRICE_STORAGE_FACET).toBeUndefined();
  });
});
