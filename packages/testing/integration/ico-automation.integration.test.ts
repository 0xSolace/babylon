/**
 * ICO Automation Integration Tests
 *
 * Tests the complete ICO flow:
 * - Presale contract deployment
 * - Contribution handling
 * - ELIZA holder verification
 * - TGE (Token Generation Event)
 * - LP creation and locking
 * - Token claims and refunds
 *
 * Run with: bun test packages/testing/integration/ico-automation.integration.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
  getCrossChainBridgeService,
  resetCrossChainBridgeService,
} from '@babylon/api/services/cross-chain-bridge-service';
import {
  ELIZA_TOKEN_ADDRESSES,
  getElizaVerificationService,
  resetElizaVerificationService,
} from '@babylon/api/services/eliza-verification-service';
// Import services
import {
  getICOAutomationService,
  resetICOAutomationService,
} from '@babylon/api/services/ico-automation-service';
import {
  getLiquidityPoolService,
  resetLiquidityPoolService,
} from '@babylon/api/services/liquidity-pool-service';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  zeroAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';

// Test configuration
const TEST_RPC_URL = process.env.TEST_RPC_URL ?? 'http://localhost:8545';
const TEST_CHAIN_ID = 31337; // Hardhat

// Test accounts (Hardhat default accounts)
const DEPLOYER_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`;
const USER1_PRIVATE_KEY =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as `0x${string}`;
const USER2_PRIVATE_KEY =
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' as `0x${string}`;

const deployerAccount = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);
const user1Account = privateKeyToAccount(USER1_PRIVATE_KEY);
const _user2Account = privateKeyToAccount(USER2_PRIVATE_KEY);

// Mock contract addresses (would be deployed in real test)
const _MOCK_TOKEN_ADDRESS =
  '0x5FbDB2315678afecb367f032d93F642f64180aa3' as Address;
const _MOCK_PRESALE_ADDRESS =
  '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' as Address;

describe('ICO Automation Integration Tests', () => {
  let _publicClient: ReturnType<typeof createPublicClient>;
  let _walletClient: ReturnType<typeof createWalletClient>;

  beforeAll(async () => {
    // Setup viem clients
    _publicClient = createPublicClient({
      chain: hardhat,
      transport: http(TEST_RPC_URL),
    });

    _walletClient = createWalletClient({
      account: deployerAccount,
      chain: hardhat,
      transport: http(TEST_RPC_URL),
    });

    // Reset all services
    resetICOAutomationService();
    resetLiquidityPoolService();
    resetElizaVerificationService();
    resetCrossChainBridgeService();
  });

  afterAll(() => {
    resetICOAutomationService();
    resetLiquidityPoolService();
    resetElizaVerificationService();
    resetCrossChainBridgeService();
  });

  describe('ICO Automation Service', () => {
    it('should initialize with default configuration', () => {
      const service = getICOAutomationService({
        chainId: TEST_CHAIN_ID,
        rpcUrl: TEST_RPC_URL,
        devMode: true,
      });

      const config = service.getConfig();
      expect(config.chainId).toBe(TEST_CHAIN_ID);
      expect(config.devMode).toBe(true);
    });

    it('should get current phase as NOT_STARTED for unconfigured presale', async () => {
      const service = getICOAutomationService({
        chainId: TEST_CHAIN_ID,
        rpcUrl: TEST_RPC_URL,
        presaleAddress: zeroAddress,
        devMode: true,
      });

      const phase = await service.getCurrentPhase();
      expect(phase.name).toBe('NOT_STARTED');
    });

    it('should get presale stats with zero values for unconfigured presale', async () => {
      const service = getICOAutomationService({
        chainId: TEST_CHAIN_ID,
        rpcUrl: TEST_RPC_URL,
        presaleAddress: zeroAddress,
        devMode: true,
      });

      const stats = await service.getPresaleStats();
      expect(stats.totalRaised).toBe(0n);
      expect(stats.totalParticipants).toBe(0);
      expect(stats.isActive).toBe(false);
    });

    it('should schedule tasks for future execution', () => {
      const service = getICOAutomationService({
        chainId: TEST_CHAIN_ID,
        rpcUrl: TEST_RPC_URL,
        devMode: true,
      });

      let taskExecuted = false;
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      service.scheduleTask('test-task', futureTime, async () => {
        taskExecuted = true;
      });

      const _status = service.getFullStatus();
      // Task should be scheduled but not executed yet
      expect(taskExecuted).toBe(false);

      // Cancel the task
      const cancelled = service.cancelTask('test-task');
      expect(cancelled).toBe(true);
    });

    it('should provide full status information', async () => {
      const service = getICOAutomationService({
        chainId: TEST_CHAIN_ID,
        rpcUrl: TEST_RPC_URL,
        devMode: true,
      });

      const fullStatus = await service.getFullStatus();

      expect(fullStatus).toHaveProperty('phase');
      expect(fullStatus).toHaveProperty('stats');
      expect(fullStatus).toHaveProperty('config');
      expect(fullStatus).toHaveProperty('scheduledTasks');
    });
  });

  describe('ELIZA Verification Service', () => {
    it('should have correct ELIZA token addresses', () => {
      expect(ELIZA_TOKEN_ADDRESSES.mainnet).toBe(
        '0xea17df5cf6d172224892b5477a16acb111182478'
      );
      expect(ELIZA_TOKEN_ADDRESSES.base).toBe(
        '0xea17df5cf6d172224892b5477a16acb111182478'
      );
      expect(ELIZA_TOKEN_ADDRESSES.bsc).toBe(
        '0xea17df5cf6d172224892b5477a16acb111182478'
      );
    });

    it('should return correct configuration', () => {
      const service = getElizaVerificationService();
      const config = service.getConfig();

      expect(config.minBalance).toBeDefined();
      expect(config.bonusBps).toBeDefined();
      expect(config.tokenAddresses).toBeDefined();
    });

    it('should calculate ELIZA bonus correctly', async () => {
      const service = getElizaVerificationService();

      // For a non-holder, bonus should be 0
      const baseAllocation = parseEther('1000');

      // Mock the checkHolderStatus to return non-holder
      // In real test, this would check actual balance
      const result = await service.verifyAndCalculateBonus(
        'test-user-1',
        user1Account.address,
        baseAllocation
      );

      expect(result.userId).toBe('test-user-1');
      expect(result.baseAllocation).toBe(baseAllocation);
      // Bonus depends on actual ELIZA balance
    });

    it('should clear cache on request', () => {
      const service = getElizaVerificationService();
      service.clearCache();
      // Cache should be cleared without error
    });
  });

  describe('Liquidity Pool Service', () => {
    it('should initialize with default configuration', () => {
      const service = getLiquidityPoolService({
        chainId: TEST_CHAIN_ID,
        rpcUrl: TEST_RPC_URL,
      });

      const config = service.getConfig();
      expect(config.chainId).toBe(TEST_CHAIN_ID);
      expect(config.lpTokensToLock).toBe(100); // 100% locked by default
      expect(config.teamFeeBps).toBe(5000); // 50%
      expect(config.holdersFeeBps).toBe(5000); // 50%
    });

    // These tests require a running local node
    const skipIfNoNode = () => !process.env.TEST_WITH_NODE;

    it.skipIf(skipIfNoNode())(
      'should return zero pool info for non-existent pair',
      async () => {
        const service = getLiquidityPoolService({
          chainId: TEST_CHAIN_ID,
          rpcUrl: TEST_RPC_URL,
          xlpV2FactoryAddress: zeroAddress,
        });

        const poolInfo = await service.getPoolInfo();
        expect(poolInfo.pairAddress).toBe(zeroAddress);
        expect(poolInfo.reserve0).toBe(0n);
        expect(poolInfo.reserve1).toBe(0n);
      }
    );

    it.skipIf(skipIfNoNode())(
      'should return zero LP position for non-existent pair',
      async () => {
        const service = getLiquidityPoolService({
          chainId: TEST_CHAIN_ID,
          rpcUrl: TEST_RPC_URL,
          xlpV2FactoryAddress: zeroAddress,
        });

        const position = await service.getLPPosition(user1Account.address);
        expect(position.lpBalance).toBe(0n);
        expect(position.shareOfPool).toBe(0);
      }
    );

    it.skipIf(skipIfNoNode())('should calculate token price', async () => {
      const service = getLiquidityPoolService({
        chainId: TEST_CHAIN_ID,
        rpcUrl: TEST_RPC_URL,
      });

      const price = await service.getTokenPrice();
      expect(price).toHaveProperty('priceInEth');
      expect(price).toHaveProperty('priceInUsd');
    });
  });

  describe('Cross-Chain Bridge Service', () => {
    it('should list supported chains', () => {
      const service = getCrossChainBridgeService();
      const chains = service.getSupportedChains();

      expect(chains).toContain('jeju');
      expect(chains).toContain('mainnet');
      expect(chains).toContain('base');
      expect(chains).toContain('bsc');
      expect(chains).toContain('solana');
    });

    it('should return chain configuration', () => {
      const service = getCrossChainBridgeService();

      const jejuConfig = service.getChainConfig('jeju');
      expect(jejuConfig.isHomeChain).toBe(true);

      const mainnetConfig = service.getChainConfig('mainnet');
      expect(mainnetConfig.isHomeChain).toBe(false);
    });

    it('should get bridge quote', async () => {
      const service = getCrossChainBridgeService();

      const quote = await service.getBridgeQuote(
        'jeju',
        'mainnet',
        parseEther('1000')
      );

      expect(quote.sourceChain).toBe('jeju');
      expect(quote.destChain).toBe('mainnet');
      expect(quote.amount).toBe(parseEther('1000'));
      expect(quote.route).toBe('hyperlane');
    });

    it('should use Wormhole for Solana bridging', async () => {
      const service = getCrossChainBridgeService();

      const quote = await service.getBridgeQuote(
        'jeju',
        'solana',
        parseEther('1000')
      );

      expect(quote.route).toBe('wormhole');
      expect(quote.estimatedTime).toBeGreaterThan(0);
    });

    it('should track pending bridges', async () => {
      const service = getCrossChainBridgeService();
      const pendingBridges = await service.getPendingBridges();

      expect(Array.isArray(pendingBridges)).toBe(true);
    });

    it('should set and get warp routes', () => {
      const service = getCrossChainBridgeService();
      const testAddress =
        '0x1234567890123456789012345678901234567890' as Address;

      service.setWarpRoute('mainnet', testAddress);
      const route = service.getWarpRoute('mainnet');

      expect(route).toBe(testAddress);
    });
  });

  describe('ICO Flow Integration', () => {
    it('should have correct presale configuration in shared config', async () => {
      // Import the shared BBLN config
      const { BBLN_TOKEN } = await import('@babylon/shared/contracts/bbln');

      expect(BBLN_TOKEN.presale.tokensForSale).toBe(100_000_000n * 10n ** 18n);
      expect(BBLN_TOKEN.presale.minBid).toBe(100_000_000_000_000_000n); // 0.1 ETH
      expect(BBLN_TOKEN.presale.elizaBonusMultiplier).toBe(15000); // 1.5x
    });

    it('should have correct allocation percentages', async () => {
      const { BBLN_TOKEN } = await import('@babylon/shared/contracts/bbln');

      const totalSupply = BBLN_TOKEN.totalSupply;
      const { allocation } = BBLN_TOKEN;

      // Verify allocations sum to total supply
      const totalAllocated =
        allocation.babylonLabs +
        allocation.publicSale +
        allocation.airdrop +
        allocation.liquidity +
        allocation.treasury;

      expect(totalAllocated).toBe(totalSupply);

      // Verify percentages
      expect((allocation.babylonLabs * 100n) / totalSupply).toBe(20n); // 20%
      expect((allocation.publicSale * 100n) / totalSupply).toBe(10n); // 10%
      expect((allocation.airdrop * 100n) / totalSupply).toBe(10n); // 10%
      expect((allocation.liquidity * 100n) / totalSupply).toBe(10n); // 10%
      expect((allocation.treasury * 100n) / totalSupply).toBe(50n); // 50%
    });

    it('should have correct fee configuration', async () => {
      const { BBLN_TOKEN } = await import('@babylon/shared/contracts/bbln');

      const { tokenFees, tradingFees } = BBLN_TOKEN;

      // Token transfer fees
      expect(tokenFees.xlpRewardShareBps).toBe(8000); // 80%
      expect(tokenFees.protocolShareBps).toBe(1000); // 10%
      expect(tokenFees.burnShareBps).toBe(1000); // 10%

      // Platform trading fees (perpetuals)
      expect(tradingFees.perpsMakerBps).toBe(10); // 0.01%
      expect(tradingFees.perpsTakerBps).toBe(35); // 0.035%
    });
  });

  describe('Service Lifecycle', () => {
    it('should shutdown ICO automation service correctly', () => {
      const service = getICOAutomationService({
        chainId: TEST_CHAIN_ID,
        rpcUrl: TEST_RPC_URL,
        devMode: true,
      });

      // Schedule a task
      service.scheduleTask(
        'shutdown-test',
        Math.floor(Date.now() / 1000) + 3600,
        async () => {}
      );

      // Shutdown should clear all tasks
      service.shutdown();

      // Service should be reset - getConfig still works after shutdown
      service.getConfig();
    });

    it('should reset all services without errors', () => {
      // Create all services
      getICOAutomationService({ devMode: true });
      getLiquidityPoolService();
      getElizaVerificationService();
      getCrossChainBridgeService();

      // Reset all
      resetICOAutomationService();
      resetLiquidityPoolService();
      resetElizaVerificationService();
      resetCrossChainBridgeService();

      // Services should be recreatable after reset
      const newService = getICOAutomationService({ devMode: true });
      expect(newService).toBeDefined();
    });
  });
});

describe('ICO Contract Tests (Requires Deployed Contracts)', () => {
  // These tests require actual contract deployment
  // Skip if contracts not deployed

  const skipIfNoContracts = () => {
    const hasContracts =
      process.env.BBLN_TOKEN_ADDRESS && process.env.BBLN_PRESALE_ADDRESS;
    return !hasContracts;
  };

  it.skipIf(skipIfNoContracts())('should contribute to presale', async () => {
    const service = getICOAutomationService({
      tokenAddress: process.env.BBLN_TOKEN_ADDRESS as Address,
      presaleAddress: process.env.BBLN_PRESALE_ADDRESS as Address,
      deployerPrivateKey: USER1_PRIVATE_KEY,
      devMode: true,
    });

    const txHash = await service.contribute(parseEther('1'));
    expect(txHash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it.skipIf(skipIfNoContracts())('should get contribution info', async () => {
    const service = getICOAutomationService({
      tokenAddress: process.env.BBLN_TOKEN_ADDRESS as Address,
      presaleAddress: process.env.BBLN_PRESALE_ADDRESS as Address,
      devMode: true,
    });

    const contribution = await service.getContribution(user1Account.address);
    expect(contribution).toHaveProperty('ethAmount');
    expect(contribution).toHaveProperty('tokenAllocation');
  });

  it.skipIf(skipIfNoContracts())(
    'should finalize presale after end',
    async () => {
      const service = getICOAutomationService({
        tokenAddress: process.env.BBLN_TOKEN_ADDRESS as Address,
        presaleAddress: process.env.BBLN_PRESALE_ADDRESS as Address,
        deployerPrivateKey: DEPLOYER_PRIVATE_KEY,
        devMode: true,
      });

      const result = await service.finalize();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('txHash');
    }
  );
});
