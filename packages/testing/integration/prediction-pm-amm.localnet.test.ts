import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test';
import { OnChainPredictionMarketService } from '@babylon/api';
import { loadDeploymentFromDisk } from '@babylon/contracts/deployment/validation-node';
import { db } from '@babylon/db';
import {
  ensureMarketOnChain,
  publishOracleCommitments,
  publishOracleReveals,
  settlePredictionMarketOnChain,
} from '@babylon/engine';
import { ERC20_MINIMAL_ABI, generateSnowflakeId } from '@babylon/shared';
import type { NextRequest } from 'next/server';
import { NextRequest as RealNextRequest } from 'next/server';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  parseAbi,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  configureLocalChainEnvironment,
  ensureContractsReady,
  getLocalRpcUrl,
} from '../helpers/contract-setup';

const DEPLOYER_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TRADER_PRIVATE_KEY =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const MOCK_USDC_ABI = parseAbi([
  ...ERC20_MINIMAL_ABI,
  'function mint(address to,uint256 amount)',
]);
const ORACLE_ADAPTER_ABI = parseAbi([
  'function sessionIdByMarketKey(bytes32 marketKey) view returns (bytes32)',
]);
const COLLATERAL_FUNDING_AMOUNT = 25_000_000_000n;
const TRADE_COLLATERAL_IN = 1_000_000_000n;

setDefaultTimeout(300_000);

const localnetDescribe =
  process.env.BABYLON_RUN_LOCALNET_TESTS === '1' ? describe : describe.skip;

function buildAuthedRequest(
  url: string,
  userId: string,
  body: unknown
): NextRequest {
  return new RealNextRequest(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer dev-user:${userId}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function parseSuccessJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(
      `Expected ${response.url} to succeed, received ${response.status}: ${await response.text()}`
    );
  }

  return (await response.json()) as T;
}

localnetDescribe('Prediction PM-AMM localnet lifecycle', () => {
  let deployment: NonNullable<
    Awaited<ReturnType<typeof loadDeploymentFromDisk>>
  >;
  let publicClient: ReturnType<typeof createPublicClient>;
  let deployerWallet: ReturnType<typeof createWalletClient>;
  let predictionService: OnChainPredictionMarketService;

  beforeAll(async () => {
    configureLocalChainEnvironment();
    expect(await ensureContractsReady()).toBe(true);

    const loadedDeployment = await loadDeploymentFromDisk('localnet');
    if (!loadedDeployment) {
      throw new Error('Localnet deployment metadata is missing');
    }

    deployment = loadedDeployment;
    publicClient = createPublicClient({
      chain: {
        id: 31337,
        name: 'Anvil',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [getLocalRpcUrl()] } },
      },
      transport: http(getLocalRpcUrl()),
    });

    deployerWallet = createWalletClient({
      account: privateKeyToAccount(DEPLOYER_PRIVATE_KEY as Hex),
      chain: publicClient.chain,
      transport: http(getLocalRpcUrl()),
    });

    predictionService = new OnChainPredictionMarketService(getLocalRpcUrl());
  });

  test.serial(
    'creates, links, buys, switches, settles, claims, and syncs PM-AMM state through onchain verification routes',
    async () => {
      const { POST: verifyBuyRoute } = await import(
        '../../../apps/web/src/app/api/markets/predictions/[id]/buy-onchain/route'
      );
      const { POST: verifySellRoute } = await import(
        '../../../apps/web/src/app/api/markets/predictions/[id]/sell-onchain/route'
      );
      const { POST: verifyClaimRoute } = await import(
        '../../../apps/web/src/app/api/markets/predictions/[id]/claim-onchain/route'
      );

      const now = Date.now();
      const marketId = `integration-pm-amm-${now}`;
      const questionNumber = 900000 + (now % 100000);
      const resolutionDate = new Date(Date.now() + 60 * 60 * 1000);
      const traderAccount = privateKeyToAccount(TRADER_PRIVATE_KEY as Hex);
      const traderWallet = createWalletClient({
        account: traderAccount,
        chain: publicClient.chain,
        transport: http(getLocalRpcUrl()),
      });
      const normalizedWalletAddress = traderAccount.address.toLowerCase();
      const existingTraderUser = await db.user.findUnique({
        where: { walletAddress: normalizedWalletAddress },
        select: { id: true },
      });
      const testUserId =
        existingTraderUser?.id ?? (await generateSnowflakeId());

      await db.user.upsert({
        where: { walletAddress: normalizedWalletAddress },
        update: {
          updatedAt: new Date(),
        },
        create: {
          id: testUserId,
          username: `pm-amm-user-${now}`,
          displayName: 'PM AMM Trader',
          walletAddress: normalizedWalletAddress,
          privyId: `did:privy:test-${testUserId}`,
          updatedAt: new Date(),
        },
      });

      await db.question.create({
        data: {
          id: marketId,
          questionNumber,
          text: 'Integration test: Will the Babylon PM-AMM path settle correctly?',
          scenarioId: 1,
          outcome: true,
          rank: 1,
          status: 'active',
          resolutionDate,
          createdDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await db.market.create({
        data: {
          id: marketId,
          question:
            'Integration test: Will the Babylon PM-AMM path settle correctly?',
          yesShares: '5000',
          noShares: '5000',
          liquidity: '10000',
          resolved: false,
          endDate: resolutionDate,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      expect(await ensureMarketOnChain(marketId)).toBe(true);

      const createdMarket = await db.market.findUnique({
        where: { id: marketId },
      });
      expect(createdMarket?.onChainMarketId).toBeDefined();
      if (!createdMarket?.onChainMarketId) {
        throw new Error('onChainMarketId was not stored after market creation');
      }

      const commitResult = await publishOracleCommitments([
        {
          id: marketId,
          questionNumber,
          text: createdMarket.question,
          outcome: true,
        },
      ]);
      expect(commitResult.committed).toBe(1);

      const committedQuestion = await db.question.findUnique({
        where: { id: marketId },
      });
      expect(committedQuestion?.oracleSessionId).toBeDefined();
      if (!committedQuestion?.oracleSessionId) {
        throw new Error('oracleSessionId missing after commitment');
      }

      const linkedSessionId = (await publicClient.readContract({
        address: deployment.contracts.predictionOracleAdapter as Address,
        abi: ORACLE_ADAPTER_ABI,
        functionName: 'sessionIdByMarketKey',
        args: [createdMarket.onChainMarketId as Hex],
      })) as Hex;
      expect(linkedSessionId.toLowerCase()).toBe(
        committedQuestion.oracleSessionId.toLowerCase()
      );

      const traderLatestBalance = await publicClient.getBalance({
        address: traderAccount.address,
        blockTag: 'latest',
      });
      const traderPendingBalance = await publicClient.getBalance({
        address: traderAccount.address,
        blockTag: 'pending',
      });
      expect(traderLatestBalance).toBeGreaterThanOrEqual(parseEther('1000'));
      expect(traderPendingBalance).toBeGreaterThanOrEqual(parseEther('1000'));

      const mintHash = await deployerWallet.writeContract({
        address: deployment.contracts.mockUsdc as Address,
        abi: MOCK_USDC_ABI,
        functionName: 'mint',
        args: [traderAccount.address, COLLATERAL_FUNDING_AMOUNT],
        account: deployerWallet.account!,
        chain: publicClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash: mintHash });

      const decimals = await predictionService.getCollateralDecimals();

      const buyResult = await predictionService.buyShares(
        createdMarket.onChainMarketId,
        'YES',
        TRADE_COLLATERAL_IN,
        traderWallet
      );
      expect(buyResult.sharesBought).toBeGreaterThan(0n);

      const buyVerification = await parseSuccessJson<{
        success: boolean;
        verified: boolean;
        position: { side: string; shares: number };
        userPosition: { yesShares: number; noShares: number };
      }>(
        (await verifyBuyRoute(
          buildAuthedRequest(
            `http://localhost/api/markets/predictions/${marketId}/buy-onchain`,
            testUserId,
            {
              side: 'yes',
              collateralAmount: Number(TRADE_COLLATERAL_IN) / 10 ** decimals,
              txHash: buyResult.txHash,
              walletAddress: traderAccount.address,
            }
          ),
          { params: Promise.resolve({ id: marketId }) }
        )) as Response
      );
      expect(buyVerification.success).toBe(true);
      expect(buyVerification.verified).toBe(true);
      expect(buyVerification.position.side).toBe('YES');
      expect(buyVerification.position.shares).toBeGreaterThan(0);
      expect(buyVerification.userPosition.yesShares).toBeGreaterThan(0);
      expect(buyVerification.userPosition.noShares).toBe(0);

      const openPosition = await predictionService.getPosition(
        traderAccount.address,
        createdMarket.onChainMarketId
      );
      expect(openPosition.yesBalance).toBeGreaterThan(0n);
      expect(openPosition.noBalance).toBe(0n);

      const sharesToSwitch = openPosition.yesBalance / 2n;
      const switchResult = await predictionService.sellShares(
        createdMarket.onChainMarketId,
        'YES',
        sharesToSwitch,
        traderWallet
      );
      expect(switchResult.sharesReceived).toBeGreaterThan(0n);

      const switchVerification = await parseSuccessJson<{
        success: boolean;
        verified: boolean;
        trade: {
          side: string;
          receivedSide: string;
          sharesIn: number;
          sharesOut: number;
        };
        userPosition: { yesShares: number; noShares: number };
      }>(
        (await verifySellRoute(
          buildAuthedRequest(
            `http://localhost/api/markets/predictions/${marketId}/sell-onchain`,
            testUserId,
            {
              side: 'yes',
              shares: Number(sharesToSwitch) / 10 ** decimals,
              txHash: switchResult.txHash,
              walletAddress: traderAccount.address,
            }
          ),
          { params: Promise.resolve({ id: marketId }) }
        )) as Response
      );
      expect(switchVerification.success).toBe(true);
      expect(switchVerification.verified).toBe(true);
      expect(switchVerification.trade.side).toBe('YES');
      expect(switchVerification.trade.receivedSide).toBe('NO');
      expect(switchVerification.trade.sharesIn).toBeGreaterThan(0);
      expect(switchVerification.trade.sharesOut).toBeGreaterThan(0);
      expect(switchVerification.userPosition.yesShares).toBeGreaterThan(0);
      expect(switchVerification.userPosition.noShares).toBeGreaterThan(0);

      const syncedPositions = await db.position.findMany({
        where: {
          userId: testUserId,
          marketId,
        },
      });
      expect(syncedPositions.length).toBeGreaterThanOrEqual(2);

      const revealResult = await publishOracleReveals([
        { id: marketId, outcome: true },
      ]);
      expect(revealResult.revealed).toBe(1);

      const settleTx = await settlePredictionMarketOnChain(
        createdMarket.onChainMarketId
      );
      expect(settleTx).not.toBeNull();

      const marketSnapshot = await predictionService.getMarket(
        createdMarket.onChainMarketId
      );
      expect(marketSnapshot.outcome).toBe(0);

      const balanceBeforeClaim = (await publicClient.readContract({
        address: deployment.contracts.mockUsdc as Address,
        abi: MOCK_USDC_ABI,
        functionName: 'balanceOf',
        args: [traderAccount.address],
      })) as bigint;

      const claimResult = await predictionService.claimAll(
        createdMarket.onChainMarketId,
        traderWallet
      );
      expect(claimResult.txHash.startsWith('0x')).toBe(true);
      expect(claimResult.payout).toBeGreaterThan(0n);

      const claimVerification = await parseSuccessJson<{
        success: boolean;
        verified: boolean;
        claim: { payout: number };
        userPosition: { yesShares: number; noShares: number };
      }>(
        (await verifyClaimRoute(
          buildAuthedRequest(
            `http://localhost/api/markets/predictions/${marketId}/claim-onchain`,
            testUserId,
            {
              txHash: claimResult.txHash,
              walletAddress: traderAccount.address,
            }
          ),
          { params: Promise.resolve({ id: marketId }) }
        )) as Response
      );
      expect(claimVerification.success).toBe(true);
      expect(claimVerification.verified).toBe(true);
      expect(claimVerification.claim.payout).toBeGreaterThan(0);
      expect(claimVerification.userPosition.yesShares).toBe(0);
      expect(claimVerification.userPosition.noShares).toBe(0);

      const balanceAfterClaim = (await publicClient.readContract({
        address: deployment.contracts.mockUsdc as Address,
        abi: MOCK_USDC_ABI,
        functionName: 'balanceOf',
        args: [traderAccount.address],
      })) as bigint;
      expect(balanceAfterClaim).toBeGreaterThan(balanceBeforeClaim);

      const closedPosition = await predictionService.getPosition(
        traderAccount.address,
        createdMarket.onChainMarketId
      );
      expect(closedPosition.yesBalance).toBe(0n);
      expect(closedPosition.noBalance).toBe(0n);

      const remainingPositions = await db.position.findMany({
        where: {
          userId: testUserId,
          marketId,
        },
      });
      expect(remainingPositions).toHaveLength(0);
    }
  );
});
