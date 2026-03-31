/**
 * On-chain Babylon prediction market service backed by BabylonPredictionAMMRouter.
 *
 * Moved from packages/api to packages/engine to follow the dependency direction
 * rule: domain logic belongs in packages/, not apps/ or api/.
 */

import {
  BABYLON_PREDICTION_AMM_ROUTER_ABI,
  getContractAddresses,
  getRpcUrl,
  PREDICTION_CLAIMED_EVENT,
  PREDICTION_SHARES_BOUGHT_EVENT,
  PREDICTION_SHARES_SWAPPED_EVENT,
} from '@babylon/contracts';
import {
  CHAIN,
  ERC20_MINIMAL_ABI,
  getTransactionReceiptConfirmations,
  logger,
} from '@babylon/shared';
import {
  type Abi,
  type Address,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  type Hex,
  http,
  keccak256,
  maxUint256,
  parseAbi,
  recoverTransactionAddress,
  toBytes,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const ERC20_ALLOWANCE_ABI = parseAbi([
  ...ERC20_MINIMAL_ABI,
  'function allowance(address owner,address spender) view returns (uint256)',
]);

const LVR_MARKET_READ_ABI = parseAbi([
  'function previewBuy(bool isBuyYes,uint256 amountIn) view returns (uint256)',
  'function previewSwitch(bool isSellYes,uint256 amountIn) view returns (uint256)',
  'function getToken(bool tokenYes) view returns (address)',
  'function getMarketDetails() view returns (uint8 currentState,uint256 marketDeadline,uint256 marketOutcome,uint256 marketLiquidity,uint256 reserveYes,uint256 reserveNo,uint256 priceYes,uint256 priceNo)',
]);

export type OnchainPredictionOutcome = 'YES' | 'NO';

export type OnchainPredictionMarketSnapshot = {
  marketKey: Hex;
  marketAddress: Address;
  state: number;
  deadline: bigint;
  outcome: number;
  liquidity: bigint;
  reserveYes: bigint;
  reserveNo: bigint;
  priceYesWad: bigint;
  priceNoWad: bigint;
};

function normalizeMarketKey(marketIdOrKey: string): Hex {
  if (/^0x[a-fA-F0-9]{64}$/.test(marketIdOrKey)) {
    return marketIdOrKey as Hex;
  }

  return keccak256(toBytes(marketIdOrKey));
}

function requirePredictionRouterAddress(): {
  routerAddress: Address;
  collateralToken: Address;
} {
  const { predictionAmmRouter, mockUsdc } = getContractAddresses();
  const collateralToken = (process.env.PREDICTION_COLLATERAL_TOKEN ??
    process.env.PERP_COLLATERAL_TOKEN ??
    mockUsdc) as Address | undefined;

  if (!predictionAmmRouter) {
    throw new Error('Prediction AMM router is not configured for this network');
  }
  if (!collateralToken) {
    throw new Error(
      'Prediction collateral token is not configured for this network'
    );
  }

  return {
    routerAddress: predictionAmmRouter,
    collateralToken,
  };
}

export class OnChainPredictionMarketService {
  private publicClient;
  private rpcUrl: string;
  private routerAddress: Address;
  private collateralToken: Address;
  private collateralDecimalsPromise: Promise<number> | null = null;

  constructor(rpcUrl?: string) {
    this.rpcUrl = rpcUrl || getRpcUrl();
    this.publicClient = createPublicClient({
      chain: CHAIN,
      transport: http(this.rpcUrl),
    });

    const { routerAddress, collateralToken } = requirePredictionRouterAddress();
    this.routerAddress = routerAddress;
    this.collateralToken = collateralToken;
  }

  getRouterAddress(): Address {
    return this.routerAddress;
  }

  getCollateralTokenAddress(): Address {
    return this.collateralToken;
  }

  private async writeContractWithPreparedGas(params: {
    walletClient: WalletClient;
    address: Address;
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
  }): Promise<Hex> {
    const account = params.walletClient.account;
    if (!account) {
      throw new Error('Wallet client must have an account');
    }

    const chain = params.walletClient.chain ?? CHAIN;
    const feeEstimate = await this.publicClient.estimateFeesPerGas();
    const nonce = await this.publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'pending',
    });
    const data = encodeFunctionData({
      abi: params.abi,
      functionName: params.functionName as never,
      args: params.args as never,
    });
    const gas = await this.publicClient.estimateGas({
      account: account.address,
      to: params.address,
      data,
    });
    const serializedTransaction = await params.walletClient.signTransaction({
      account,
      chain,
      chainId: chain.id,
      to: params.address,
      data,
      gas,
      nonce,
      ...(typeof feeEstimate.gasPrice === 'bigint'
        ? { gasPrice: feeEstimate.gasPrice, type: 'legacy' as const }
        : {
            maxFeePerGas: feeEstimate.maxFeePerGas,
            maxPriorityFeePerGas: feeEstimate.maxPriorityFeePerGas,
            type: 'eip1559' as const,
          }),
    });
    const recoveredAddress = await recoverTransactionAddress({
      serializedTransaction,
    });
    logger.info('Prepared prediction tx', {
      functionName: params.functionName,
      signer: account.address,
      recoveredAddress,
      nonce,
      gas: gas.toString(),
      to: params.address,
    });

    return await this.publicClient.sendRawTransaction({
      serializedTransaction,
    });
  }

  private async getMarketAddressForKey(marketKey: Hex): Promise<Address> {
    return (await this.publicClient.readContract({
      address: this.routerAddress,
      abi: BABYLON_PREDICTION_AMM_ROUTER_ABI,
      functionName: 'getMarketAddress',
      args: [marketKey],
    })) as Address;
  }

  async getCollateralDecimals(): Promise<number> {
    if (!this.collateralDecimalsPromise) {
      this.collateralDecimalsPromise = this.publicClient
        .readContract({
          address: this.collateralToken,
          abi: ERC20_ALLOWANCE_ABI,
          functionName: 'decimals',
        })
        .then((value) => value as number);
    }

    return this.collateralDecimalsPromise;
  }

  async buyShares(
    marketIdOrKey: string,
    outcome: OnchainPredictionOutcome,
    collateralIn: bigint,
    userWalletClient: WalletClient,
    minSharesOut = 0n
  ): Promise<{ txHash: string; sharesBought: bigint; collateralIn: bigint }> {
    const account = userWalletClient.account;
    if (!account) {
      throw new Error('Wallet client must have an account');
    }

    const marketKey = normalizeMarketKey(marketIdOrKey);
    const outcomeIndex = outcome === 'YES' ? 1 : 0;

    const allowance = (await this.publicClient.readContract({
      address: this.collateralToken,
      abi: ERC20_ALLOWANCE_ABI,
      functionName: 'allowance',
      args: [account.address, this.routerAddress],
    })) as bigint;

    if (allowance < collateralIn) {
      const approveHash = await this.writeContractWithPreparedGas({
        walletClient: userWalletClient,
        address: this.collateralToken,
        abi: ERC20_ALLOWANCE_ABI,
        functionName: 'approve',
        args: [this.routerAddress, maxUint256],
      });

      await this.publicClient.waitForTransactionReceipt({
        hash: approveHash,
        confirmations: getTransactionReceiptConfirmations(CHAIN.id),
      });
    }

    const hash = await this.writeContractWithPreparedGas({
      walletClient: userWalletClient,
      address: this.routerAddress,
      abi: BABYLON_PREDICTION_AMM_ROUTER_ABI,
      functionName: 'buyShares',
      args: [marketKey, outcomeIndex, collateralIn, minSharesOut],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash,
      confirmations: getTransactionReceiptConfirmations(CHAIN.id),
    });

    const boughtLog = receipt.logs.find((log) => {
      if (log.address.toLowerCase() !== this.routerAddress.toLowerCase()) {
        return false;
      }
      try {
        const decoded = decodeEventLog({
          abi: [PREDICTION_SHARES_BOUGHT_EVENT],
          data: log.data,
          topics: log.topics,
        });
        return decoded.eventName === 'PredictionSharesBought';
      } catch {
        return false;
      }
    });

    const sharesBought = boughtLog
      ? (decodeEventLog({
          abi: [PREDICTION_SHARES_BOUGHT_EVENT],
          data: boughtLog.data,
          topics: boughtLog.topics,
        }).args.sharesOut as bigint)
      : 0n;

    logger.info('Prediction AMM shares purchased on-chain', {
      marketKey,
      outcome,
      collateralIn: collateralIn.toString(),
      sharesBought: sharesBought.toString(),
      txHash: receipt.transactionHash,
      gasUsed: receipt.gasUsed.toString(),
    });

    return {
      txHash: receipt.transactionHash,
      sharesBought,
      collateralIn,
    };
  }

  async sellShares(
    marketIdOrKey: string,
    outcome: OnchainPredictionOutcome,
    sharesIn: bigint,
    userWalletClient: WalletClient,
    minSharesOut = 0n
  ): Promise<{ txHash: string; sharesSold: bigint; sharesReceived: bigint }> {
    const account = userWalletClient.account;
    if (!account) {
      throw new Error('Wallet client must have an account');
    }

    const marketKey = normalizeMarketKey(marketIdOrKey);
    const outcomeIndex = outcome === 'YES' ? 1 : 0;

    const hash = await this.writeContractWithPreparedGas({
      walletClient: userWalletClient,
      address: this.routerAddress,
      abi: BABYLON_PREDICTION_AMM_ROUTER_ABI,
      functionName: 'sellShares',
      args: [marketKey, outcomeIndex, sharesIn, minSharesOut],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash,
      confirmations: getTransactionReceiptConfirmations(CHAIN.id),
    });

    const swapLog = receipt.logs.find((log) => {
      if (log.address.toLowerCase() !== this.routerAddress.toLowerCase()) {
        return false;
      }
      try {
        const decoded = decodeEventLog({
          abi: [PREDICTION_SHARES_SWAPPED_EVENT],
          data: log.data,
          topics: log.topics,
        });
        return decoded.eventName === 'PredictionSharesSwapped';
      } catch {
        return false;
      }
    });

    const sharesReceived = swapLog
      ? (decodeEventLog({
          abi: [PREDICTION_SHARES_SWAPPED_EVENT],
          data: swapLog.data,
          topics: swapLog.topics,
        }).args.sharesOut as bigint)
      : 0n;

    logger.info('Prediction AMM shares swapped on-chain', {
      marketKey,
      outcome,
      sharesIn: sharesIn.toString(),
      sharesReceived: sharesReceived.toString(),
      txHash: receipt.transactionHash,
      gasUsed: receipt.gasUsed.toString(),
    });

    return {
      txHash: receipt.transactionHash,
      sharesSold: sharesIn,
      sharesReceived,
    };
  }

  async claimAll(
    marketIdOrKey: string,
    userWalletClient: WalletClient
  ): Promise<{ txHash: string; payout: bigint }> {
    const account = userWalletClient.account;
    if (!account) {
      throw new Error('Wallet client must have an account');
    }

    const marketKey = normalizeMarketKey(marketIdOrKey);
    const hash = await this.writeContractWithPreparedGas({
      walletClient: userWalletClient,
      address: this.routerAddress,
      abi: BABYLON_PREDICTION_AMM_ROUTER_ABI,
      functionName: 'claimAll',
      args: [marketKey],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash,
      confirmations: getTransactionReceiptConfirmations(CHAIN.id),
    });

    const claimLog = receipt.logs.find((log) => {
      if (log.address.toLowerCase() !== this.routerAddress.toLowerCase()) {
        return false;
      }
      try {
        const decoded = decodeEventLog({
          abi: [PREDICTION_CLAIMED_EVENT],
          data: log.data,
          topics: log.topics,
        });
        return decoded.eventName === 'PredictionClaimed';
      } catch {
        return false;
      }
    });

    const payout = claimLog
      ? (decodeEventLog({
          abi: [PREDICTION_CLAIMED_EVENT],
          data: claimLog.data,
          topics: claimLog.topics,
        }).args.payout as bigint)
      : 0n;
    const balance = await this.getPosition(account.address, marketKey);
    logger.info('Prediction AMM claim executed on-chain', {
      marketKey,
      txHash: receipt.transactionHash,
      gasUsed: receipt.gasUsed.toString(),
      payout: payout.toString(),
      remainingYes: balance.yesBalance.toString(),
      remainingNo: balance.noBalance.toString(),
    });

    return {
      txHash: receipt.transactionHash,
      payout,
    };
  }

  async getMarket(
    marketIdOrKey: string
  ): Promise<OnchainPredictionMarketSnapshot> {
    const marketKey = normalizeMarketKey(marketIdOrKey);
    const marketAddress = await this.getMarketAddressForKey(marketKey);
    const [
      state,
      deadline,
      outcome,
      liquidity,
      reserveYes,
      reserveNo,
      priceYesWad,
      priceNoWad,
    ] = await this.publicClient.readContract({
      address: marketAddress,
      abi: LVR_MARKET_READ_ABI,
      functionName: 'getMarketDetails',
    });

    return {
      marketKey,
      marketAddress,
      state: Number(state),
      deadline,
      outcome: Number(outcome),
      liquidity,
      reserveYes,
      reserveNo,
      priceYesWad,
      priceNoWad,
    };
  }

  async getPosition(
    userAddress: Address,
    marketIdOrKey: string
  ): Promise<{
    yesBalance: bigint;
    noBalance: bigint;
  }> {
    const marketKey = normalizeMarketKey(marketIdOrKey);
    const marketAddress = await this.getMarketAddressForKey(marketKey);
    const [yesToken, noToken] = await Promise.all([
      this.publicClient.readContract({
        address: marketAddress,
        abi: LVR_MARKET_READ_ABI,
        functionName: 'getToken',
        args: [true],
      }) as Promise<Address>,
      this.publicClient.readContract({
        address: marketAddress,
        abi: LVR_MARKET_READ_ABI,
        functionName: 'getToken',
        args: [false],
      }) as Promise<Address>,
    ]);
    const [yesBalance, noBalance] = await Promise.all([
      this.publicClient.readContract({
        address: yesToken,
        abi: ERC20_ALLOWANCE_ABI,
        functionName: 'balanceOf',
        args: [userAddress],
      }) as Promise<bigint>,
      this.publicClient.readContract({
        address: noToken,
        abi: ERC20_ALLOWANCE_ABI,
        functionName: 'balanceOf',
        args: [userAddress],
      }) as Promise<bigint>,
    ]);
    return { yesBalance, noBalance };
  }

  async previewBuy(
    marketIdOrKey: string,
    outcome: OnchainPredictionOutcome,
    collateralIn: bigint
  ): Promise<bigint> {
    const marketKey = normalizeMarketKey(marketIdOrKey);
    const marketAddress = await this.getMarketAddressForKey(marketKey);
    return (await this.publicClient.readContract({
      address: marketAddress,
      abi: LVR_MARKET_READ_ABI,
      functionName: 'previewBuy',
      args: [outcome === 'YES', collateralIn],
    })) as bigint;
  }

  async previewSell(
    marketIdOrKey: string,
    outcome: OnchainPredictionOutcome,
    sharesIn: bigint
  ): Promise<bigint> {
    const marketKey = normalizeMarketKey(marketIdOrKey);
    const marketAddress = await this.getMarketAddressForKey(marketKey);
    return (await this.publicClient.readContract({
      address: marketAddress,
      abi: LVR_MARKET_READ_ABI,
      functionName: 'previewSwitch',
      args: [outcome === 'YES', sharesIn],
    })) as bigint;
  }

  async getSettlementState(marketIdOrKey: string): Promise<{
    outcome: number;
    cancelled: boolean;
  }> {
    const market = await this.getMarket(marketIdOrKey);
    const cancelled = market.outcome === 2;

    logger.debug('Prediction AMM settlement state read', {
      marketKey: market.marketKey,
      outcome: market.outcome,
      cancelled,
    });

    return {
      outcome: market.outcome,
      cancelled,
    };
  }

  static createBackendWalletClient(
    privateKey: string,
    rpcUrl?: string
  ): WalletClient {
    const account = privateKeyToAccount(privateKey as `0x${string}`);

    return createWalletClient({
      account,
      chain: CHAIN,
      transport: http(rpcUrl || getRpcUrl()),
    });
  }
}

let instance: OnChainPredictionMarketService | null = null;

export function getOnChainPredictionMarketService(): OnChainPredictionMarketService {
  if (!instance) {
    instance = new OnChainPredictionMarketService();
  }
  return instance;
}

export function getPredictionMarketKey(marketIdOrKey: string): Hex {
  return normalizeMarketKey(marketIdOrKey);
}
