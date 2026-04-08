/** Lookback for positions used in 24h change estimate (matches route behavior). */
export const MARKETS_WIDGET_RECENT_POSITIONS_MS = 24 * 60 * 60 * 1000;

const THIRTY_D_MS = 30 * 24 * 60 * 60 * 1000;
const WIDGET_TOP_N = 10;

type WidgetQuestion = {
  id: string | number;
  text: string;
  status: string;
  resolutionDate: Date | null | undefined;
};

type WidgetMarket = {
  id: string;
  yesShares: unknown;
  noShares: unknown;
};

type WidgetPosition = {
  marketId: string;
  shares: unknown;
  side: boolean;
};

export type MarketsWidgetRow = {
  id: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  endDate: Date | null | undefined;
  changePercent24h?: number;
};

function buildPriceChangePercentMap(
  marketIds: string[],
  marketMap: Map<string, WidgetMarket>,
  recentPositions: WidgetPosition[]
): Map<string, number> {
  const priceChangeMap = new Map<string, number>();

  for (const marketId of marketIds) {
    const marketPositions = recentPositions.filter(
      (p) => p.marketId === marketId
    );
    if (marketPositions.length === 0) continue;

    const market = marketMap.get(marketId);
    if (!market) continue;

    const currentYesShares = Number(market.yesShares);
    const currentNoShares = Number(market.noShares);
    const currentTotal = currentYesShares + currentNoShares;

    if (currentTotal <= 0) continue;

    let pastYesShares = currentYesShares;
    let pastNoShares = currentNoShares;

    for (const pos of marketPositions) {
      const shares = Number(pos.shares);
      if (pos.side) {
        pastYesShares -= shares;
      } else {
        pastNoShares -= shares;
      }
    }

    const pastTotal = pastYesShares + pastNoShares;
    if (pastTotal <= 0) continue;

    const pastYesPrice = pastYesShares / pastTotal;
    const currentYesPrice = currentYesShares / currentTotal;
    const priceChange = currentYesPrice - pastYesPrice;
    const changePercent =
      pastYesPrice > 0 ? (priceChange / pastYesPrice) * 100 : 0;

    priceChangeMap.set(marketId, changePercent);
  }

  return priceChangeMap;
}

/**
 * Shared shape for GET /api/feed/widgets/markets (cached + authenticated paths).
 */
export function formatMarketsWidgetRows<
  Q extends WidgetQuestion,
  M extends WidgetMarket,
  P extends WidgetPosition,
>(questions: Q[], markets: M[], recentPositions: P[]): MarketsWidgetRow[] {
  if (questions.length === 0) {
    return [];
  }

  const marketIds = questions.map((q) => String(q.id));
  const marketMap = new Map(markets.map((m) => [m.id, m]));
  const priceChangeMap = buildPriceChangePercentMap(
    marketIds,
    marketMap,
    recentPositions
  );

  return questions
    .filter((q) => q.status === 'active')
    .map((q) => {
      const market = marketMap.get(String(q.id));
      const yesShares = market ? Number(market.yesShares) : 0;
      const noShares = market ? Number(market.noShares) : 0;
      const totalShares = yesShares + noShares;

      const yesPrice = totalShares > 0 ? yesShares / totalShares : 0.5;
      const noPrice = totalShares > 0 ? noShares / totalShares : 0.5;
      const changePercent24h = priceChangeMap.get(String(q.id));

      return {
        id: String(q.id),
        question: q.text,
        yesPrice,
        noPrice,
        volume: totalShares,
        endDate: q.resolutionDate,
        changePercent24h:
          changePercent24h !== undefined ? changePercent24h : undefined,
      };
    })
    .sort((a, b) => {
      const aTime = a.endDate ? new Date(a.endDate).getTime() : Date.now();
      const bTime = b.endDate ? new Date(b.endDate).getTime() : Date.now();
      const now = Date.now();

      const aRecency = Math.max(0, 1 - (aTime - now) / THIRTY_D_MS);
      const bRecency = Math.max(0, 1 - (bTime - now) / THIRTY_D_MS);

      const aScore = a.volume * 0.7 + aRecency * 1000 * 0.3;
      const bScore = b.volume * 0.7 + bRecency * 1000 * 0.3;

      return bScore - aScore;
    })
    .slice(0, WIDGET_TOP_N);
}
