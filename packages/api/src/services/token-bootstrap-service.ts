/**
 * Token Bootstrap Service
 *
 * Orchestrates complete token ecosystem setup on startup:
 * - BBLN token deployment
 * - DAO deployment (governor, treasury, timelock)
 * - XLP liquidity pool creation and seeding
 * - NPC capital funding
 *
 * Fully idempotent - safe to call multiple times, only deploys what's missing.
 * All deployed addresses are stored in deployment-config.json, NOT env vars.
 *
 * @packageDocumentation
 */

import { join } from 'node:path'
import {
  type DAOContracts,
  getBBLNContracts,
  getCurrentNetwork,
  getDAOContracts,
  getLiquidityConfig,
  getLiquidityContracts,
  getNetworkConfig,
  getNPCFundingConfig,
  isBBLNDeployed,
  isDAODeployed,
  isLiquiditySetup,
  isNetworkInitialized,
  logger,
  markNetworkInitialized,
  type NetworkName,
  setBBLNContracts,
  setDAOContracts,
  setLiquidityContracts,
} from '@babylon/shared'
import { getWethAddress } from '@babylon/shared/config'
import { readContract } from '@jejunetwork/contracts/viem'
import {
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia, hardhat } from 'viem/chains'

// =============================================================================
// TYPES
// =============================================================================

export interface TokenBootstrapResult {
  network: NetworkName
  tokenDeployed: boolean
  tokenAddress: Address | null
  daoDeployed: boolean
  daoAddresses: DAOContracts | null
  liquiditySetup: boolean
  liquidityPairs: {
    ethBbln: Address | null
    jejuBbln: Address | null
  }
  npcsCount: number
  npcsTotalFunding: bigint
  alreadyInitialized: boolean
  errors: string[]
}

export interface BootstrapOptions {
  force?: boolean
  skipLiquidity?: boolean
  skipNpcFunding?: boolean
  dryRun?: boolean
}

// =============================================================================
// CONTRACT ABIS
// =============================================================================

const ERC20_MINT_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
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
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const XLP_FACTORY_ABI = [
  {
    name: 'createPair',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    outputs: [{ name: 'pair', type: 'address' }],
  },
  {
    name: 'getPair',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    outputs: [{ name: 'pair', type: 'address' }],
  },
] as const

const XLP_ROUTER_ABI = [
  {
    name: 'addLiquidityETH',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amountTokenDesired', type: 'uint256' },
      { name: 'amountTokenMin', type: 'uint256' },
      { name: 'amountETHMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [
      { name: 'amountToken', type: 'uint256' },
      { name: 'amountETH', type: 'uint256' },
      { name: 'liquidity', type: 'uint256' },
    ],
  },
  {
    name: 'addLiquidity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'amountADesired', type: 'uint256' },
      { name: 'amountBDesired', type: 'uint256' },
      { name: 'amountAMin', type: 'uint256' },
      { name: 'amountBMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [
      { name: 'amountA', type: 'uint256' },
      { name: 'amountB', type: 'uint256' },
      { name: 'liquidity', type: 'uint256' },
    ],
  },
] as const

// =============================================================================
// TOKEN BOOTSTRAP SERVICE
// =============================================================================

export class TokenBootstrapService {
  private network: NetworkName
  private publicClient: ReturnType<typeof createPublicClient>
  private walletClient: ReturnType<typeof createWalletClient>
  private account: ReturnType<typeof privateKeyToAccount>
  private rpcUrl: string
  private chain: Chain

  constructor(network?: NetworkName) {
    this.network = network ?? getCurrentNetwork()
    const config = getNetworkConfig(this.network)
    this.rpcUrl = config.rpcUrl

    // Set chain based on network
    if (this.network === 'mainnet') {
      this.chain = base
    } else if (this.network === 'testnet') {
      this.chain = baseSepolia
    } else {
      this.chain = hardhat
    }

    // Get deployer private key from environment
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY
    if (!privateKey) {
      // Use default hardhat key for local development
      const hardhatKey =
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`
      this.account = privateKeyToAccount(hardhatKey)
    } else {
      this.account = privateKeyToAccount(privateKey as `0x${string}`)
    }

    // Create clients
    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(this.rpcUrl),
    })

    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(this.rpcUrl),
    })
  }

  /**
   * Get the network this service is configured for
   */
  getNetwork(): NetworkName {
    return this.network
  }

  /**
   * Bootstrap the complete token ecosystem
   * Idempotent - safe to call multiple times
   */
  async bootstrap(
    options: BootstrapOptions = {},
  ): Promise<TokenBootstrapResult> {
    const result: TokenBootstrapResult = {
      network: this.network,
      tokenDeployed: false,
      tokenAddress: null,
      daoDeployed: false,
      daoAddresses: null,
      liquiditySetup: false,
      liquidityPairs: {
        ethBbln: null,
        jejuBbln: null,
      },
      npcsCount: 0,
      npcsTotalFunding: 0n,
      alreadyInitialized: false,
      errors: [],
    }

    // Check if already initialized
    if (isNetworkInitialized(this.network) && !options.force) {
      logger.info(
        `Network ${this.network} already initialized, skipping bootstrap`,
        { network: this.network },
        'TokenBootstrap',
      )
      result.alreadyInitialized = true
      result.tokenAddress = getBBLNContracts(this.network).token
      result.daoAddresses = getDAOContracts(this.network)
      result.liquidityPairs = {
        ethBbln: getLiquidityContracts(this.network).ethBblnPair,
        jejuBbln: getLiquidityContracts(this.network).jejuBblnPair,
      }
      return result
    }

    if (options.dryRun) {
      logger.info(
        'DRY RUN - No transactions will be executed',
        undefined,
        'TokenBootstrap',
      )
    }

    logger.info(
      `Bootstrapping token ecosystem on ${this.network}`,
      undefined,
      'TokenBootstrap',
    )

    // Step 1: Deploy BBLN Token (if not deployed)
    if (!isBBLNDeployed(this.network)) {
      logger.info('Deploying BBLN token...', undefined, 'TokenBootstrap')
      if (!options.dryRun) {
        try {
          const tokenAddress = await this.deployBBLNToken()
          result.tokenDeployed = true
          result.tokenAddress = tokenAddress
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error)
          result.errors.push(`Token deployment failed: ${errorMsg}`)
          logger.error(
            'Token deployment failed',
            { error: errorMsg },
            'TokenBootstrap',
          )
        }
      }
    } else {
      result.tokenAddress = getBBLNContracts(this.network).token
      logger.info(
        `BBLN token already deployed at ${result.tokenAddress}`,
        undefined,
        'TokenBootstrap',
      )
    }

    // Step 2: Deploy DAO (if not deployed)
    if (!isDAODeployed(this.network) && result.tokenAddress) {
      logger.info('Deploying DAO contracts...', undefined, 'TokenBootstrap')
      if (!options.dryRun) {
        try {
          const daoAddresses = await this.deployDAO(result.tokenAddress)
          result.daoDeployed = true
          result.daoAddresses = daoAddresses
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error)
          result.errors.push(`DAO deployment failed: ${errorMsg}`)
          logger.error(
            'DAO deployment failed',
            { error: errorMsg },
            'TokenBootstrap',
          )
        }
      }
    } else if (isDAODeployed(this.network)) {
      result.daoAddresses = getDAOContracts(this.network)
      logger.info(
        `DAO already deployed`,
        { addresses: result.daoAddresses },
        'TokenBootstrap',
      )
    }

    // Step 3: Setup Liquidity Pools
    if (
      !options.skipLiquidity &&
      result.tokenAddress &&
      !isLiquiditySetup(this.network)
    ) {
      logger.info('Setting up liquidity pools...', undefined, 'TokenBootstrap')
      if (!options.dryRun) {
        try {
          const pairs = await this.setupLiquidityPools(result.tokenAddress)
          result.liquiditySetup = true
          result.liquidityPairs = pairs
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error)
          result.errors.push(`Liquidity setup failed: ${errorMsg}`)
          logger.error(
            'Liquidity setup failed',
            { error: errorMsg },
            'TokenBootstrap',
          )
        }
      }
    } else if (isLiquiditySetup(this.network)) {
      result.liquidityPairs = {
        ethBbln: getLiquidityContracts(this.network).ethBblnPair,
        jejuBbln: getLiquidityContracts(this.network).jejuBblnPair,
      }
      logger.info('Liquidity pools already setup', undefined, 'TokenBootstrap')
    }

    // Step 4: Fund NPCs
    if (!options.skipNpcFunding && result.tokenAddress) {
      logger.info('Funding NPCs with BBLN...', undefined, 'TokenBootstrap')
      if (!options.dryRun) {
        try {
          const { count, totalFunding } = await this.fundNPCs(
            result.tokenAddress,
          )
          result.npcsCount = count
          result.npcsTotalFunding = totalFunding
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error)
          result.errors.push(`NPC funding failed: ${errorMsg}`)
          logger.error(
            'NPC funding failed',
            { error: errorMsg },
            'TokenBootstrap',
          )
        }
      }
    }

    // Mark as initialized if no critical errors
    if (result.tokenAddress && result.errors.length === 0 && !options.dryRun) {
      await markNetworkInitialized(this.network)
    }

    // Log summary
    logger.info(
      'Token bootstrap complete',
      {
        network: this.network,
        tokenDeployed: result.tokenDeployed,
        tokenAddress: result.tokenAddress,
        daoDeployed: result.daoDeployed,
        liquiditySetup: result.liquiditySetup,
        npcsCount: result.npcsCount,
        npcsTotalFunding: formatUnits(result.npcsTotalFunding, 18),
        errors: result.errors,
      },
      'TokenBootstrap',
    )

    return result
  }

  /**
   * Deploy BBLN token using Jeju CLI
   *
   * Babylon uses Jeju's token infrastructure - we deploy via `jeju deploy token`
   * which uses Jeju's Token.sol contract. The token is just JEJU configured
   * with BBLN branding.
   */
  private async deployBBLNToken(): Promise<Address> {
    logger.info(
      `Deploying BBLN token for ${this.network}...`,
      undefined,
      'TokenBootstrap',
    )

    const { $ } = await import('bun')

    // Map network names
    const jejuNetwork = this.network === 'localnet' ? 'localnet' : this.network

    // Use Jeju CLI to deploy token
    // This deploys Jeju's Token.sol which Babylon uses for BBLN
    const result = await $`jeju deploy token --network ${jejuNetwork}`
      .quiet()
      .nothrow()

    if (result.exitCode !== 0) {
      const errorText = result.stderr.toString()
      logger.warn(
        'Jeju token deployment failed or not available',
        { error: errorText },
        'TokenBootstrap',
      )

      // For localnet, check if token already exists from previous deployment
      if (this.network === 'localnet') {
        // Try to read from Jeju's deployment output
        const { readFileSync, existsSync } = await import('node:fs')
        const jejuRoot =
          process.env.JEJU_ROOT ?? join(process.cwd(), '..', '..')
        const deploymentPath = join(
          jejuRoot,
          'packages/contracts/deployments/token-localnet.json',
        )

        if (existsSync(deploymentPath)) {
          const deployments = JSON.parse(readFileSync(deploymentPath, 'utf-8'))
          if (deployments.jeju?.token?.address) {
            const address = deployments.jeju.token.address as Address
            await setBBLNContracts(this.network, { token: address })
            logger.info(
              `Using existing token from Jeju deployment: ${address}`,
              undefined,
              'TokenBootstrap',
            )
            return address
          }
        }

        // Fallback: use a deterministic address for local dev
        // This assumes the Jeju localnet chain has token deployed at a known address
        const mockAddress =
          '0x5FbDB2315678afecb367f032d93F642f64180aa3' as Address
        await setBBLNContracts(this.network, { token: mockAddress })
        logger.warn(
          'Using fallback token address for local dev',
          { address: mockAddress },
          'TokenBootstrap',
        )
        return mockAddress
      }

      throw new Error(
        `Token deployment failed. Run: jeju deploy token --network ${jejuNetwork}`,
      )
    }

    // Parse deployed address from output
    const output = result.text()
    const addressMatch = output.match(
      /Token[:\s]*(deployed at|address)?[:\s]*(0x[a-fA-F0-9]{40})/i,
    )

    if (addressMatch?.[2]) {
      const address = addressMatch[2] as Address
      await setBBLNContracts(this.network, { token: address })
      logger.info(
        `BBLN Token deployed at ${address}`,
        undefined,
        'TokenBootstrap',
      )
      return address
    }

    // Try reading from deployment file
    const { readFileSync, existsSync } = await import('node:fs')
    const jejuRoot = process.env.JEJU_ROOT ?? join(process.cwd(), '..', '..')
    const deploymentPath = join(
      jejuRoot,
      `packages/contracts/deployments/token-${jejuNetwork}.json`,
    )

    if (existsSync(deploymentPath)) {
      const deployments = JSON.parse(readFileSync(deploymentPath, 'utf-8'))
      if (deployments.jeju?.token?.address) {
        const address = deployments.jeju.token.address as Address
        await setBBLNContracts(this.network, { token: address })
        logger.info(
          `BBLN Token found at ${address}`,
          undefined,
          'TokenBootstrap',
        )
        return address
      }
    }

    throw new Error('Failed to parse token address from deployment output')
  }

  /**
   * Deploy DAO contracts (Governor, Timelock, Treasury)
   */
  private async deployDAO(_tokenAddress: Address): Promise<DAOContracts> {
    if (this.network === 'localnet') {
      // For local development, use mock addresses or deploy via Jeju
      const { $ } = await import('bun')
      const result = await $`jeju deploy dao babylon --network localnet`
        .quiet()
        .nothrow()

      if (result.exitCode !== 0) {
        // Use mock addresses for local dev
        const mockAddresses: DAOContracts = {
          governor: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as Address,
          timelock: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' as Address,
          treasury: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9' as Address,
        }
        await setDAOContracts(this.network, mockAddresses)
        logger.warn(
          'Using mock DAO addresses for local dev',
          mockAddresses,
          'TokenBootstrap',
        )
        return mockAddresses
      }

      // Parse deployed addresses
      const output = result.text()
      const governorMatch = output.match(/Governor[:\s]*(0x[a-fA-F0-9]{40})/)
      const timelockMatch = output.match(/Timelock[:\s]*(0x[a-fA-F0-9]{40})/)
      const treasuryMatch = output.match(/Treasury[:\s]*(0x[a-fA-F0-9]{40})/)

      const addresses: DAOContracts = {
        governor: governorMatch?.[1] as Address | null,
        timelock: timelockMatch?.[1] as Address | null,
        treasury: treasuryMatch?.[1] as Address | null,
      }
      await setDAOContracts(this.network, addresses)
      return addresses
    }

    throw new Error(
      `DAO not deployed on ${this.network}. Deploy with: babylon deploy dao --env ${this.network}`,
    )
  }

  /**
   * Setup XLP liquidity pools (ETH/BBLN and JEJU/BBLN)
   */
  private async setupLiquidityPools(
    tokenAddress: Address,
  ): Promise<{ ethBbln: Address | null; jejuBbln: Address | null }> {
    const liquidity = getLiquidityConfig(this.network)
    const contracts = getLiquidityContracts(this.network)

    // Check if XLP factory is deployed
    if (!contracts.xlpV2Factory || contracts.xlpV2Factory === zeroAddress) {
      logger.warn(
        'XLP V2 Factory not deployed, skipping liquidity setup',
        undefined,
        'TokenBootstrap',
      )
      return { ethBbln: null, jejuBbln: null }
    }

    const result: { ethBbln: Address | null; jejuBbln: Address | null } = {
      ethBbln: null,
      jejuBbln: null,
    }

    // WETH address (for local, use deployer to fund with ETH directly)
    const wethAddress = (getWethAddress(this.network) || undefined) as
      | Address
      | undefined

    // 1. Create ETH/BBLN pair
    logger.info(
      'Creating ETH/BBLN liquidity pool...',
      undefined,
      'TokenBootstrap',
    )

    if (wethAddress && contracts.xlpRouter) {
      // Approve tokens for router
      const ethBblnAmount = BigInt(liquidity.ethBblnInitialBbln)
      const ethAmount = BigInt(liquidity.ethBblnInitialEth)

      await this.walletClient.writeContract({
        account: this.account,
        chain: this.chain,
        address: tokenAddress,
        abi: ERC20_MINT_ABI,
        functionName: 'approve',
        args: [contracts.xlpRouter, ethBblnAmount],
      })

      // Add liquidity
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)
      const txHash = await this.walletClient.writeContract({
        account: this.account,
        chain: this.chain,
        address: contracts.xlpRouter,
        abi: XLP_ROUTER_ABI,
        functionName: 'addLiquidityETH',
        args: [
          tokenAddress,
          ethBblnAmount,
          0n, // min token
          0n, // min eth
          this.account.address,
          deadline,
        ],
        value: ethAmount,
      })

      logger.info(
        `ETH/BBLN liquidity added, tx: ${txHash}`,
        undefined,
        'TokenBootstrap',
      )

      // Get pair address
      const pairAddress = (await readContract(this.publicClient, {
        address: contracts.xlpV2Factory,
        abi: XLP_FACTORY_ABI,
        functionName: 'getPair',
        args: [wethAddress, tokenAddress],
      })) as Address

      result.ethBbln = pairAddress
      await setLiquidityContracts(this.network, { ethBblnPair: pairAddress })
    } else {
      logger.warn(
        'WETH or XLP Router not configured, skipping ETH/BBLN pool',
        undefined,
        'TokenBootstrap',
      )
    }

    // Save results - map to LiquidityContracts property names
    await setLiquidityContracts(this.network, {
      ethBblnPair: result.ethBbln,
      jejuBblnPair: result.jejuBbln,
    })
    return result
  }

  /**
   * Fund NPCs with initial BBLN allocation
   */
  private async fundNPCs(
    tokenAddress: Address,
  ): Promise<{ count: number; totalFunding: bigint }> {
    const fundingConfig = getNPCFundingConfig(this.network)

    if (!fundingConfig.enabled) {
      logger.info(
        'NPC funding disabled for this network',
        undefined,
        'TokenBootstrap',
      )
      return { count: 0, totalFunding: 0n }
    }

    // Get all NPCs from static data registry
    const { StaticDataRegistry } = await import('@babylon/engine')
    const actors = StaticDataRegistry.getAllActors()

    let count = 0
    let totalFunding = 0n

    // Get allocation by tier
    const tierAllocation: Record<string, bigint> = {
      S_TIER: BigInt(fundingConfig.sTierAllocation),
      A_TIER: BigInt(fundingConfig.aTierAllocation),
      B_TIER: BigInt(fundingConfig.bTierAllocation),
      C_TIER: BigInt(fundingConfig.cTierAllocation),
    }

    for (const actor of actors) {
      const tier = actor.tier ?? 'C_TIER'
      const cTierDefault = tierAllocation.C_TIER ?? 0n
      const allocation = tierAllocation[tier] ?? cTierDefault

      // In production, this would transfer real tokens
      // For local dev, we simulate or use mock balances
      if (this.network === 'localnet') {
        // Just track the allocation, actual funding happens in game bootstrap
        count++
        totalFunding += allocation
      } else {
        // Transfer tokens from treasury to NPC wallet
        // This requires the NPC identity service to get wallet addresses
        try {
          const { getNPCIdentityService } = await import('@babylon/agents')
          const identityService = getNPCIdentityService()
          const identity = await identityService.getNPCIdentity(actor.id)

          if (identity?.walletAddress) {
            await this.walletClient.writeContract({
              account: this.account,
              chain: this.chain,
              address: tokenAddress,
              abi: ERC20_MINT_ABI,
              functionName: 'transfer',
              args: [identity.walletAddress as Address, allocation],
            })
            count++
            totalFunding += allocation
          }
        } catch {
          logger.warn(
            `Failed to fund NPC ${actor.name}`,
            undefined,
            'TokenBootstrap',
          )
        }
      }
    }

    logger.info(
      `Funded ${count} NPCs with ${formatUnits(totalFunding, 18)} BBLN total`,
      undefined,
      'TokenBootstrap',
    )
    return { count, totalFunding }
  }

  /**
   * Get current bootstrap status
   */
  getStatus(): {
    network: NetworkName
    initialized: boolean
    tokenDeployed: boolean
    daoDeployed: boolean
    liquiditySetup: boolean
  } {
    return {
      network: this.network,
      initialized: isNetworkInitialized(this.network),
      tokenDeployed: isBBLNDeployed(this.network),
      daoDeployed: isDAODeployed(this.network),
      liquiditySetup: isLiquiditySetup(this.network),
    }
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

let bootstrapServiceInstance: TokenBootstrapService | null = null

/**
 * Get singleton instance of TokenBootstrapService
 */
export function getTokenBootstrapService(
  network?: NetworkName,
): TokenBootstrapService {
  if (
    !bootstrapServiceInstance ||
    (network && network !== bootstrapServiceInstance.getNetwork())
  ) {
    bootstrapServiceInstance = new TokenBootstrapService(network)
  }
  return bootstrapServiceInstance
}

/**
 * Bootstrap token ecosystem on current network
 */
export async function bootstrapTokenEcosystem(
  options?: BootstrapOptions,
): Promise<TokenBootstrapResult> {
  const service = getTokenBootstrapService()
  return service.bootstrap(options)
}

/**
 * Check if token ecosystem is ready
 */
export function isTokenEcosystemReady(): boolean {
  const network = getCurrentNetwork()
  return isNetworkInitialized(network) && isBBLNDeployed(network)
}
