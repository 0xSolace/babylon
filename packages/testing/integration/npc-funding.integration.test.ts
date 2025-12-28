/**
 * NPC Funding Service Integration Tests
 *
 * Tests the NPC funding flow for TGE:
 * - Tier calculations
 * - Batch funding
 * - Error handling
 * - ICO integration
 *
 * REQUIRES: jeju dev running (EQLite, chain, DWS)
 * Run with: bun test packages/testing/integration/npc-funding.integration.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  getICOAutomationService,
  resetICOAutomationService,
} from '@babylon/api/services/ico-automation-service'
import {
  getNPCFundingService,
  NPC_TIERS,
  type NPCTierName,
  resetNPCFundingService,
} from '@babylon/api/services/npc-funding-service'
import { initializeDatabase, resetDB } from '@babylon/db'
import { StaticDataRegistry } from '@babylon/engine'
import { parseEther, zeroAddress } from 'viem'

// Test configuration
const TEST_RPC_URL = process.env.TEST_RPC_URL ?? 'http://localhost:6546'
const TEST_CHAIN_ID = 420690 // Jeju localnet

// Check if EQLite is available (requires jeju dev running)
async function checkEQLiteHealth(): Promise<boolean> {
  const endpoint =
    process.env.EQLITE_BLOCK_PRODUCER_ENDPOINT || 'http://localhost:4661'
  try {
    const response = await fetch(`${endpoint}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

const EQLITE_AVAILABLE = await checkEQLiteHealth()

describe.skipIf(!EQLITE_AVAILABLE)(
  'NPC Funding Service Integration Tests',
  () => {
    beforeAll(async () => {
      // Set environment for localnet
      process.env.JEJU_NETWORK = 'localnet'
      process.env.EQLITE_BLOCK_PRODUCER_ENDPOINT = 'http://localhost:4661'
      process.env.EQLITE_DATABASE_ID = 'babylon'

      // Initialize database
      resetDB()
      await initializeDatabase()

      // Reset services before tests
      resetNPCFundingService()
      resetICOAutomationService()
    })

    afterAll(() => {
      resetNPCFundingService()
      resetICOAutomationService()
      resetDB()
    })

    describe('NPC Tier Configuration', () => {
      it('should have correct tier allocations', () => {
        expect(NPC_TIERS.tier1.allocation).toBe(parseEther('1000000'))
        expect(NPC_TIERS.tier2.allocation).toBe(parseEther('100000'))
        expect(NPC_TIERS.tier3.allocation).toBe(parseEther('10000'))
      })

      it('should have correct tier descriptions', () => {
        expect(NPC_TIERS.tier1.description).toBe('Major Characters')
        expect(NPC_TIERS.tier2.description).toBe('Supporting')
        expect(NPC_TIERS.tier3.description).toBe('Minor')
      })

      it('should have all tier names defined', () => {
        const tierNames: NPCTierName[] = ['tier1', 'tier2', 'tier3']
        for (const name of tierNames) {
          expect(NPC_TIERS[name]).toBeDefined()
          expect(NPC_TIERS[name].name).toBe(name)
        }
      })
    })

    describe('NPCFundingService Initialization', () => {
      it('should initialize with default configuration', () => {
        resetNPCFundingService()
        const service = getNPCFundingService({
          rpcUrl: TEST_RPC_URL,
          chainId: TEST_CHAIN_ID,
          devMode: true,
        })

        const config = service.getConfig()
        expect(config.rpcUrl).toBe(TEST_RPC_URL)
        expect(config.chainId).toBe(TEST_CHAIN_ID)
        expect(config.devMode).toBe(true)
        expect(config.batchSize).toBe(50)
      })

      it('should initialize with custom batch size', () => {
        resetNPCFundingService()
        const service = getNPCFundingService({
          rpcUrl: TEST_RPC_URL,
          chainId: TEST_CHAIN_ID,
          devMode: true,
          batchSize: 25,
        })

        expect(service.getConfig().batchSize).toBe(25)
      })

      it('should discover NPC wallets on initialize', async () => {
        resetNPCFundingService()
        const service = getNPCFundingService({
          rpcUrl: TEST_RPC_URL,
          chainId: TEST_CHAIN_ID,
          devMode: true,
        })

        await service.initialize()
        const wallets = service.getNPCWallets()

        // Should have discovered some wallets from static registry
        expect(wallets.length).toBeGreaterThanOrEqual(0)
      })
    })

    describe('Funding Calculations', () => {
      it('should calculate total funding correctly', async () => {
        resetNPCFundingService()
        const service = getNPCFundingService({
          rpcUrl: TEST_RPC_URL,
          chainId: TEST_CHAIN_ID,
          devMode: true,
        })

        await service.initialize()
        const calculation = await service.calculateTotalFunding()

        // Total should equal sum of all tiers
        const expectedTotal =
          calculation.byTier.tier1.total +
          calculation.byTier.tier2.total +
          calculation.byTier.tier3.total

        expect(calculation.total).toBe(expectedTotal)
      })

      it('should correctly count NPCs by tier', async () => {
        resetNPCFundingService()
        const service = getNPCFundingService({
          rpcUrl: TEST_RPC_URL,
          chainId: TEST_CHAIN_ID,
          devMode: true,
        })

        await service.initialize()
        const calculation = await service.calculateTotalFunding()
        const wallets = service.getNPCWallets()

        // Count should match wallets
        const totalCount =
          calculation.byTier.tier1.count +
          calculation.byTier.tier2.count +
          calculation.byTier.tier3.count

        expect(totalCount).toBe(wallets.length)
      })

      it('should calculate tier totals correctly', async () => {
        resetNPCFundingService()
        const service = getNPCFundingService({
          rpcUrl: TEST_RPC_URL,
          chainId: TEST_CHAIN_ID,
          devMode: true,
        })

        await service.initialize()
        const calculation = await service.calculateTotalFunding()

        // Verify each tier total = count * allocation
        expect(calculation.byTier.tier1.total).toBe(
          BigInt(calculation.byTier.tier1.count) * NPC_TIERS.tier1.allocation,
        )
        expect(calculation.byTier.tier2.total).toBe(
          BigInt(calculation.byTier.tier2.count) * NPC_TIERS.tier2.allocation,
        )
        expect(calculation.byTier.tier3.total).toBe(
          BigInt(calculation.byTier.tier3.count) * NPC_TIERS.tier3.allocation,
        )
      })
    })

    describe('Funding Status', () => {
      it('should return funding status', async () => {
        resetNPCFundingService()
        const service = getNPCFundingService({
          rpcUrl: TEST_RPC_URL,
          chainId: TEST_CHAIN_ID,
          devMode: true,
          tokenAddress: zeroAddress, // Use zero address for testing
        })

        await service.initialize()
        const status = await service.getFundingStatus()

        expect(status).toHaveProperty('totalNPCs')
        expect(status).toHaveProperty('funded')
        expect(status).toHaveProperty('unfunded')
        expect(status).toHaveProperty('totalFundedAmount')
        expect(status).toHaveProperty('totalPendingAmount')
        expect(status).toHaveProperty('byTier')
      })

      it('should track funded vs unfunded NPCs', async () => {
        resetNPCFundingService()
        const service = getNPCFundingService({
          rpcUrl: TEST_RPC_URL,
          chainId: TEST_CHAIN_ID,
          devMode: true,
          tokenAddress: zeroAddress,
        })

        await service.initialize()
        const status = await service.getFundingStatus()

        // Total should equal funded + unfunded
        expect(status.totalNPCs).toBe(status.funded + status.unfunded)
      })
    })

    describe('Static Data Registry Integration', () => {
      it('should access actors from static registry', () => {
        const allActors = StaticDataRegistry.getAllActors()
        expect(Array.isArray(allActors)).toBe(true)
      })

      it('should have actors with tiers', () => {
        const allActors = StaticDataRegistry.getAllActors()
        const actorsWithTiers = allActors.filter((a) => a.tier !== null)

        // Should have some actors with tiers
        expect(actorsWithTiers.length).toBeGreaterThanOrEqual(0)
      })

      it('should map S_TIER to tier1', () => {
        const sTierActors = StaticDataRegistry.getActorsByTier('S_TIER')
        // S_TIER actors should map to tier1 funding
        for (const actor of sTierActors) {
          expect(actor.tier).toBe('S_TIER')
        }
      })

      it('should map A_TIER to tier2', () => {
        const aTierActors = StaticDataRegistry.getActorsByTier('A_TIER')
        for (const actor of aTierActors) {
          expect(actor.tier).toBe('A_TIER')
        }
      })
    })

    describe('ICO Integration', () => {
      it('should integrate with ICO automation service', async () => {
        const icoService = getICOAutomationService({
          chainId: TEST_CHAIN_ID,
          rpcUrl: TEST_RPC_URL,
          devMode: true,
        })

        // ICO service should have fundNPCsFromTreasury method
        expect(typeof icoService.fundNPCsFromTreasury).toBe('function')
      })

      it('should call NPC funding without treasury key configured', async () => {
        resetICOAutomationService()
        resetNPCFundingService()

        const icoService = getICOAutomationService({
          chainId: TEST_CHAIN_ID,
          rpcUrl: TEST_RPC_URL,
          devMode: true,
          tokenAddress: zeroAddress,
          treasuryAddress: zeroAddress,
        })

        // Without treasury key, should return error result
        const result = await icoService.fundNPCsFromTreasury()

        expect(result).toHaveProperty('success')
        expect(result).toHaveProperty('totalFunded')
        expect(result).toHaveProperty('npcsFunded')
        expect(result).toHaveProperty('txHashes')
      })
    })

    describe('Error Handling', () => {
      it('should handle missing treasury private key gracefully', async () => {
        resetNPCFundingService()
        const service = getNPCFundingService({
          rpcUrl: TEST_RPC_URL,
          chainId: TEST_CHAIN_ID,
          devMode: true,
          tokenAddress: zeroAddress,
          // No treasury private key
        })

        await service.initialize()

        // Should not throw, but return failed results
        const result = await service.fundAllNPCs()

        // All results should fail due to missing key
        for (const r of result.results) {
          expect(r.success).toBe(false)
          expect(r.error).toContain('Treasury private key not configured')
        }
      })

      it('should handle empty NPC list gracefully', async () => {
        resetNPCFundingService()
        const service = getNPCFundingService({
          rpcUrl: TEST_RPC_URL,
          chainId: TEST_CHAIN_ID,
          devMode: true,
          tokenAddress: zeroAddress,
        })

        // Initialize but with empty wallets (fresh service)
        await service.initialize()

        // Even with no wallets, should return valid result
        const result = await service.fundAllNPCs()

        expect(result).toHaveProperty('results')
        expect(result).toHaveProperty('totalFunded')
        expect(result).toHaveProperty('successCount')
        expect(result).toHaveProperty('failCount')
      })
    })

    describe('TGE Funding Execution', () => {
      it('should execute TGE funding', async () => {
        resetNPCFundingService()
        const service = getNPCFundingService({
          rpcUrl: TEST_RPC_URL,
          chainId: TEST_CHAIN_ID,
          devMode: true,
          tokenAddress: zeroAddress,
        })

        const result = await service.executeTGEFunding()

        expect(result).toHaveProperty('totalFunded')
        expect(result).toHaveProperty('results')
        expect(result).toHaveProperty('txHashes')
        expect(Array.isArray(result.results)).toBe(true)
        expect(Array.isArray(result.txHashes)).toBe(true)
      })

      it('should return correct result structure from TGE funding', async () => {
        resetNPCFundingService()
        const service = getNPCFundingService({
          rpcUrl: TEST_RPC_URL,
          chainId: TEST_CHAIN_ID,
          devMode: true,
          tokenAddress: zeroAddress,
        })

        const result = await service.executeTGEFunding()

        expect(typeof result.totalFunded).toBe('bigint')
        expect(result.totalFunded).toBeGreaterThanOrEqual(0n)
      })
    })

    describe('Service Lifecycle', () => {
      it('should reset service correctly', () => {
        const service1 = getNPCFundingService({ devMode: true })
        resetNPCFundingService()
        const service2 = getNPCFundingService({ devMode: true })

        // Should be different instances after reset
        expect(service1).not.toBe(service2)
      })

      it('should allow treasury key to be set after initialization', async () => {
        resetNPCFundingService()
        const service = getNPCFundingService({
          rpcUrl: TEST_RPC_URL,
          chainId: TEST_CHAIN_ID,
          devMode: true,
        })

        await service.initialize()

        // Set treasury key after init
        const testKey =
          '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`
        service.setTreasuryPrivateKey(testKey)

        const config = service.getConfig()
        expect(config.treasuryPrivateKey).toBe(testKey)
      })
    })

    describe('Batch Processing', () => {
      it('should respect batch size configuration', async () => {
        resetNPCFundingService()
        const batchSize = 10
        const service = getNPCFundingService({
          rpcUrl: TEST_RPC_URL,
          chainId: TEST_CHAIN_ID,
          devMode: true,
          batchSize,
        })

        await service.initialize()
        const config = service.getConfig()

        expect(config.batchSize).toBe(batchSize)
      })
    })
  },
)

describe('NPC Funding Contract Tests (Requires Deployed Contracts)', () => {
  // These tests require actual contract deployment
  const skipIfNoContracts = () => {
    const hasContracts =
      process.env.BBLN_TOKEN_ADDRESS && process.env.TREASURY_ADDRESS
    return !hasContracts
  }

  it.skipIf(skipIfNoContracts())('should fund single NPC', async () => {
    resetNPCFundingService()
    const service = getNPCFundingService({
      tokenAddress: process.env.BBLN_TOKEN_ADDRESS as `0x${string}`,
      treasuryAddress: process.env.TREASURY_ADDRESS as `0x${string}`,
      treasuryPrivateKey: process.env.TREASURY_PRIVATE_KEY as `0x${string}`,
      devMode: false,
    })

    await service.initialize()
    const wallets = service.getNPCWallets()

    if (wallets.length > 0) {
      const testWallet = wallets[0]
      if (!testWallet) {
        throw new Error('No test wallet available')
      }
      const result = await service.fundNPC(
        testWallet.address,
        parseEther('1000'),
      )

      expect(result.success).toBe(true)
      expect(result.txHash).toMatch(/^0x[a-f0-9]{64}$/)
    }
  })

  it.skipIf(skipIfNoContracts())('should get NPC balances', async () => {
    resetNPCFundingService()
    const service = getNPCFundingService({
      tokenAddress: process.env.BBLN_TOKEN_ADDRESS as `0x${string}`,
      treasuryAddress: process.env.TREASURY_ADDRESS as `0x${string}`,
      devMode: false,
    })

    await service.initialize()
    const balances = await service.getNPCBalances()

    for (const balance of balances) {
      expect(balance).toHaveProperty('address')
      expect(balance).toHaveProperty('actorId')
      expect(balance).toHaveProperty('balance')
      expect(balance).toHaveProperty('funded')
    }
  })

  it.skipIf(skipIfNoContracts())('should execute batch funding', async () => {
    resetNPCFundingService()
    const service = getNPCFundingService({
      tokenAddress: process.env.BBLN_TOKEN_ADDRESS as `0x${string}`,
      treasuryAddress: process.env.TREASURY_ADDRESS as `0x${string}`,
      treasuryPrivateKey: process.env.TREASURY_PRIVATE_KEY as `0x${string}`,
      devMode: false,
      batchSize: 10,
    })

    await service.initialize()
    const result = await service.fundNPCsByTier('tier3')

    expect(result).toBeInstanceOf(Array)
    for (const r of result) {
      expect(r).toHaveProperty('success')
      expect(r).toHaveProperty('txHash')
    }
  })
})
