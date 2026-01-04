/**
 * NPC Funding Service
 *
 * Orchestrates automated NPC funding from treasury at TGE (Token Generation Event).
 * Babylon has 12+ NPC archetypes with tiered funding:
 * - Tier 1 (Major Characters): 1,000,000 BBLN each
 * - Tier 2 (Supporting): 100,000 BBLN each
 * - Tier 3 (Minor): 10,000 BBLN each
 *
 * @packageDocumentation
 */

import { db } from '@babylon/db'
import { StaticDataRegistry } from '@babylon/engine'
import {
  type ActorTier,
  createBabylonPublicClient,
  logger,
  writeContract,
} from '@babylon/shared'
import {
  getChainId,
  getContractAddress,
  getRpcUrl,
} from '@babylon/shared/config'
import {
  type Address,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  type Hex,
  http,
  parseEther,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia, hardhat } from 'viem/chains'

type SupportedChain = typeof base | typeof baseSepolia | typeof hardhat

function getChainFromId(chainId: number): SupportedChain {
  switch (chainId) {
    case 8453:
      return base
    case 84532:
      return baseSepolia
    default:
      return hardhat
  }
}

// =============================================================================
// TYPES
// =============================================================================

export type NPCTierName = 'tier1' | 'tier2' | 'tier3'

export interface NPCTier {
  name: NPCTierName
  allocation: bigint // In wei
  description: string
}

export const NPC_TIERS: Record<NPCTierName, NPCTier> = {
  tier1: {
    name: 'tier1',
    allocation: parseEther('1000000'),
    description: 'Major Characters',
  },
  tier2: {
    name: 'tier2',
    allocation: parseEther('100000'),
    description: 'Supporting',
  },
  tier3: {
    name: 'tier3',
    allocation: parseEther('10000'),
    description: 'Minor',
  },
} as const

export interface NPCWallet {
  address: Address
  actorId: string
  archetype: string
  tier: NPCTierName
}

export interface NPCFundingConfig {
  tokenAddress: Address
  treasuryAddress: Address
  vaultAddress: Address
  rpcUrl: string
  chainId: number
  treasuryPrivateKey?: Hex
  batchSize: number
  devMode: boolean
}

export interface FundingResult {
  npc: { address: Address; actorId: string }
  amount: bigint
  txHash: Hex
  success: boolean
  error?: string
}

export interface TierSummary {
  count: number
  total: bigint
}

export interface FundingCalculation {
  total: bigint
  byTier: Record<NPCTierName, TierSummary>
}

export interface BatchFundingResult {
  results: FundingResult[]
  totalFunded: bigint
  successCount: number
  failCount: number
}

export interface NPCBalance {
  address: Address
  actorId: string
  balance: bigint
  funded: boolean
  expectedTier: NPCTierName
  expectedAllocation: bigint
}

export interface TGEFundingResult {
  totalFunded: bigint
  results: FundingResult[]
  txHashes: Hex[]
}

// =============================================================================
// ABI FRAGMENTS
// =============================================================================

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

// Multicall3 ABI for batch transfers
const MULTICALL3_ABI = [
  {
    name: 'aggregate3',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
      },
    ],
  },
] as const

// Multicall3 address (same on most EVM chains)
const MULTICALL3_ADDRESS =
  '0xcA11bde05977b3631167028862bE2a173976CA11' as Address

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Map actor tier from static registry to funding tier
 */
function mapActorTierToFundingTier(
  tier: ActorTier | null | undefined,
): NPCTierName {
  switch (tier) {
    case 'S_TIER':
      return 'tier1'
    case 'A_TIER':
      return 'tier2'
    default:
      return 'tier3'
  }
}

/**
 * Get allocation amount for a tier
 */
function getAllocationForTier(tier: NPCTierName): bigint {
  return NPC_TIERS[tier].allocation
}

// =============================================================================
// NPC FUNDING SERVICE
// =============================================================================

export class NPCFundingService {
  private config: NPCFundingConfig
  private publicClient
  private npcWallets: NPCWallet[] = []
  private initialized = false

  constructor(config: Partial<NPCFundingConfig> = {}) {
    // Get contract addresses from config with fallback
    const getAddressFromConfig = (
      category: string,
      name: string,
      envVar: string,
      defaultValue: Address,
    ): Address => {
      try {
        return getContractAddress(category, name) as Address
      } catch {
        return ((typeof process !== 'undefined'
          ? process.env[envVar]
          : undefined) ?? defaultValue) as Address
      }
    }

    this.config = {
      tokenAddress:
        config.tokenAddress ??
        getAddressFromConfig(
          'tokens',
          'bbln',
          'BBLN_TOKEN_ADDRESS',
          '0x0000000000000000000000000000000000000000' as Address,
        ),
      treasuryAddress:
        config.treasuryAddress ??
        getAddressFromConfig(
          'governance',
          'treasury',
          'TREASURY_ADDRESS',
          '0x0000000000000000000000000000000000000000' as Address,
        ),
      vaultAddress:
        config.vaultAddress ??
        getAddressFromConfig(
          'governance',
          'vault',
          'VAULT_ADDRESS',
          '0x0000000000000000000000000000000000000000' as Address,
        ),
      rpcUrl: config.rpcUrl ?? getRpcUrl() ?? 'http://localhost:9545',
      chainId: config.chainId ?? getChainId() ?? 31337,
      treasuryPrivateKey: config.treasuryPrivateKey,
      batchSize: config.batchSize ?? 50,
      devMode:
        config.devMode ??
        (typeof process !== 'undefined'
          ? process.env.NODE_ENV !== 'production'
          : true),
    }

    this.publicClient = createBabylonPublicClient({
      chain: getChainFromId(this.config.chainId),
      rpcUrl: this.config.rpcUrl,
    })
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  /**
   * Initialize the service by discovering NPC wallets
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    logger.info(
      'Initializing NPC Funding Service',
      {
        tokenAddress: this.config.tokenAddress,
        treasuryAddress: this.config.treasuryAddress,
        devMode: this.config.devMode,
      },
      'NPCFundingService',
    )

    // Discover NPC wallets
    await this.discoverNPCWallets()

    this.initialized = true
    logger.info(
      'NPC Funding Service initialized',
      { npcCount: this.npcWallets.length },
      'NPCFundingService',
    )
  }

  // ===========================================================================
  // NPC WALLET DISCOVERY
  // ===========================================================================

  /**
   * Discover all NPC wallets from database and static registry
   */
  async discoverNPCWallets(): Promise<NPCWallet[]> {
    this.npcWallets = []

    // Get all actors from static registry
    const allActors = StaticDataRegistry.getAllActors()

    // For each actor in static registry, check if they have a wallet
    for (const actor of allActors) {
      // Skip test actors
      if (actor.isTest) continue

      // Get wallet address from database (bootstrapped via KMS or identity service)
      const walletAddress = await this.getOrCreateNPCWallet(actor.id)

      if (walletAddress) {
        const tier = mapActorTierToFundingTier(actor.tier)
        this.npcWallets.push({
          address: walletAddress,
          actorId: actor.id,
          archetype: actor.role ?? 'general',
          tier,
        })
      }
    }

    logger.info(
      'Discovered NPC wallets',
      {
        total: this.npcWallets.length,
        tier1: this.npcWallets.filter((w) => w.tier === 'tier1').length,
        tier2: this.npcWallets.filter((w) => w.tier === 'tier2').length,
        tier3: this.npcWallets.filter((w) => w.tier === 'tier3').length,
      },
      'NPCFundingService',
    )

    return this.npcWallets
  }

  /**
   * Get or create wallet address for an NPC
   * In production, this would interface with KMS
   */
  private async getOrCreateNPCWallet(actorId: string): Promise<Address | null> {
    // Query database for existing wallet using actorState repository
    const actorState = await db.actorState.findFirst({
      where: { id: actorId },
    })

    // Check if actor has a wallet address configured
    if (
      actorState &&
      'walletAddress' in actorState &&
      actorState.walletAddress
    ) {
      return actorState.walletAddress as Address
    }

    // In dev mode, generate a deterministic address from actor ID
    if (this.config.devMode) {
      // Create deterministic address for testing
      const hash = await this.hashString(actorId)
      return `0x${hash.slice(0, 40)}` as Address
    }

    // In production without a wallet, return null (needs KMS setup)
    return null
  }

  private async hashString(input: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(input)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  // ===========================================================================
  // FUNDING CALCULATIONS
  // ===========================================================================

  /**
   * Calculate total funding needed for all NPCs
   */
  async calculateTotalFunding(): Promise<FundingCalculation> {
    await this.ensureInitialized()

    const byTier: Record<NPCTierName, TierSummary> = {
      tier1: { count: 0, total: 0n },
      tier2: { count: 0, total: 0n },
      tier3: { count: 0, total: 0n },
    }

    let total = 0n

    for (const npc of this.npcWallets) {
      const allocation = getAllocationForTier(npc.tier)
      byTier[npc.tier].count++
      byTier[npc.tier].total += allocation
      total += allocation
    }

    return { total, byTier }
  }

  // ===========================================================================
  // FUNDING OPERATIONS
  // ===========================================================================

  /**
   * Fund all NPCs from treasury
   */
  async fundAllNPCs(): Promise<BatchFundingResult> {
    await this.ensureInitialized()

    logger.info(
      'Starting NPC funding',
      { npcCount: this.npcWallets.length },
      'NPCFundingService',
    )

    const results: FundingResult[] = []
    let totalFunded = 0n
    let successCount = 0
    let failCount = 0

    // Process in batches for gas efficiency
    const batches = this.chunkArray(this.npcWallets, this.config.batchSize)

    for (const batch of batches) {
      const batchResults = await this.fundBatch(batch)
      results.push(...batchResults)

      for (const result of batchResults) {
        if (result.success) {
          successCount++
          totalFunded += result.amount
        } else {
          failCount++
        }
      }
    }

    logger.info(
      'NPC funding complete',
      {
        totalFunded: formatEther(totalFunded),
        successCount,
        failCount,
      },
      'NPCFundingService',
    )

    return { results, totalFunded, successCount, failCount }
  }

  /**
   * Fund NPCs by specific tier
   */
  async fundNPCsByTier(tier: NPCTierName): Promise<FundingResult[]> {
    await this.ensureInitialized()

    const tierNPCs = this.npcWallets.filter((npc) => npc.tier === tier)

    logger.info(
      `Funding tier ${tier} NPCs`,
      {
        count: tierNPCs.length,
        allocation: formatEther(NPC_TIERS[tier].allocation),
      },
      'NPCFundingService',
    )

    const results: FundingResult[] = []
    const batches = this.chunkArray(tierNPCs, this.config.batchSize)

    for (const batch of batches) {
      const batchResults = await this.fundBatch(batch)
      results.push(...batchResults)
    }

    return results
  }

  /**
   * Fund a single NPC
   */
  async fundNPC(address: Address, amount: bigint): Promise<FundingResult> {
    const npc = this.npcWallets.find((n) => n.address === address)

    if (!this.config.treasuryPrivateKey) {
      return {
        npc: { address, actorId: npc?.actorId ?? 'unknown' },
        amount,
        txHash: '0x0' as Hex,
        success: false,
        error: 'Treasury private key not configured',
      }
    }

    const account = privateKeyToAccount(this.config.treasuryPrivateKey)
    const chain = getChainFromId(this.config.chainId)
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(this.config.rpcUrl),
    })

    const txHash = await walletClient.writeContract({
      address: this.config.tokenAddress,
      abi: ERC20_ABI,
      functionName: 'transfer' as const,
      args: [address, amount],
      chain,
      account,
    })

    // Wait for confirmation
    await this.publicClient.waitForTransactionReceipt({ hash: txHash })

    logger.info(
      'Funded NPC',
      {
        address,
        actorId: npc?.actorId,
        amount: formatEther(amount),
        txHash,
      },
      'NPCFundingService',
    )

    return {
      npc: { address, actorId: npc?.actorId ?? 'unknown' },
      amount,
      txHash,
      success: true,
    }
  }

  /**
   * Fund a batch of NPCs using multicall for gas efficiency
   */
  private async fundBatch(npcs: NPCWallet[]): Promise<FundingResult[]> {
    if (!this.config.treasuryPrivateKey) {
      return npcs.map((npc) => ({
        npc: { address: npc.address, actorId: npc.actorId },
        amount: getAllocationForTier(npc.tier),
        txHash: '0x0' as Hex,
        success: false,
        error: 'Treasury private key not configured',
      }))
    }

    // In dev mode or if multicall not available, do individual transfers
    if (this.config.devMode || npcs.length === 1) {
      const results: FundingResult[] = []
      for (const npc of npcs) {
        const amount = getAllocationForTier(npc.tier)
        const result = await this.fundNPC(npc.address, amount)
        results.push(result)
      }
      return results
    }

    // Use multicall for batch transfers
    const account = privateKeyToAccount(this.config.treasuryPrivateKey)
    const chain = getChainFromId(this.config.chainId)
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(this.config.rpcUrl),
    })

    // Build multicall data
    const calls = npcs.map((npc) => {
      const amount = getAllocationForTier(npc.tier)
      const callData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [npc.address, amount],
      })

      return {
        target: this.config.tokenAddress,
        allowFailure: true,
        callData,
      }
    })

    const txHash = await writeContract(walletClient, {
      address: MULTICALL3_ADDRESS,
      abi: MULTICALL3_ABI,
      functionName: 'aggregate3',
      args: [calls],
    })

    // Wait for confirmation
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    })

    // Map results
    return npcs.map((npc, index) => ({
      npc: { address: npc.address, actorId: npc.actorId },
      amount: getAllocationForTier(npc.tier),
      txHash,
      success: receipt.status === 'success',
      error:
        receipt.status !== 'success'
          ? `Transaction failed at index ${index}`
          : undefined,
    }))
  }

  // ===========================================================================
  // BALANCE CHECKING
  // ===========================================================================

  /**
   * Get all NPC balances and funding status
   */
  async getNPCBalances(): Promise<NPCBalance[]> {
    await this.ensureInitialized()

    const balances: NPCBalance[] = []

    for (const npc of this.npcWallets) {
      const balance = await this.getNPCBalance(npc.address)
      const expectedAllocation = getAllocationForTier(npc.tier)

      balances.push({
        address: npc.address,
        actorId: npc.actorId,
        balance,
        funded: balance >= expectedAllocation,
        expectedTier: npc.tier,
        expectedAllocation,
      })
    }

    return balances
  }

  /**
   * Get single NPC balance
   */
  private async getNPCBalance(address: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.config.tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    })
  }

  // ===========================================================================
  // TGE INTEGRATION
  // ===========================================================================

  /**
   * Execute TGE funding - called by ICOAutomationService
   */
  async executeTGEFunding(): Promise<TGEFundingResult> {
    await this.ensureInitialized()

    logger.info('Executing TGE NPC funding', undefined, 'NPCFundingService')

    // Get NPCs that need funding
    const balances = await this.getNPCBalances()
    const unfundedNPCs = balances.filter((b) => !b.funded)

    if (unfundedNPCs.length === 0) {
      logger.info('All NPCs already funded', undefined, 'NPCFundingService')
      return { totalFunded: 0n, results: [], txHashes: [] }
    }

    // Fund unfunded NPCs
    const { results, totalFunded } = await this.fundAllNPCs()
    const txHashes = [
      ...new Set(results.filter((r) => r.success).map((r) => r.txHash)),
    ]

    logger.info(
      'TGE NPC funding complete',
      {
        totalFunded: formatEther(totalFunded),
        npcsFunded: results.filter((r) => r.success).length,
        txCount: txHashes.length,
      },
      'NPCFundingService',
    )

    return { totalFunded, results, txHashes }
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  /**
   * Get service configuration
   */
  getConfig(): NPCFundingConfig {
    return { ...this.config }
  }

  /**
   * Get discovered NPC wallets
   */
  getNPCWallets(): NPCWallet[] {
    return [...this.npcWallets]
  }

  /**
   * Set treasury private key (for runtime configuration)
   */
  setTreasuryPrivateKey(privateKey: Hex): void {
    this.config.treasuryPrivateKey = privateKey
  }

  /**
   * Get funding status summary
   */
  async getFundingStatus(): Promise<{
    totalNPCs: number
    funded: number
    unfunded: number
    totalFundedAmount: bigint
    totalPendingAmount: bigint
    byTier: Record<
      NPCTierName,
      { funded: number; unfunded: number; total: number }
    >
  }> {
    await this.ensureInitialized()

    const balances = await this.getNPCBalances()

    const byTier: Record<
      NPCTierName,
      { funded: number; unfunded: number; total: number }
    > = {
      tier1: { funded: 0, unfunded: 0, total: 0 },
      tier2: { funded: 0, unfunded: 0, total: 0 },
      tier3: { funded: 0, unfunded: 0, total: 0 },
    }

    let funded = 0
    let unfunded = 0
    let totalFundedAmount = 0n
    let totalPendingAmount = 0n

    for (const balance of balances) {
      byTier[balance.expectedTier].total++

      if (balance.funded) {
        funded++
        byTier[balance.expectedTier].funded++
        totalFundedAmount += balance.balance
      } else {
        unfunded++
        byTier[balance.expectedTier].unfunded++
        totalPendingAmount += balance.expectedAllocation - balance.balance
      }
    }

    return {
      totalNPCs: balances.length,
      funded,
      unfunded,
      totalFundedAmount,
      totalPendingAmount,
      byTier,
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let npcFundingService: NPCFundingService | null = null

export function getNPCFundingService(
  config?: Partial<NPCFundingConfig>,
): NPCFundingService {
  if (!npcFundingService) {
    npcFundingService = new NPCFundingService(config)
  }
  return npcFundingService
}

export async function initializeNPCFundingService(
  config?: Partial<NPCFundingConfig>,
): Promise<NPCFundingService> {
  const service = getNPCFundingService(config)
  await service.initialize()
  return service
}

export function resetNPCFundingService(): void {
  npcFundingService = null
}
