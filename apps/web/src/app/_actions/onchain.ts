'use server';

import {
  getAuthedUserContextFromPrivyTokenBundle,
  getDevCredentials,
  getOnChainPredictionMarketService,
  sendSponsoredEvmTransaction,
} from '@babylon/api';
import {
  BABYLON_PREDICTION_AMM_ROUTER_ABI,
  getContractAddresses,
  getRpcUrl,
} from '@babylon/contracts';
import { db } from '@babylon/db';
import {
  CAPABILITIES_HASH,
  CHAIN,
  ERC20_MINIMAL_ABI,
  getIdentityRegistryAddress,
  identityRegistryAbi,
  WALLET_ERROR_MESSAGES,
} from '@babylon/shared';
import {
  type Address,
  createPublicClient,
  encodeFunctionData,
  type Hex,
  http,
  isAddress,
  keccak256,
  parseAbi,
  parseUnits,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { AgentProfileMetadata } from '@/hooks/useUpdateAgentProfileTx';
import { wrapServerActionWithSentry } from '@/lib/sentry/server-actions';

import { requirePrivyTokenBundle } from './utils';

const ERC20_ALLOWANCE_ABI = parseAbi([
  ...ERC20_MINIMAL_ABI,
  'function allowance(address owner,address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

function normalizePredictionMarketKey(marketIdOrKey: string): `0x${string}` {
  if (/^0x[a-fA-F0-9]{64}$/.test(marketIdOrKey)) {
    return marketIdOrKey as `0x${string}`;
  }

  return keccak256(new TextEncoder().encode(marketIdOrKey));
}

const { predictionAmmRouter: PREDICTION_AMM_ROUTER, mockUsdc: MOCK_USDC } =
  getContractAddresses();

function requirePredictionTradeContracts(): {
  routerAddress: Address;
  collateralToken: Address;
} {
  const collateralToken = (process.env.PREDICTION_COLLATERAL_TOKEN ??
    process.env.PERP_COLLATERAL_TOKEN ??
    MOCK_USDC) as Address | undefined;

  if (!PREDICTION_AMM_ROUTER) {
    throw new Error('Prediction AMM router not configured for this network');
  }
  if (!collateralToken) {
    throw new Error(
      'Prediction collateral token not configured for this network'
    );
  }

  return {
    routerAddress: PREDICTION_AMM_ROUTER,
    collateralToken,
  };
}

async function resolveLocalDevPredictionWallet(
  userJwt: string | undefined
): Promise<WalletClient | null> {
  const userId =
    typeof userJwt === 'string' && userJwt.startsWith('dev-user:')
      ? userJwt.slice('dev-user:'.length).trim()
      : '';
  const devCredentials = getDevCredentials();

  if (!userId || !devCredentials || CHAIN.id !== 31337) {
    return null;
  }

  const dbUser = await db.user.findUnique({
    where: { id: userId },
    select: { walletAddress: true },
  });
  const walletAddress =
    dbUser?.walletAddress?.toLowerCase() ??
    devCredentials.walletAddress.toLowerCase();

  if (walletAddress !== devCredentials.walletAddress.toLowerCase()) {
    return null;
  }

  const account = privateKeyToAccount(devCredentials.privateKey as Hex);
  return createWalletClient({
    account,
    chain: CHAIN,
    transport: http(getRpcUrl()),
  });
}

async function buySharesOnchainActionImpl(input: {
  marketKey: string;
  outcome: 'YES' | 'NO';
  collateralAmount: number;
  userJwt?: string;
}): Promise<{ txHash: Hex }> {
  const localDevWalletClient = await resolveLocalDevPredictionWallet(
    input.userJwt
  );
  const { routerAddress, collateralToken } = requirePredictionTradeContracts();
  const publicClient = createPublicClient({
    transport: http(getRpcUrl()),
  });
  const marketKey = normalizePredictionMarketKey(input.marketKey);
  const outcomeIndex = input.outcome === 'YES' ? 1 : 0;
  const decimals = (await publicClient.readContract({
    address: collateralToken,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: 'decimals',
  })) as number;
  const collateralAmount = parseUnits(
    input.collateralAmount.toString(),
    decimals
  );

  if (localDevWalletClient) {
    const service = getOnChainPredictionMarketService();
    const result = await service.buyShares(
      marketKey,
      input.outcome,
      collateralAmount,
      localDevWalletClient
    );

    return { txHash: result.txHash as Hex };
  }

  const bundle = await requirePrivyTokenBundle(input.userJwt);
  const ctx = await getAuthedUserContextFromPrivyTokenBundle(bundle);

  if (!ctx.walletAddress) {
    throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET);
  }

  const allowance = (await publicClient.readContract({
    address: collateralToken,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: 'allowance',
    args: [ctx.walletAddress as Address, routerAddress],
  })) as bigint;

  if (allowance < collateralAmount) {
    const approvalData = encodeFunctionData({
      abi: ERC20_ALLOWANCE_ABI,
      functionName: 'approve',
      args: [routerAddress, 2n ** 256n - 1n],
    });

    const { hash: approvalHash } = await sendSponsoredEvmTransaction({
      walletId: ctx.privyWalletId,
      to: collateralToken,
      data: approvalData,
      valueWei: 0n,
      caip2: `eip155:${CHAIN.id}`,
      chainId: CHAIN.id,
    });

    await publicClient.waitForTransactionReceipt({
      hash: approvalHash,
      confirmations: 1,
    });
  }

  const data = encodeFunctionData({
    abi: BABYLON_PREDICTION_AMM_ROUTER_ABI,
    functionName: 'buyShares',
    args: [marketKey, outcomeIndex, collateralAmount, 0n],
  });

  const { hash } = await sendSponsoredEvmTransaction({
    walletId: ctx.privyWalletId,
    to: routerAddress,
    data,
    valueWei: 0n,
    caip2: `eip155:${CHAIN.id}`,
    chainId: CHAIN.id,
  });

  return { txHash: hash };
}

export const buySharesOnchainAction = wrapServerActionWithSentry(
  'buySharesOnchainAction',
  buySharesOnchainActionImpl
);

async function sellSharesOnchainActionImpl(input: {
  marketKey: string;
  outcome: 'YES' | 'NO';
  shares: number;
  userJwt?: string;
}): Promise<{ txHash: Hex }> {
  const localDevWalletClient = await resolveLocalDevPredictionWallet(
    input.userJwt
  );
  const { routerAddress, collateralToken } = requirePredictionTradeContracts();

  const marketKey = normalizePredictionMarketKey(input.marketKey);
  const outcomeIndex = input.outcome === 'YES' ? 1 : 0;
  const publicClient = createPublicClient({
    transport: http(getRpcUrl()),
  });
  const decimals = (await publicClient.readContract({
    address: collateralToken,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: 'decimals',
  })) as number;
  const sharesBigInt = parseUnits(input.shares.toString(), decimals);

  if (localDevWalletClient) {
    const service = getOnChainPredictionMarketService();
    const result = await service.sellShares(
      marketKey,
      input.outcome,
      sharesBigInt,
      localDevWalletClient
    );

    return { txHash: result.txHash as Hex };
  }

  const bundle = await requirePrivyTokenBundle(input.userJwt);
  const ctx = await getAuthedUserContextFromPrivyTokenBundle(bundle);

  const data = encodeFunctionData({
    abi: BABYLON_PREDICTION_AMM_ROUTER_ABI,
    functionName: 'sellShares',
    args: [marketKey, outcomeIndex, sharesBigInt, 0n],
  });

  const { hash } = await sendSponsoredEvmTransaction({
    walletId: ctx.privyWalletId,
    to: routerAddress,
    data,
    valueWei: 0n,
    caip2: `eip155:${CHAIN.id}`,
    chainId: CHAIN.id,
  });

  return { txHash: hash };
}

export const sellSharesOnchainAction = wrapServerActionWithSentry(
  'sellSharesOnchainAction',
  sellSharesOnchainActionImpl
);

async function sendSponsoredEthTransferActionImpl(input: {
  to: string;
  amountWei: string;
  userJwt?: string;
}): Promise<{ txHash: Hex }> {
  const bundle = await requirePrivyTokenBundle(input.userJwt);
  const ctx = await getAuthedUserContextFromPrivyTokenBundle(bundle);

  if (!isAddress(input.to)) {
    throw new Error('Invalid recipient address');
  }
  const valueWei = BigInt(input.amountWei);

  const { hash } = await sendSponsoredEvmTransaction({
    walletId: ctx.privyWalletId,
    to: input.to.toLowerCase() as Address,
    valueWei,
    caip2: `eip155:${CHAIN.id}`,
    chainId: CHAIN.id,
  });

  return { txHash: hash };
}

export const sendSponsoredEthTransferAction = wrapServerActionWithSentry(
  'sendSponsoredEthTransferAction',
  sendSponsoredEthTransferActionImpl
);

async function updateAgentProfileOnchainActionImpl(input: {
  metadata: AgentProfileMetadata;
  endpoint?: string;
  userJwt?: string;
}): Promise<{ txHash: Hex }> {
  const bundle = await requirePrivyTokenBundle(input.userJwt);
  const ctx = await getAuthedUserContextFromPrivyTokenBundle(bundle);

  const registryAddress = getIdentityRegistryAddress();
  if (!registryAddress) {
    throw new Error('Identity registry not configured for this chain');
  }
  if (!ctx.walletAddress) {
    throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET);
  }

  const endpoint =
    input.endpoint ??
    `https://babylon.market/agent/${ctx.walletAddress.toLowerCase()}`;
  const metadataJson = JSON.stringify({
    ...input.metadata,
    type: input.metadata.type ?? 'user',
    updated: input.metadata.updated ?? new Date().toISOString(),
  });

  const data = encodeFunctionData({
    abi: identityRegistryAbi,
    functionName: 'updateAgent',
    args: [endpoint, CAPABILITIES_HASH, metadataJson],
  });

  const { hash } = await sendSponsoredEvmTransaction({
    walletId: ctx.privyWalletId,
    to: registryAddress,
    data,
    valueWei: 0n,
    caip2: `eip155:${CHAIN.id}`,
    chainId: CHAIN.id,
  });

  return { txHash: hash };
}

export const updateAgentProfileOnchainAction = wrapServerActionWithSentry(
  'updateAgentProfileOnchainAction',
  updateAgentProfileOnchainActionImpl
);
