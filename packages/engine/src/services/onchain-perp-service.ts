import { getContractAddresses } from '@babylon/contracts';
import {
  CHAIN,
  ERC20_MINIMAL_ABI,
  getCurrentRpcUrl,
  getTransactionReceiptConfirmations,
  isOnchainPerpSettlementMode,
  logger,
  PERP_ADMIN_ABI,
  PERP_COLLATERAL_ABI,
  PERP_ORDER_ABI,
  PERP_SETTLEMENT_ABI,
  PERP_VIEW_ABI,
  type PerpMarket,
} from '@babylon/shared';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  encodePacked,
  formatUnits,
  type Hex,
  http,
  keccak256,
  maxUint256,
  parseAbi,
  parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const BPS = 10_000n;
const ONE = 10n ** 18n;
const PRICE_SCALE = 10n ** 8n;
const DEFAULT_MAX_SLIPPAGE_BPS = 100n;
const DEFAULT_ORDER_EXPIRY_SECONDS = 30 * 24 * 60 * 60;
const LOCAL_DEV_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const PERP_VIEW_INTERFACE = parseAbi([...PERP_VIEW_ABI]);
const PERP_ADMIN_INTERFACE = parseAbi([...PERP_ADMIN_ABI]);
const PERP_COLLATERAL_INTERFACE = parseAbi([...PERP_COLLATERAL_ABI]);
const PERP_ORDER_INTERFACE = parseAbi([...PERP_ORDER_ABI]);
const PERP_SETTLEMENT_INTERFACE = parseAbi([...PERP_SETTLEMENT_ABI]);
const ERC20_INTERFACE = parseAbi([...ERC20_MINIMAL_ABI]);

export type OnchainPerpSide = 'long' | 'short';
export type OnchainPerpOrderType = 'market' | 'limit';

export type OnchainPerpEngineConfig = {
  collateralToken: Address;
  collateralDecimals: number;
  oracleUpdater: Address;
  feeRecipient: Address;
  protocolFeeShareBps: number;
  maxOracleDelay: number;
  nextOrderNonce: bigint;
};

export type OnchainPerpOracleVersion = {
  version: bigint;
  timestamp: number;
  price: bigint;
  cumulativeFunding: bigint;
};

export type OnchainPerpMarketState = {
  id: Hex;
  symbol: string;
  maxOpenInterest: bigint;
  maxSkew: bigint;
  skewScale: bigint;
  minTradeSize: bigint;
  initialMarginBps: number;
  maintenanceMarginBps: number;
  liquidationFeeBps: number;
  openFeeBps: number;
  closeFeeBps: number;
  maxFundingVelocityBps: number;
  maxPriceImpactBps: number;
  minLiquidityBps: number;
  active: boolean;
  totalLongSize: bigint;
  totalShortSize: bigint;
  vaultBalance: bigint;
  latestVersion: bigint;
};

export type OnchainPerpPosition = {
  marketId: Hex;
  side: OnchainPerpSide;
  size: bigint;
  collateral: bigint;
  entryPrice: bigint;
  entryFunding: bigint;
};

export type OnchainPerpOrder = {
  id: Hex;
  account: Address;
  marketId: Hex;
  side: OnchainPerpSide;
  reduceOnly: boolean;
  triggerAbove: boolean;
  createdAt: number;
  executableAtVersion: bigint;
  expiry: number;
  sizeDelta: bigint;
  collateralDelta: bigint;
  triggerPrice: bigint;
  acceptablePrice: bigint;
  active: boolean;
};

export type OnchainPerpTxCall = {
  to: Address;
  data: Hex;
  description: string;
};

export type PreparedOnchainPerpOpenOrder = {
  settlementMode: 'onchain';
  marketId: Hex;
  symbol: string;
  positionId: string;
  orderId: Hex;
  side: OnchainPerpSide;
  orderType: OnchainPerpOrderType;
  sizeUsd: number;
  leverage: number;
  sizeDelta: bigint;
  indexPrice: bigint;
  estimatedExecutionPrice: bigint;
  collateralRequired: bigint;
  collateralRequiredRaw: bigint;
  estimatedFee: bigint;
  acceptablePrice: bigint;
  triggerPrice: bigint;
  triggerAbove: boolean;
  expiry: number;
  calls: OnchainPerpTxCall[];
};

export type PreparedOnchainPerpCloseOrder = {
  settlementMode: 'onchain';
  marketId: Hex;
  symbol: string;
  positionId: string;
  orderId: Hex;
  side: OnchainPerpSide;
  orderType: OnchainPerpOrderType;
  closeFractionBps: number;
  sizeDelta: bigint;
  sizeUsd: number;
  indexPrice: bigint;
  estimatedExecutionPrice: bigint;
  estimatedPnl: bigint;
  estimatedFee: bigint;
  estimatedSettlement: bigint;
  estimatedMarginReturned: bigint;
  acceptablePrice: bigint;
  triggerPrice: bigint;
  triggerAbove: boolean;
  expiry: number;
  calls: OnchainPerpTxCall[];
};

export type OnchainPerpPositionSnapshot = {
  id: string;
  marketId: Hex;
  ticker: string;
  side: OnchainPerpSide;
  entryPrice: number;
  currentPrice: number;
  size: number;
  leverage: number;
  liquidationPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  fundingPaid: number;
  margin: number;
  openedAt: string;
};

function requireOnchainMode(): void {
  if (!isOnchainPerpSettlementMode()) {
    throw new Error('On-chain perpetuals are not enabled for this environment');
  }
}

export function toPriceUnits(value: number | string): bigint {
  return parseUnits(String(value), 8);
}

export function toUsdUnits(value: number | string): bigint {
  return parseUnits(String(value), 18);
}

function fromPriceUnits(value: bigint): number {
  return Number(formatUnits(value, 8));
}

function fromUsdUnits(value: bigint): number {
  return Number(formatUnits(value, 18));
}

function ceilDiv(value: bigint, divisor: bigint): bigint {
  return value === 0n ? 0n : (value + divisor - 1n) / divisor;
}

function factorForDecimals(decimals: number): bigint {
  return 10n ** BigInt(18 - decimals);
}

export function normalizeCollateralFromRaw(
  rawAmount: bigint,
  decimals: number
): bigint {
  if (decimals === 18) {
    return rawAmount;
  }

  return rawAmount * factorForDecimals(decimals);
}

export function denormalizeCollateralToRaw(
  normalizedAmount: bigint,
  decimals: number
): bigint {
  if (decimals === 18) {
    return normalizedAmount;
  }

  return ceilDiv(normalizedAmount, factorForDecimals(decimals));
}

export function calculateBaseSizeFromNotional(
  notionalUsd: bigint,
  price: bigint
): bigint {
  return (notionalUsd * PRICE_SCALE) / price;
}

export function calculateNotionalFromBaseSize(
  sizeDelta: bigint,
  price: bigint
): bigint {
  return (sizeDelta * price) / PRICE_SCALE;
}

function sideToEnum(side: OnchainPerpSide): 0 | 1 {
  return side === 'long' ? 0 : 1;
}

function enumToSide(side: number): OnchainPerpSide {
  return side === 0 ? 'long' : 'short';
}

export function buildOnchainPerpPositionId(marketId: Hex): string {
  return `onchain-${marketId.toLowerCase()}`;
}

export function parseOnchainPerpPositionId(positionId: string): Hex | null {
  if (!positionId.startsWith('onchain-0x')) {
    return null;
  }

  const marketId = positionId.slice('onchain-'.length);
  if (!/^0x[a-f0-9]{64}$/i.test(marketId)) {
    return null;
  }

  return marketId.toLowerCase() as Hex;
}

export function computePerpOrderId(params: {
  account: Address;
  nonce: bigint;
  chainId: bigint;
  diamondAddress: Address;
}): Hex {
  return keccak256(
    encodePacked(
      ['address', 'uint256', 'uint256', 'address'],
      [params.account, params.nonce, params.chainId, params.diamondAddress]
    )
  );
}

export function calculateAcceptablePrice(params: {
  previewPrice: bigint;
  side: OnchainPerpSide;
  reduceOnly: boolean;
  maxSlippageBps?: bigint;
}): bigint {
  const slippageBps = params.maxSlippageBps ?? DEFAULT_MAX_SLIPPAGE_BPS;
  if (slippageBps === 0n) {
    return params.previewPrice;
  }

  const worseHigherPrice =
    (!params.reduceOnly && params.side === 'long') ||
    (params.reduceOnly && params.side === 'short');

  if (worseHigherPrice) {
    return (params.previewPrice * (BPS + slippageBps)) / BPS;
  }

  return (params.previewPrice * (BPS - slippageBps)) / BPS;
}

function calculateOpenFee(notionalUsd: bigint, openFeeBps: number): bigint {
  return (notionalUsd * BigInt(openFeeBps)) / BPS;
}

function calculateCloseFee(notionalUsd: bigint, closeFeeBps: number): bigint {
  return (notionalUsd * BigInt(closeFeeBps)) / BPS;
}

function calculateLeverage(notionalUsd: bigint, collateralUsd: bigint): number {
  if (collateralUsd <= 0n) {
    return 0;
  }

  return Number(
    Number(notionalUsd) / Number(ONE) / (Number(collateralUsd) / Number(ONE))
  );
}

export function calculatePositionPnl(params: {
  position: OnchainPerpPosition;
  price: bigint;
  cumulativeFunding: bigint;
}): bigint {
  if (params.position.size === 0n) {
    return 0n;
  }

  const priceDelta =
    params.position.side === 'long'
      ? params.price - params.position.entryPrice
      : params.position.entryPrice - params.price;

  const pricePnl = (params.position.size * priceDelta) / PRICE_SCALE;
  const fundingDelta = params.cumulativeFunding - params.position.entryFunding;
  let fundingPnl = (params.position.size * fundingDelta) / PRICE_SCALE;
  if (params.position.side === 'long') {
    fundingPnl = -fundingPnl;
  }

  return pricePnl + fundingPnl;
}

function calculateFundingPaid(params: {
  position: OnchainPerpPosition;
  cumulativeFunding: bigint;
}): bigint {
  const fundingDelta = params.cumulativeFunding - params.position.entryFunding;
  const fundingAmount = (params.position.size * fundingDelta) / PRICE_SCALE;
  return params.position.side === 'long' ? fundingAmount : -fundingAmount;
}

function calculateLiquidationPrice(params: {
  position: OnchainPerpPosition;
  maintenanceMarginBps: number;
  cumulativeFunding: bigint;
}): bigint {
  const maintenanceBps = BigInt(params.maintenanceMarginBps);
  const fundingDelta = params.cumulativeFunding - params.position.entryFunding;
  const fundingTerm = (params.position.size * fundingDelta) / PRICE_SCALE;
  const entryNotional =
    (params.position.size * params.position.entryPrice) / PRICE_SCALE;

  if (params.position.side === 'long') {
    const numerator =
      (entryNotional + fundingTerm - params.position.collateral) * BPS;
    const denominator = params.position.size * (BPS - maintenanceBps);
    if (numerator <= 0n || denominator <= 0n) {
      return 0n;
    }
    return (numerator * PRICE_SCALE) / denominator;
  }

  const numerator =
    (params.position.collateral + entryNotional + fundingTerm) * BPS;
  const denominator = params.position.size * (BPS + maintenanceBps);
  if (numerator <= 0n || denominator <= 0n) {
    return 0n;
  }
  return (numerator * PRICE_SCALE) / denominator;
}

function calculateReducePreview(params: {
  position: OnchainPerpPosition;
  market: OnchainPerpMarketState;
  sizeDelta: bigint;
  fillPrice: bigint;
  cumulativeFunding: bigint;
}): {
  realizedPnl: bigint;
  fee: bigint;
  settlement: bigint;
  collateralReturned: bigint;
} {
  const totalPnl = calculatePositionPnl({
    position: params.position,
    price: params.fillPrice,
    cumulativeFunding: params.cumulativeFunding,
  });
  const totalEquity = params.position.collateral + totalPnl;
  const collateralSlice =
    (params.position.collateral * params.sizeDelta) / params.position.size;
  const equitySlice = (totalEquity * params.sizeDelta) / params.position.size;
  const realizedPnl = equitySlice - collateralSlice;
  const notional = calculateNotionalFromBaseSize(
    params.sizeDelta,
    params.fillPrice
  );
  const fee = calculateCloseFee(notional, params.market.closeFeeBps);
  const settlement = equitySlice - fee;
  const collateralReturned =
    settlement > 0n ? settlement : collateralSlice + settlement;

  return {
    realizedPnl,
    fee,
    settlement,
    collateralReturned: collateralReturned > 0n ? collateralReturned : 0n,
  };
}

export class OnchainPerpService {
  readonly diamondAddress: Address;
  readonly rpcUrl: string;
  readonly publicClient: ReturnType<typeof createPublicClient>;

  constructor(params?: { diamondAddress?: Address; rpcUrl?: string }) {
    requireOnchainMode();

    const configuredDiamond =
      params?.diamondAddress ??
      (process.env.BABYLON_DIAMOND_ADDRESS as Address | undefined) ??
      (process.env.NEXT_PUBLIC_DIAMOND_ADDRESS as Address | undefined) ??
      getContractAddresses().diamond;

    if (!configuredDiamond) {
      throw new Error('NEXT_PUBLIC_DIAMOND_ADDRESS is not configured');
    }

    this.diamondAddress = configuredDiamond;
    this.rpcUrl = params?.rpcUrl ?? getCurrentRpcUrl();
    this.publicClient = createPublicClient({
      chain: CHAIN,
      transport: http(this.rpcUrl),
    }) as unknown as ReturnType<typeof createPublicClient>;
  }

  async getEngineConfig(): Promise<OnchainPerpEngineConfig> {
    const result = (await this.publicClient.readContract({
      address: this.diamondAddress,
      abi: PERP_VIEW_INTERFACE,
      functionName: 'getPerpEngineConfig',
    })) as readonly [Address, number, Address, Address, number, number, bigint];

    return {
      collateralToken: result[0],
      collateralDecimals: Number(result[1]),
      oracleUpdater: result[2],
      feeRecipient: result[3],
      protocolFeeShareBps: Number(result[4]),
      maxOracleDelay: Number(result[5]),
      nextOrderNonce: result[6],
    };
  }

  async getCollateralAllowance(
    owner: Address,
    spender: Address
  ): Promise<bigint> {
    return (await this.publicClient.readContract({
      address: (await this.getEngineConfig()).collateralToken,
      abi: ERC20_INTERFACE,
      functionName: 'allowance',
      args: [owner, spender],
    })) as bigint;
  }

  async getFreeCollateral(account: Address): Promise<bigint> {
    return (await this.publicClient.readContract({
      address: this.diamondAddress,
      abi: PERP_VIEW_INTERFACE,
      functionName: 'getPerpAccount',
      args: [account],
    })) as bigint;
  }

  async getMarketIds(): Promise<Hex[]> {
    return (await this.publicClient.readContract({
      address: this.diamondAddress,
      abi: PERP_VIEW_INTERFACE,
      functionName: 'getPerpMarketIds',
    })) as Hex[];
  }

  async getMarket(marketId: Hex): Promise<OnchainPerpMarketState> {
    const result = (await this.publicClient.readContract({
      address: this.diamondAddress,
      abi: PERP_VIEW_INTERFACE,
      functionName: 'getPerpMarket',
      args: [marketId],
    })) as readonly [
      string,
      bigint,
      bigint,
      bigint,
      bigint,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      boolean,
      bigint,
      bigint,
      bigint,
      bigint,
    ];

    return {
      id: marketId,
      symbol: result[0],
      maxOpenInterest: result[1],
      maxSkew: result[2],
      skewScale: result[3],
      minTradeSize: result[4],
      initialMarginBps: Number(result[5]),
      maintenanceMarginBps: Number(result[6]),
      liquidationFeeBps: Number(result[7]),
      openFeeBps: Number(result[8]),
      closeFeeBps: Number(result[9]),
      maxFundingVelocityBps: Number(result[10]),
      maxPriceImpactBps: Number(result[11]),
      minLiquidityBps: Number(result[12]),
      active: result[13],
      totalLongSize: result[14],
      totalShortSize: result[15],
      vaultBalance: result[16],
      latestVersion: result[17],
    };
  }

  async getMarkets(): Promise<OnchainPerpMarketState[]> {
    const marketIds = await this.getMarketIds();
    return await Promise.all(
      marketIds.map((marketId) => this.getMarket(marketId))
    );
  }

  async findMarketBySymbol(symbol: string): Promise<OnchainPerpMarketState> {
    const normalized = symbol.trim().toUpperCase();
    const markets = await this.getMarkets();
    const market = markets.find((candidate) => candidate.symbol === normalized);
    if (!market) {
      throw new Error(`Perpetual market ${normalized} not found on-chain`);
    }
    return market;
  }

  async getOracleVersion(
    marketId: Hex,
    version: bigint
  ): Promise<OnchainPerpOracleVersion> {
    const result = (await this.publicClient.readContract({
      address: this.diamondAddress,
      abi: PERP_VIEW_INTERFACE,
      functionName: 'getPerpOracleVersion',
      args: [marketId, version],
    })) as readonly [bigint, bigint, bigint];

    return {
      version,
      timestamp: Number(result[0]),
      price: result[1],
      cumulativeFunding: result[2],
    };
  }

  async getLatestOracleVersion(
    marketId: Hex,
    latestVersion?: bigint
  ): Promise<OnchainPerpOracleVersion> {
    const resolvedLatestVersion =
      latestVersion ?? (await this.getMarket(marketId)).latestVersion;

    if (resolvedLatestVersion === 0n) {
      throw new Error(`Perpetual market ${marketId} has no oracle version yet`);
    }

    return await this.getOracleVersion(marketId, resolvedLatestVersion);
  }

  async findOracleVersionAtOrBefore(
    marketId: Hex,
    latestVersion: bigint,
    targetTimestamp: number
  ): Promise<OnchainPerpOracleVersion> {
    let version = latestVersion;
    let candidate = await this.getOracleVersion(marketId, version);

    while (version > 1n && candidate.timestamp > targetTimestamp) {
      version -= 1n;
      candidate = await this.getOracleVersion(marketId, version);
    }

    return candidate;
  }

  async getPosition(
    account: Address,
    marketId: Hex
  ): Promise<OnchainPerpPosition | null> {
    const result = (await this.publicClient.readContract({
      address: this.diamondAddress,
      abi: PERP_VIEW_INTERFACE,
      functionName: 'getPerpPosition',
      args: [account, marketId],
    })) as readonly [number, bigint, bigint, bigint, bigint];

    if (result[1] === 0n) {
      return null;
    }

    return {
      marketId,
      side: enumToSide(Number(result[0])),
      size: result[1],
      collateral: result[2],
      entryPrice: result[3],
      entryFunding: result[4],
    };
  }

  async getActiveOrderIds(): Promise<Hex[]> {
    return (await this.publicClient.readContract({
      address: this.diamondAddress,
      abi: PERP_VIEW_INTERFACE,
      functionName: 'getPerpActiveOrderIds',
    })) as Hex[];
  }

  async getOrder(orderId: Hex): Promise<OnchainPerpOrder | null> {
    const result = (await this.publicClient.readContract({
      address: this.diamondAddress,
      abi: PERP_VIEW_INTERFACE,
      functionName: 'getPerpOrder',
      args: [orderId],
    })) as readonly [
      Address,
      Hex,
      number,
      boolean,
      boolean,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      boolean,
    ];

    if (
      result[0] === '0x0000000000000000000000000000000000000000' ||
      result[8] === 0n
    ) {
      return null;
    }

    return {
      id: orderId,
      account: result[0],
      marketId: result[1],
      side: enumToSide(Number(result[2])),
      reduceOnly: result[3],
      triggerAbove: result[4],
      createdAt: Number(result[5]),
      executableAtVersion: result[6],
      expiry: Number(result[7]),
      sizeDelta: result[8],
      collateralDelta: result[9],
      triggerPrice: result[10],
      acceptablePrice: result[11],
      active: result[12],
    };
  }

  async getExecutableOrders(): Promise<OnchainPerpOrder[]> {
    const orderIds = await this.getActiveOrderIds();
    if (orderIds.length === 0) {
      return [];
    }

    const executableOrders: OnchainPerpOrder[] = [];
    const latestByMarket = new Map<string, OnchainPerpOracleVersion>();
    const now = Math.floor(Date.now() / 1000);

    for (const orderId of orderIds) {
      const order = await this.getOrder(orderId);
      if (!order || !order.active) {
        continue;
      }

      if (order.expiry !== 0 && now > order.expiry) {
        continue;
      }

      let latestVersion = latestByMarket.get(order.marketId);
      if (!latestVersion) {
        const market = await this.getMarket(order.marketId);
        latestVersion = await this.getLatestOracleVersion(
          order.marketId,
          market.latestVersion
        );
        latestByMarket.set(order.marketId, latestVersion);
      }

      if (latestVersion.version < order.executableAtVersion) {
        continue;
      }

      if (order.triggerPrice > 0n) {
        const triggered = order.triggerAbove
          ? latestVersion.price >= order.triggerPrice
          : latestVersion.price <= order.triggerPrice;
        if (!triggered) {
          continue;
        }
      }

      executableOrders.push(order);
    }

    return executableOrders;
  }

  async getPositionSnapshots(
    account: Address
  ): Promise<OnchainPerpPositionSnapshot[]> {
    const markets = await this.getMarkets();
    const snapshots: OnchainPerpPositionSnapshot[] = [];

    for (const market of markets) {
      const position = await this.getPosition(account, market.id);
      if (!position) {
        continue;
      }

      const latestVersion = await this.getLatestOracleVersion(
        market.id,
        market.latestVersion
      );
      const notional = calculateNotionalFromBaseSize(
        position.size,
        latestVersion.price
      );
      const unrealizedPnl = calculatePositionPnl({
        position,
        price: latestVersion.price,
        cumulativeFunding: latestVersion.cumulativeFunding,
      });
      const fundingPaid = calculateFundingPaid({
        position,
        cumulativeFunding: latestVersion.cumulativeFunding,
      });
      const liquidationPrice = calculateLiquidationPrice({
        position,
        maintenanceMarginBps: market.maintenanceMarginBps,
        cumulativeFunding: latestVersion.cumulativeFunding,
      });
      const pnlPercent =
        position.collateral > 0n
          ? Number((unrealizedPnl * 10_000n) / position.collateral) / 100
          : 0;

      snapshots.push({
        id: buildOnchainPerpPositionId(market.id),
        marketId: market.id,
        ticker: market.symbol,
        side: position.side,
        entryPrice: fromPriceUnits(position.entryPrice),
        currentPrice: fromPriceUnits(latestVersion.price),
        size: fromUsdUnits(notional),
        leverage: calculateLeverage(notional, position.collateral),
        liquidationPrice: fromPriceUnits(liquidationPrice),
        unrealizedPnL: fromUsdUnits(unrealizedPnl),
        unrealizedPnLPercent: pnlPercent,
        fundingPaid: fromUsdUnits(fundingPaid),
        margin: fromUsdUnits(position.collateral),
        openedAt: new Date(latestVersion.timestamp * 1000).toISOString(),
      });
    }

    return snapshots;
  }

  async getMarketSnapshots(): Promise<PerpMarket[]> {
    const markets = await this.getMarkets();
    const now = Math.floor(Date.now() / 1000);

    return await Promise.all(
      markets.map(async (market) => {
        const latestVersion = await this.getLatestOracleVersion(
          market.id,
          market.latestVersion
        );
        const referenceVersion =
          market.latestVersion > 1n
            ? await this.findOracleVersionAtOrBefore(
                market.id,
                market.latestVersion,
                now - 24 * 60 * 60
              )
            : latestVersion;
        const previousVersion =
          market.latestVersion > 1n
            ? await this.getOracleVersion(market.id, market.latestVersion - 1n)
            : latestVersion;

        const currentPrice = fromPriceUnits(latestVersion.price);
        const referencePrice = fromPriceUnits(referenceVersion.price);
        const openInterestUsd = calculateNotionalFromBaseSize(
          market.totalLongSize + market.totalShortSize,
          latestVersion.price
        );
        const fundingDelta =
          latestVersion.cumulativeFunding - previousVersion.cumulativeFunding;
        const elapsedSeconds = Math.max(
          1,
          latestVersion.timestamp - previousVersion.timestamp
        );
        const fundingRateAnnualized =
          latestVersion.price > 0n
            ? (Number(fundingDelta) / Number(latestVersion.price)) *
              ((365 * 24 * 60 * 60) / elapsedSeconds)
            : 0;

        return {
          ticker: market.symbol,
          organizationId: market.id,
          name: `${market.symbol} Perpetual`,
          currentPrice,
          change24h: currentPrice - referencePrice,
          changePercent24h:
            referencePrice > 0
              ? ((currentPrice - referencePrice) / referencePrice) * 100
              : 0,
          high24h: Math.max(currentPrice, referencePrice),
          low24h: Math.min(currentPrice, referencePrice),
          volume24h: 0,
          openInterest: fromUsdUnits(openInterestUsd),
          fundingRate: {
            ticker: market.symbol,
            rate: fundingRateAnnualized,
            nextFundingTime: new Date(
              (latestVersion.timestamp + 8 * 60 * 60) * 1000
            ).toISOString(),
            predictedRate: fundingRateAnnualized,
          },
          maxLeverage: Math.floor(10_000 / market.initialMarginBps),
          minOrderSize: fromUsdUnits(
            calculateNotionalFromBaseSize(
              market.minTradeSize,
              latestVersion.price
            )
          ),
          maxPositionSize: fromUsdUnits(market.maxOpenInterest),
          markPrice: currentPrice,
          indexPrice: currentPrice,
        };
      })
    );
  }

  async prepareOpenOrder(params: {
    account: Address;
    ticker: string;
    side: OnchainPerpSide;
    sizeUsd: number;
    leverage: number;
    maxSlippage?: number;
    orderType?: OnchainPerpOrderType;
    limitPrice?: number;
    expiry?: number;
  }): Promise<PreparedOnchainPerpOpenOrder> {
    const market = await this.findMarketBySymbol(params.ticker);
    const engineConfig = await this.getEngineConfig();
    const latestVersion = await this.getLatestOracleVersion(
      market.id,
      market.latestVersion
    );
    const orderType = params.orderType ?? 'market';
    const slippageBps =
      params.maxSlippage !== undefined
        ? BigInt(Math.round(params.maxSlippage * 10_000))
        : DEFAULT_MAX_SLIPPAGE_BPS;
    const requestedNotional = toUsdUnits(params.sizeUsd);
    const sizeDelta = calculateBaseSizeFromNotional(
      requestedNotional,
      latestVersion.price
    );

    if (sizeDelta < market.minTradeSize) {
      throw new Error(
        `${market.symbol} minimum order size is ${fromUsdUnits(
          calculateNotionalFromBaseSize(
            market.minTradeSize,
            latestVersion.price
          )
        ).toFixed(2)} USD`
      );
    }

    const maxLeverage = Math.floor(10_000 / market.initialMarginBps);
    if (params.leverage > maxLeverage) {
      throw new Error(
        `${market.symbol} max leverage is ${maxLeverage}x on-chain`
      );
    }

    const referencePrice =
      orderType === 'limit' && params.limitPrice !== undefined
        ? toPriceUnits(params.limitPrice)
        : latestVersion.price;
    const triggerPrice =
      orderType === 'limit' && params.limitPrice !== undefined
        ? toPriceUnits(params.limitPrice)
        : 0n;

    if (orderType === 'limit') {
      if (params.limitPrice === undefined || params.limitPrice <= 0) {
        throw new Error('Limit orders require a positive limit price');
      }

      if (
        (params.side === 'long' && triggerPrice > latestVersion.price) ||
        (params.side === 'short' && triggerPrice < latestVersion.price)
      ) {
        throw new Error(
          'Limit orders must improve the current price: buy below market, sell above market'
        );
      }
    }

    const estimatedExecutionPrice = (await this.publicClient.readContract({
      address: this.diamondAddress,
      abi: PERP_VIEW_INTERFACE,
      functionName: 'previewPerpExecutionPrice',
      args: [
        market.id,
        referencePrice,
        sideToEnum(params.side),
        false,
        sizeDelta,
      ],
    })) as bigint;
    const notionalAtExecution = calculateNotionalFromBaseSize(
      sizeDelta,
      estimatedExecutionPrice
    );
    const estimatedFee = calculateOpenFee(
      notionalAtExecution,
      market.openFeeBps
    );
    const effectiveCollateral = notionalAtExecution / BigInt(params.leverage);
    const requiredInitialMargin =
      (notionalAtExecution * BigInt(market.initialMarginBps)) / BPS;

    if (effectiveCollateral < requiredInitialMargin) {
      throw new Error(
        `${market.symbol} requires at least ${fromUsdUnits(
          requiredInitialMargin
        ).toFixed(2)} USD of margin at the current oracle price`
      );
    }

    const collateralRequired = effectiveCollateral + estimatedFee;
    const freeCollateral = await this.getFreeCollateral(params.account);
    const additionalCollateralNeeded =
      collateralRequired > freeCollateral
        ? collateralRequired - freeCollateral
        : 0n;
    const collateralRequiredRaw = denormalizeCollateralToRaw(
      additionalCollateralNeeded,
      engineConfig.collateralDecimals
    );
    const allowance = await this.getCollateralAllowance(
      params.account,
      this.diamondAddress
    );
    const acceptablePrice =
      orderType === 'limit'
        ? triggerPrice
        : calculateAcceptablePrice({
            previewPrice: estimatedExecutionPrice,
            side: params.side,
            reduceOnly: false,
            maxSlippageBps: slippageBps,
          });
    const orderId = computePerpOrderId({
      account: params.account,
      nonce: engineConfig.nextOrderNonce,
      chainId: BigInt(CHAIN.id),
      diamondAddress: this.diamondAddress,
    });
    const calls: OnchainPerpTxCall[] = [];

    if (collateralRequiredRaw > 0n && allowance < collateralRequiredRaw) {
      calls.push({
        to: engineConfig.collateralToken,
        data: encodeFunctionData({
          abi: ERC20_INTERFACE,
          functionName: 'approve',
          args: [this.diamondAddress, maxUint256],
        }),
        description: 'approve-perp-collateral',
      });
    }

    if (collateralRequiredRaw > 0n) {
      calls.push({
        to: this.diamondAddress,
        data: encodeFunctionData({
          abi: PERP_COLLATERAL_INTERFACE,
          functionName: 'depositPerpCollateral',
          args: [collateralRequiredRaw],
        }),
        description: 'deposit-perp-collateral',
      });
    }

    const expiry =
      params.expiry ??
      Math.floor(Date.now() / 1000) + DEFAULT_ORDER_EXPIRY_SECONDS;
    const triggerAbove =
      orderType === 'limit' ? params.side === 'short' : false;

    calls.push({
      to: this.diamondAddress,
      data:
        orderType === 'limit'
          ? encodeFunctionData({
              abi: PERP_ORDER_INTERFACE,
              functionName: 'placePerpTriggerOrder',
              args: [
                market.id,
                sideToEnum(params.side),
                false,
                sizeDelta,
                collateralRequired,
                triggerPrice,
                acceptablePrice,
                triggerAbove,
                BigInt(expiry),
              ],
            })
          : encodeFunctionData({
              abi: PERP_ORDER_INTERFACE,
              functionName: 'placePerpMarketOrder',
              args: [
                market.id,
                sideToEnum(params.side),
                false,
                sizeDelta,
                collateralRequired,
                acceptablePrice,
                BigInt(expiry),
              ],
            }),
      description:
        orderType === 'limit'
          ? 'place-perp-limit-order'
          : 'place-perp-market-order',
    });

    return {
      settlementMode: 'onchain',
      marketId: market.id,
      symbol: market.symbol,
      positionId: buildOnchainPerpPositionId(market.id),
      orderId,
      side: params.side,
      orderType,
      sizeUsd: fromUsdUnits(notionalAtExecution),
      leverage: params.leverage,
      sizeDelta,
      indexPrice: latestVersion.price,
      estimatedExecutionPrice,
      collateralRequired,
      collateralRequiredRaw,
      estimatedFee,
      acceptablePrice,
      triggerPrice,
      triggerAbove,
      expiry,
      calls,
    };
  }

  async prepareCloseOrder(params: {
    account: Address;
    marketId: Hex;
    percentage?: number;
    maxSlippage?: number;
    orderType?: OnchainPerpOrderType;
    limitPrice?: number;
    expiry?: number;
  }): Promise<PreparedOnchainPerpCloseOrder> {
    const market = await this.getMarket(params.marketId);
    const position = await this.getPosition(params.account, params.marketId);
    if (!position) {
      throw new Error(
        `No open ${market.symbol} position for ${params.account}`
      );
    }

    const engineConfig = await this.getEngineConfig();
    const latestVersion = await this.getLatestOracleVersion(
      market.id,
      market.latestVersion
    );
    const orderType = params.orderType ?? 'market';
    const percentage = params.percentage ?? 1;
    const closeFractionBps = Math.round(percentage * 10_000);
    if (closeFractionBps <= 0 || closeFractionBps > 10_000) {
      throw new Error('Close percentage must be between 0 and 1');
    }

    const sizeDelta =
      (position.size * BigInt(closeFractionBps)) / BigInt(10_000);
    if (sizeDelta === 0n) {
      throw new Error('Close size rounds to zero at current precision');
    }

    const slippageBps =
      params.maxSlippage !== undefined
        ? BigInt(Math.round(params.maxSlippage * 10_000))
        : DEFAULT_MAX_SLIPPAGE_BPS;
    const referencePrice =
      orderType === 'limit' && params.limitPrice !== undefined
        ? toPriceUnits(params.limitPrice)
        : latestVersion.price;
    const triggerPrice =
      orderType === 'limit' && params.limitPrice !== undefined
        ? toPriceUnits(params.limitPrice)
        : 0n;

    if (orderType === 'limit') {
      if (params.limitPrice === undefined || params.limitPrice <= 0) {
        throw new Error('Limit close orders require a positive limit price');
      }

      if (
        (position.side === 'long' && triggerPrice < latestVersion.price) ||
        (position.side === 'short' && triggerPrice > latestVersion.price)
      ) {
        throw new Error(
          'Reduce-only limit orders must improve the current exit price'
        );
      }
    }

    const estimatedExecutionPrice = (await this.publicClient.readContract({
      address: this.diamondAddress,
      abi: PERP_VIEW_INTERFACE,
      functionName: 'previewPerpExecutionPrice',
      args: [
        market.id,
        referencePrice,
        sideToEnum(position.side),
        true,
        sizeDelta,
      ],
    })) as bigint;
    const preview = calculateReducePreview({
      position,
      market,
      sizeDelta,
      fillPrice: estimatedExecutionPrice,
      cumulativeFunding: latestVersion.cumulativeFunding,
    });
    const acceptablePrice =
      orderType === 'limit'
        ? triggerPrice
        : calculateAcceptablePrice({
            previewPrice: estimatedExecutionPrice,
            side: position.side,
            reduceOnly: true,
            maxSlippageBps: slippageBps,
          });
    const expiry =
      params.expiry ??
      Math.floor(Date.now() / 1000) + DEFAULT_ORDER_EXPIRY_SECONDS;
    const triggerAbove =
      orderType === 'limit' ? position.side === 'long' : false;
    const orderId = computePerpOrderId({
      account: params.account,
      nonce: engineConfig.nextOrderNonce,
      chainId: BigInt(CHAIN.id),
      diamondAddress: this.diamondAddress,
    });

    const calls: OnchainPerpTxCall[] = [
      {
        to: this.diamondAddress,
        data:
          orderType === 'limit'
            ? encodeFunctionData({
                abi: PERP_ORDER_INTERFACE,
                functionName: 'placePerpTriggerOrder',
                args: [
                  market.id,
                  sideToEnum(position.side),
                  true,
                  sizeDelta,
                  0n,
                  triggerPrice,
                  acceptablePrice,
                  triggerAbove,
                  BigInt(expiry),
                ],
              })
            : encodeFunctionData({
                abi: PERP_ORDER_INTERFACE,
                functionName: 'placePerpMarketOrder',
                args: [
                  market.id,
                  sideToEnum(position.side),
                  true,
                  sizeDelta,
                  0n,
                  acceptablePrice,
                  BigInt(expiry),
                ],
              }),
        description:
          orderType === 'limit'
            ? 'place-perp-reduce-limit-order'
            : 'place-perp-reduce-market-order',
      },
    ];

    return {
      settlementMode: 'onchain',
      marketId: market.id,
      symbol: market.symbol,
      positionId: buildOnchainPerpPositionId(market.id),
      orderId,
      side: position.side,
      orderType,
      closeFractionBps,
      sizeDelta,
      sizeUsd: fromUsdUnits(
        calculateNotionalFromBaseSize(sizeDelta, estimatedExecutionPrice)
      ),
      indexPrice: latestVersion.price,
      estimatedExecutionPrice,
      estimatedPnl: preview.realizedPnl,
      estimatedFee: preview.fee,
      estimatedSettlement: preview.settlement,
      estimatedMarginReturned: preview.collateralReturned,
      acceptablePrice,
      triggerPrice,
      triggerAbove,
      expiry,
      calls,
    };
  }

  async publishOraclePrices(params: {
    marketIds: Hex[];
    prices: bigint[];
    timestamp?: number;
  }): Promise<OnchainPerpTxCall> {
    if (params.marketIds.length === 0) {
      throw new Error('At least one oracle price update is required');
    }

    if (params.marketIds.length !== params.prices.length) {
      throw new Error('Market IDs and oracle prices must be the same length');
    }

    const timestamp = params.timestamp ?? Math.floor(Date.now() / 1000);

    return {
      to: this.diamondAddress,
      data: encodeFunctionData({
        abi: PERP_SETTLEMENT_INTERFACE,
        functionName: 'publishPerpOracleVersions',
        args: [params.marketIds, params.prices, BigInt(timestamp)],
      }),
      description: 'publish-perp-oracle-versions',
    };
  }

  async buildExecuteOrderCall(orderId: Hex): Promise<OnchainPerpTxCall> {
    return {
      to: this.diamondAddress,
      data: encodeFunctionData({
        abi: PERP_SETTLEMENT_INTERFACE,
        functionName: 'executePerpOrder',
        args: [orderId],
      }),
      description: 'execute-perp-order',
    };
  }

  async buildLiquidationCall(
    account: Address,
    marketId: Hex
  ): Promise<OnchainPerpTxCall> {
    return {
      to: this.diamondAddress,
      data: encodeFunctionData({
        abi: PERP_SETTLEMENT_INTERFACE,
        functionName: 'liquidatePerpPosition',
        args: [account, marketId],
      }),
      description: 'liquidate-perp-position',
    };
  }

  async buildCreateMarketCall(params: {
    symbol: string;
    maxOpenInterestUsd: number;
    maxSkewBase: number;
    skewScaleBase: number;
    minTradeSizeBase: number;
    initialMarginBps: number;
    maintenanceMarginBps: number;
    liquidationFeeBps: number;
    openFeeBps: number;
    closeFeeBps: number;
    maxFundingVelocityBps: number;
    maxPriceImpactBps: number;
    minLiquidityBps: number;
  }): Promise<OnchainPerpTxCall> {
    return {
      to: this.diamondAddress,
      data: encodeFunctionData({
        abi: PERP_ADMIN_INTERFACE,
        functionName: 'createPerpMarket',
        args: [
          params.symbol,
          toUsdUnits(params.maxOpenInterestUsd),
          toUsdUnits(params.maxSkewBase),
          toUsdUnits(params.skewScaleBase),
          toUsdUnits(params.minTradeSizeBase),
          params.initialMarginBps,
          params.maintenanceMarginBps,
          params.liquidationFeeBps,
          params.openFeeBps,
          params.closeFeeBps,
          params.maxFundingVelocityBps,
          params.maxPriceImpactBps,
          params.minLiquidityBps,
        ],
      }),
      description: 'create-perp-market',
    };
  }
}

export function logOnchainPerpMode(context: string): void {
  logger.info(
    'Using on-chain perpetuals settlement mode',
    { chainId: CHAIN.id, rpcUrl: getCurrentRpcUrl() },
    context
  );
}

export async function sendOnchainPerpCalls(params: {
  calls: OnchainPerpTxCall[];
  privateKey?: Hex;
  rpcUrl?: string;
  confirmations?: number;
}): Promise<Hex[]> {
  if (params.calls.length === 0) {
    return [];
  }

  const privateKey =
    params.privateKey ??
    (process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined) ??
    (CHAIN.id === 31337 ? (LOCAL_DEV_PRIVATE_KEY as Hex) : undefined);

  if (!privateKey) {
    throw new Error(
      'DEPLOYER_PRIVATE_KEY is required for on-chain perp writes'
    );
  }

  const service = new OnchainPerpService({ rpcUrl: params.rpcUrl });
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: CHAIN,
    transport: http(service.rpcUrl),
  });
  const txHashes: Hex[] = [];
  const confirmations =
    params.confirmations ?? getTransactionReceiptConfirmations(CHAIN.id);

  for (const call of params.calls) {
    const hash = await walletClient.sendTransaction({
      account,
      to: call.to,
      data: call.data,
      chain: CHAIN,
    });

    await service.publicClient.waitForTransactionReceipt({
      hash,
      confirmations,
    });
    txHashes.push(hash);
  }

  return txHashes;
}
