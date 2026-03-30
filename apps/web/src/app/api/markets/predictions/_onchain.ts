import { getOnChainPredictionMarketService } from '@babylon/api';
import { logger } from '@babylon/shared';

export type PredictionOnchainOverlay = {
  onChainMarketId: string;
  onChainMarketAddress: string;
  onChainState: number;
  onChainOutcome: number;
  yesShares: number;
  noShares: number;
  liquidity: number;
  yesProbability: number;
  noProbability: number;
  userYesShares?: number;
  userNoShares?: number;
};

function normalizeAmount(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

export async function getPredictionOnchainOverlay(
  onChainMarketId: string,
  userWalletAddress?: string
): Promise<PredictionOnchainOverlay | null> {
  try {
    const service = getOnChainPredictionMarketService();
    const [market, decimals, position] = await Promise.all([
      service.getMarket(onChainMarketId),
      service.getCollateralDecimals(),
      userWalletAddress
        ? service.getPosition(
            userWalletAddress as `0x${string}`,
            onChainMarketId
          )
        : Promise.resolve(null),
    ]);

    return {
      onChainMarketId,
      onChainMarketAddress: market.marketAddress,
      onChainState: market.state,
      onChainOutcome: market.outcome,
      yesShares: normalizeAmount(market.reserveYes, decimals),
      noShares: normalizeAmount(market.reserveNo, decimals),
      liquidity: normalizeAmount(market.liquidity, decimals),
      yesProbability: Number(market.priceYesWad) / 1e18,
      noProbability: Number(market.priceNoWad) / 1e18,
      userYesShares: position
        ? normalizeAmount(position.yesBalance, decimals)
        : undefined,
      userNoShares: position
        ? normalizeAmount(position.noBalance, decimals)
        : undefined,
    };
  } catch (error) {
    logger.warn(
      'Failed to fetch prediction market on-chain overlay; serving database snapshot',
      {
        onChainMarketId,
        userWalletAddress: userWalletAddress ?? null,
        error: error instanceof Error ? error.message : String(error),
      },
      'PredictionOnchainOverlay'
    );
    return null;
  }
}
