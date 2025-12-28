/**
 * XLP Liquidity Service
 *
 * Manages liquidity pool creation and seeding for BBLN token pairs:
 * - ETH/BBLN: Primary trading pair
 * - JEJU/BBLN: Cross-ecosystem pair for Jeju network integration
 *
 * Uses Jeju XLP AMM (Uniswap V2-style) for:
 * - Constant-product pools
 * - LP token locking
 * - Fee distribution
 *
 * @packageDocumentation
 */

import {
  getBBLNContracts,
  getCurrentNetwork,
  getLiquidityConfig,
  getLiquidityContracts,
  logger,
  type NetworkName,
  setLiquidityContracts,
} from '@babylon/shared'
import {
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  formatEther,
  formatUnits,
  http,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia, hardhat } from 'viem/chains'

// =============================================================================
// TYPES
// =============================================================================

export interface LiquiditySeedResult {
  pairAddress: Address
  tokenAAmount: bigint
  tokenBAmount: bigint
  lpTokensReceived: bigint
  lpTokensLocked: bigint
  lockId: bigint
  txHash: `0x${string}`
}

export interface XLPConfig {
  factory: Address
  router: Address
  locker: Address
  weth: Address
  jeju?: Address
}

// =============================================================================
// CONTRACT ABIS
// =============================================================================

const ERC20_ABI = [
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
  {
    name: 'allPairsLength',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
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
  {
    name: 'WETH',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const LP_LOCKER_ABI = [
  {
    name: 'lockTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'lpToken', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'unlockTime', type: 'uint256' },
      { name: 'beneficiary', type: 'address' },
      { name: 'permanent', type: 'bool' },
    ],
    outputs: [{ name: 'lockId', type: 'uint256' }],
  },
  {
    name: 'getLockInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'lockId', type: 'uint256' }],
    outputs: [
      { name: 'lpToken', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'unlockTime', type: 'uint256' },
      { name: 'beneficiary', type: 'address' },
      { name: 'permanent', type: 'bool' },
    ],
  },
] as const

const XLP_PAIR_ABI = [
  {
    name: 'getReserves',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' },
    ],
  },
  {
    name: 'token0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'token1',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

// =============================================================================
// XLP LIQUIDITY SERVICE
// =============================================================================

export class XLPLiquidityService {
  private network: NetworkName
  private publicClient: ReturnType<typeof createPublicClient>
  private walletClient: ReturnType<typeof createWalletClient>
  private account: ReturnType<typeof privateKeyToAccount>
  private chain: Chain

  constructor(network?: NetworkName) {
    this.network = network ?? getCurrentNetwork()

    // Set chain based on network
    if (this.network === 'mainnet') {
      this.chain = base
    } else if (this.network === 'testnet') {
      this.chain = baseSepolia
    } else {
      this.chain = hardhat
    }

    // Get deployer private key
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY
    if (!privateKey) {
      // Use default hardhat key for local development
      const hardhatKey =
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`
      this.account = privateKeyToAccount(hardhatKey)
    } else {
      this.account = privateKeyToAccount(privateKey as `0x${string}`)
    }

    const rpcUrl = process.env.JEJU_RPC_URL ?? 'http://localhost:6546'

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(rpcUrl),
    })

    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(rpcUrl),
    })
  }

  /**
   * Seed ETH/BBLN liquidity pool
   */
  async seedEthBblnPool(): Promise<LiquiditySeedResult | null> {
    const bblnContracts = getBBLNContracts(this.network)
    const liquidityContracts = getLiquidityContracts(this.network)
    const liquidityConfig = getLiquidityConfig(this.network)

    if (!bblnContracts.token) {
      logger.warn(
        'BBLN token not deployed, cannot seed liquidity',
        undefined,
        'XLPLiquidity',
      )
      return null
    }

    if (
      !liquidityContracts.xlpRouter ||
      liquidityContracts.xlpRouter === zeroAddress
    ) {
      logger.warn(
        'XLP Router not deployed, cannot seed liquidity',
        undefined,
        'XLPLiquidity',
      )
      return null
    }

    const tokenAddress = bblnContracts.token
    const routerAddress = liquidityContracts.xlpRouter
    const ethAmount = BigInt(liquidityConfig.ethBblnInitialEth)
    const bblnAmount = BigInt(liquidityConfig.ethBblnInitialBbln)

    logger.info(
      `Seeding ETH/BBLN pool with ${formatEther(ethAmount)} ETH and ${formatUnits(bblnAmount, 18)} BBLN`,
      undefined,
      'XLPLiquidity',
    )

    // Approve BBLN for router
    const approveTx = await this.walletClient.writeContract({
      account: this.account,
      chain: this.chain,
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [routerAddress, bblnAmount],
    })
    logger.info(`Approved BBLN, tx: ${approveTx}`, undefined, 'XLPLiquidity')

    // Wait for approval
    await this.publicClient.waitForTransactionReceipt({ hash: approveTx })

    // Add liquidity with ETH
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)
    const addLiqTx = await this.walletClient.writeContract({
      account: this.account,
      chain: this.chain,
      address: routerAddress,
      abi: XLP_ROUTER_ABI,
      functionName: 'addLiquidityETH',
      args: [
        tokenAddress,
        bblnAmount,
        0n, // Accept any amount of tokens
        0n, // Accept any amount of ETH
        this.account.address,
        deadline,
      ],
      value: ethAmount,
    })

    logger.info(
      `Added ETH/BBLN liquidity, tx: ${addLiqTx}`,
      undefined,
      'XLPLiquidity',
    )

    // Wait for transaction and get receipt
    const _receipt = await this.publicClient.waitForTransactionReceipt({
      hash: addLiqTx,
    })

    // Get pair address
    const wethAddress = (await this.publicClient.readContract({
      address: routerAddress,
      abi: XLP_ROUTER_ABI,
      functionName: 'WETH',
    })) as Address

    const factoryAddress = liquidityContracts.xlpV2Factory
    if (!factoryAddress || factoryAddress === zeroAddress) {
      logger.warn(
        'Factory not found, cannot get pair address',
        undefined,
        'XLPLiquidity',
      )
      return null
    }

    const pairAddress = (await this.publicClient.readContract({
      address: factoryAddress,
      abi: XLP_FACTORY_ABI,
      functionName: 'getPair',
      args: [wethAddress, tokenAddress],
    })) as Address

    // Save pair address to config
    await setLiquidityContracts(this.network, { ethBblnPair: pairAddress })

    // Get LP token balance
    const lpBalance = (await this.publicClient.readContract({
      address: pairAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [this.account.address],
    })) as bigint

    logger.info(
      `ETH/BBLN pool seeded. Pair: ${pairAddress}, LP tokens: ${formatUnits(lpBalance, 18)}`,
      undefined,
      'XLPLiquidity',
    )

    // Lock LP tokens if locker is available
    let lockId = 0n
    let lpTokensLocked = 0n
    if (
      liquidityContracts.lpLocker &&
      liquidityContracts.lpLocker !== zeroAddress
    ) {
      const lockPercentage = liquidityConfig.lpLockPercentage
      lpTokensLocked = (lpBalance * BigInt(lockPercentage)) / 100n

      if (lpTokensLocked > 0n) {
        // Approve locker
        await this.walletClient.writeContract({
          account: this.account,
          chain: this.chain,
          address: pairAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [liquidityContracts.lpLocker, lpTokensLocked],
        })

        // Lock tokens
        const lockDuration = liquidityConfig.lpLockDurationDays * 24 * 60 * 60
        const unlockTime = BigInt(Math.floor(Date.now() / 1000) + lockDuration)

        const lockTx = await this.walletClient.writeContract({
          account: this.account,
          chain: this.chain,
          address: liquidityContracts.lpLocker,
          abi: LP_LOCKER_ABI,
          functionName: 'lockTokens',
          args: [
            pairAddress,
            lpTokensLocked,
            unlockTime,
            this.account.address,
            false, // Not permanent
          ],
        })

        await this.publicClient.waitForTransactionReceipt({ hash: lockTx })
        lockId = 1n // Simplified - in production would parse from events
        logger.info(
          `Locked ${formatUnits(lpTokensLocked, 18)} LP tokens for ${liquidityConfig.lpLockDurationDays} days`,
          undefined,
          'XLPLiquidity',
        )
      }
    }

    return {
      pairAddress,
      tokenAAmount: ethAmount,
      tokenBAmount: bblnAmount,
      lpTokensReceived: lpBalance,
      lpTokensLocked,
      lockId,
      txHash: addLiqTx,
    }
  }

  /**
   * Seed JEJU/BBLN liquidity pool
   */
  async seedJejuBblnPool(): Promise<LiquiditySeedResult | null> {
    const bblnContracts = getBBLNContracts(this.network)
    const liquidityContracts = getLiquidityContracts(this.network)
    const liquidityConfig = getLiquidityConfig(this.network)

    if (!bblnContracts.token) {
      logger.warn(
        'BBLN token not deployed, cannot seed liquidity',
        undefined,
        'XLPLiquidity',
      )
      return null
    }

    const jejuTokenAddress = process.env.JEJU_TOKEN_ADDRESS as
      | Address
      | undefined
    if (!jejuTokenAddress) {
      logger.warn(
        'JEJU token address not configured, skipping JEJU/BBLN pool',
        undefined,
        'XLPLiquidity',
      )
      return null
    }

    if (
      !liquidityContracts.xlpRouter ||
      liquidityContracts.xlpRouter === zeroAddress
    ) {
      logger.warn(
        'XLP Router not deployed, cannot seed liquidity',
        undefined,
        'XLPLiquidity',
      )
      return null
    }

    const bblnAddress = bblnContracts.token
    const routerAddress = liquidityContracts.xlpRouter
    const jejuAmount = BigInt(liquidityConfig.jejuBblnInitialJeju)
    const bblnAmount = BigInt(liquidityConfig.jejuBblnInitialBbln)

    logger.info(
      `Seeding JEJU/BBLN pool with ${formatUnits(jejuAmount, 18)} JEJU and ${formatUnits(bblnAmount, 18)} BBLN`,
      undefined,
      'XLPLiquidity',
    )

    // Approve both tokens for router
    await this.walletClient.writeContract({
      account: this.account,
      chain: this.chain,
      address: bblnAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [routerAddress, bblnAmount],
    })

    await this.walletClient.writeContract({
      account: this.account,
      chain: this.chain,
      address: jejuTokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [routerAddress, jejuAmount],
    })

    // Add liquidity
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)
    const addLiqTx = await this.walletClient.writeContract({
      account: this.account,
      chain: this.chain,
      address: routerAddress,
      abi: XLP_ROUTER_ABI,
      functionName: 'addLiquidity',
      args: [
        jejuTokenAddress,
        bblnAddress,
        jejuAmount,
        bblnAmount,
        0n,
        0n,
        this.account.address,
        deadline,
      ],
    })

    logger.info(
      `Added JEJU/BBLN liquidity, tx: ${addLiqTx}`,
      undefined,
      'XLPLiquidity',
    )

    // Wait for transaction
    await this.publicClient.waitForTransactionReceipt({ hash: addLiqTx })

    // Get pair address
    const factoryAddress = liquidityContracts.xlpV2Factory
    if (!factoryAddress || factoryAddress === zeroAddress) {
      return null
    }

    const pairAddress = (await this.publicClient.readContract({
      address: factoryAddress,
      abi: XLP_FACTORY_ABI,
      functionName: 'getPair',
      args: [jejuTokenAddress, bblnAddress],
    })) as Address

    // Save pair address
    await setLiquidityContracts(this.network, { jejuBblnPair: pairAddress })

    // Get LP token balance
    const lpBalance = (await this.publicClient.readContract({
      address: pairAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [this.account.address],
    })) as bigint

    logger.info(
      `JEJU/BBLN pool seeded. Pair: ${pairAddress}, LP tokens: ${formatUnits(lpBalance, 18)}`,
      undefined,
      'XLPLiquidity',
    )

    return {
      pairAddress,
      tokenAAmount: jejuAmount,
      tokenBAmount: bblnAmount,
      lpTokensReceived: lpBalance,
      lpTokensLocked: 0n,
      lockId: 0n,
      txHash: addLiqTx,
    }
  }

  /**
   * Get pool info for ETH/BBLN pair
   */
  async getEthBblnPoolInfo(): Promise<{
    pairAddress: Address | null
    reserve0: bigint
    reserve1: bigint
    totalSupply: bigint
    token0: Address
    token1: Address
  } | null> {
    const liquidityContracts = getLiquidityContracts(this.network)
    const pairAddress = liquidityContracts.ethBblnPair

    if (!pairAddress || pairAddress === zeroAddress) {
      return null
    }

    const [reserves, token0, token1, totalSupply] = await Promise.all([
      this.publicClient.readContract({
        address: pairAddress,
        abi: XLP_PAIR_ABI,
        functionName: 'getReserves',
      }) as Promise<[bigint, bigint, number]>,
      this.publicClient.readContract({
        address: pairAddress,
        abi: XLP_PAIR_ABI,
        functionName: 'token0',
      }) as Promise<Address>,
      this.publicClient.readContract({
        address: pairAddress,
        abi: XLP_PAIR_ABI,
        functionName: 'token1',
      }) as Promise<Address>,
      this.publicClient.readContract({
        address: pairAddress,
        abi: XLP_PAIR_ABI,
        functionName: 'totalSupply',
      }) as Promise<bigint>,
    ])

    return {
      pairAddress,
      reserve0: reserves[0],
      reserve1: reserves[1],
      totalSupply,
      token0,
      token1,
    }
  }

  /**
   * Seed all liquidity pools
   */
  async seedAllPools(): Promise<{
    ethBbln: LiquiditySeedResult | null
    jejuBbln: LiquiditySeedResult | null
  }> {
    logger.info('Seeding all liquidity pools...', undefined, 'XLPLiquidity')

    const ethBbln = await this.seedEthBblnPool()
    const jejuBbln = await this.seedJejuBblnPool()

    return { ethBbln, jejuBbln }
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

let xlpServiceInstance: XLPLiquidityService | null = null

/**
 * Get singleton XLP liquidity service
 */
export function getXLPLiquidityService(
  network?: NetworkName,
): XLPLiquidityService {
  if (!xlpServiceInstance) {
    xlpServiceInstance = new XLPLiquidityService(network)
  }
  return xlpServiceInstance
}

/**
 * Seed ETH/BBLN and JEJU/BBLN liquidity pools
 */
export async function seedLiquidityPools(): Promise<{
  ethBbln: LiquiditySeedResult | null
  jejuBbln: LiquiditySeedResult | null
}> {
  const service = getXLPLiquidityService()
  return service.seedAllPools()
}
