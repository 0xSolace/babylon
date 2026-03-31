/**
 * Test USDC Faucet
 *
 * Mints test USDC (MockUSDC) to a wallet address for local/testnet development.
 * Only available when CHAIN_ID is a test network (31337 localnet, 84532 Base Sepolia).
 *
 * @route POST /api/admin/faucet
 * @access Admin (or dev auth on localnet)
 */

import {
  BusinessLogicError,
  requireAdmin,
  successResponse,
  withErrorHandling,
} from '@babylon/api';
import { getContractAddresses, getRpcUrl } from '@babylon/contracts';
import { CHAIN, logger } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  type Hex,
  http,
  parseAbi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { z } from 'zod';

const ALLOWED_CHAIN_IDS = [31337, 84532]; // localnet, Base Sepolia
const DEFAULT_MINT_AMOUNT = 10_000n * 1_000_000n; // 10,000 USDC (6 decimals)
const MAX_MINT_AMOUNT = 1_000_000n * 1_000_000n; // 1M USDC cap

const MINT_ABI = parseAbi([
  'function mint(address to, uint256 amount)',
  'function balanceOf(address account) view returns (uint256)',
]);

const FaucetSchema = z.object({
  walletAddress: z.string().startsWith('0x').length(42),
  amount: z.number().positive().optional(),
});

function getDeployerKey(): Hex {
  const key =
    process.env.DEPLOYER_PRIVATE_KEY ??
    process.env.NEXT_PUBLIC_DEPLOYER_PRIVATE_KEY;

  if (!key) {
    // Default Anvil account #0 for local dev
    if (CHAIN.id === 31337) {
      return '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    }
    throw new BusinessLogicError(
      'DEPLOYER_PRIVATE_KEY not configured',
      'DEPLOYER_KEY_MISSING'
    );
  }

  return key as Hex;
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Only allow on test networks
  if (!ALLOWED_CHAIN_IDS.includes(CHAIN.id)) {
    throw new BusinessLogicError(
      `Faucet is only available on test networks (chain ${CHAIN.id} not allowed)`,
      'FAUCET_NOT_AVAILABLE'
    );
  }

  await requireAdmin(request);

  const body = await request.json();
  const { walletAddress, amount: amountUsdc } = FaucetSchema.parse(body);

  const { mockUsdc } = getContractAddresses();
  const collateralToken = (process.env.PREDICTION_COLLATERAL_TOKEN ??
    process.env.PERP_COLLATERAL_TOKEN ??
    mockUsdc) as Address | undefined;

  if (!collateralToken) {
    throw new BusinessLogicError(
      'No collateral token configured for this network',
      'NO_COLLATERAL_TOKEN'
    );
  }

  // Calculate mint amount in raw units (6 decimals)
  const mintAmountRaw = amountUsdc
    ? BigInt(Math.floor(amountUsdc * 1_000_000))
    : DEFAULT_MINT_AMOUNT;

  if (mintAmountRaw > MAX_MINT_AMOUNT) {
    throw new BusinessLogicError(
      `Mint amount exceeds maximum (${Number(MAX_MINT_AMOUNT) / 1_000_000} USDC)`,
      'MINT_AMOUNT_TOO_LARGE'
    );
  }

  const rpcUrl = getRpcUrl();
  const deployerKey = getDeployerKey();
  const account = privateKeyToAccount(deployerKey);
  const publicClient = createPublicClient({
    chain: CHAIN,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: CHAIN,
    transport: http(rpcUrl),
  });

  // Check balance before mint
  const balanceBefore = (await publicClient.readContract({
    address: collateralToken,
    abi: MINT_ABI,
    functionName: 'balanceOf',
    args: [walletAddress as Address],
  })) as bigint;

  // Mint test USDC
  const data = encodeFunctionData({
    abi: MINT_ABI,
    functionName: 'mint',
    args: [walletAddress as Address, mintAmountRaw],
  });

  const gas = await publicClient.estimateGas({
    account: account.address,
    to: collateralToken,
    data,
  });

  const txHash = await walletClient.sendTransaction({
    to: collateralToken,
    data,
    gas,
  });

  await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  // Check balance after mint
  const balanceAfter = (await publicClient.readContract({
    address: collateralToken,
    abi: MINT_ABI,
    functionName: 'balanceOf',
    args: [walletAddress as Address],
  })) as bigint;

  const mintedUsdc = Number(mintAmountRaw) / 1_000_000;

  logger.info('Test USDC minted via faucet', {
    walletAddress,
    amount: mintedUsdc,
    amountRaw: mintAmountRaw.toString(),
    txHash,
    chainId: CHAIN.id,
    balanceBefore: Number(balanceBefore) / 1_000_000,
    balanceAfter: Number(balanceAfter) / 1_000_000,
  });

  return successResponse({
    minted: mintedUsdc,
    walletAddress,
    txHash,
    collateralToken,
    chainId: CHAIN.id,
    balanceBefore: Number(balanceBefore) / 1_000_000,
    balanceAfter: Number(balanceAfter) / 1_000_000,
  });
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  if (!ALLOWED_CHAIN_IDS.includes(CHAIN.id)) {
    throw new BusinessLogicError(
      'Faucet not available on this network',
      'FAUCET_NOT_AVAILABLE'
    );
  }

  await requireAdmin(request);

  const url = new URL(request.url);
  const walletAddress = url.searchParams.get('walletAddress');

  if (!walletAddress) {
    return successResponse({
      chainId: CHAIN.id,
      available: true,
      defaultMintAmount: Number(DEFAULT_MINT_AMOUNT) / 1_000_000,
      maxMintAmount: Number(MAX_MINT_AMOUNT) / 1_000_000,
    });
  }

  const { mockUsdc } = getContractAddresses();
  const collateralToken = (process.env.PREDICTION_COLLATERAL_TOKEN ??
    process.env.PERP_COLLATERAL_TOKEN ??
    mockUsdc) as Address | undefined;

  if (!collateralToken) {
    throw new BusinessLogicError(
      'No collateral token configured',
      'NO_COLLATERAL_TOKEN'
    );
  }

  const publicClient = createPublicClient({
    chain: CHAIN,
    transport: http(getRpcUrl()),
  });

  const balance = (await publicClient.readContract({
    address: collateralToken,
    abi: MINT_ABI,
    functionName: 'balanceOf',
    args: [walletAddress as Address],
  })) as bigint;

  return successResponse({
    walletAddress,
    balance: Number(balance) / 1_000_000,
    balanceRaw: balance.toString(),
    collateralToken,
    chainId: CHAIN.id,
  });
});
