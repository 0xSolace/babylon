import { describe, expect, test } from 'bun:test';
import { parseUnits } from 'viem';
import {
  buildOnchainPerpPositionId,
  calculateAcceptablePrice,
  calculateBaseSizeFromNotional,
  calculateNotionalFromBaseSize,
  calculatePositionPnl,
  computePerpOrderId,
  denormalizeCollateralToRaw,
  isOnchainPerpReadUnavailableError,
  normalizeCollateralFromRaw,
  type OnchainPerpPosition,
  parseOnchainPerpPositionId,
} from '../services/onchain-perp-service';

describe('onchain perp helpers', () => {
  test('normalizes and denormalizes 6-decimal collateral', () => {
    const rawUsdc = 1_234_567n;
    const normalized = normalizeCollateralFromRaw(rawUsdc, 6);
    expect(normalized).toBe(1_234_567_000_000_000_000n);
    expect(denormalizeCollateralToRaw(normalized, 6)).toBe(rawUsdc);
  });

  test('converts USD notional into base size using oracle price scale', () => {
    const notionalUsd = parseUnits('1000', 18);
    const price = parseUnits('250', 8);
    const size = calculateBaseSizeFromNotional(notionalUsd, price);

    expect(size).toBe(parseUnits('4', 18));
    expect(calculateNotionalFromBaseSize(size, price)).toBe(notionalUsd);
  });

  test('computes acceptable prices with side-aware slippage', () => {
    const preview = parseUnits('1000', 8);

    expect(
      calculateAcceptablePrice({
        previewPrice: preview,
        side: 'long',
        reduceOnly: false,
        maxSlippageBps: 100n,
      })
    ).toBe(parseUnits('1010', 8));
    expect(
      calculateAcceptablePrice({
        previewPrice: preview,
        side: 'short',
        reduceOnly: false,
        maxSlippageBps: 100n,
      })
    ).toBe(parseUnits('990', 8));
    expect(
      calculateAcceptablePrice({
        previewPrice: preview,
        side: 'long',
        reduceOnly: true,
        maxSlippageBps: 100n,
      })
    ).toBe(parseUnits('990', 8));
  });

  test('computes deterministic order ids and synthetic position ids', () => {
    const orderId = computePerpOrderId({
      account: '0x1111111111111111111111111111111111111111',
      nonce: 7n,
      chainId: 31337n,
      diamondAddress: '0x2222222222222222222222222222222222222222',
    });

    expect(orderId).toBe(
      '0x45854cc1ea44ca86c4909a8d460038e38d9b596163378acb9e747225dd88d16c'
    );

    const positionId = buildOnchainPerpPositionId(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
    expect(positionId).toBe(
      'onchain-0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
    expect(parseOnchainPerpPositionId(positionId)).toBe(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
    expect(parseOnchainPerpPositionId('legacy-position-id')).toBeNull();
  });

  test('computes long and short PnL with funding direction', () => {
    const longPosition: OnchainPerpPosition = {
      marketId:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      side: 'long',
      size: parseUnits('2', 18),
      collateral: parseUnits('500', 18),
      entryPrice: parseUnits('1000', 8),
      entryFunding: 0n,
    };
    const shortPosition: OnchainPerpPosition = {
      ...longPosition,
      side: 'short',
    };

    expect(
      calculatePositionPnl({
        position: longPosition,
        price: parseUnits('1100', 8),
        cumulativeFunding: parseUnits('1', 8),
      })
    ).toBe(parseUnits('198', 18));
    expect(
      calculatePositionPnl({
        position: shortPosition,
        price: parseUnits('900', 8),
        cumulativeFunding: parseUnits('1', 8),
      })
    ).toBe(parseUnits('202', 18));
  });

  test('detects zero-data read errors for unavailable on-chain perp views', () => {
    const unavailableError = Object.assign(
      new Error(
        'The contract function "getPerpMarketIds" returned no data ("0x").'
      ),
      {
        name: 'ContractFunctionExecutionError',
        cause: {
          name: 'ContractFunctionZeroDataError',
          message:
            'The contract function "getPerpMarketIds" returned no data ("0x").',
        },
      }
    );

    expect(isOnchainPerpReadUnavailableError(unavailableError)).toBe(true);
    expect(
      isOnchainPerpReadUnavailableError(new Error('random transport failure'))
    ).toBe(false);
  });
});
