/**
 * NPC Wallet Adapter
 *
 * Wraps BBLNWalletService to implement WalletPort interface for NPC actors.
 * NPCs use real BBLN tokens for all trades - no simulation mode.
 *
 * NPC wallets are managed via Jeju KMS (NPCIdentityService).
 * This adapter translates actorId -> walletAddress -> BBLN operations.
 */

import { actorState, db, eq } from '@babylon/db'
import {
  BBLN_TOKEN_ABI,
  getBBLNContracts,
  getCurrentNetwork,
  getNetworkConfig,
  logger,
  type NetworkName,
  type WalletPort,
} from '@babylon/shared'
import {
  type Address,
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  parseUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia, hardhat } from 'viem/chains'

const BBLN_DECIMALS = 18

/**
 * Get NPC's wallet address from database
 * NPCs have User records with wallet addresses created by NPCIdentityService
 */
async function getNPCWalletAddress(actorId: string): Promise<Address | null> {
  // First check actorState for walletAddress
  const [actor] = await db
    .select({ walletAddress: actorState.walletAddress })
    .from(actorState)
    .where(eq(actorState.id, actorId))
    .limit(1)

  if (actor?.walletAddress) {
    return actor.walletAddress as Address
  }

  // NPCs may also have User records with wallet addresses
  const user = await db.user.findUnique({ where: { id: actorId } })
  if (user?.walletAddress) {
    return user.walletAddress as Address
  }

  return null
}

/**
 * Creates viem clients for BBLN token operations
 */
function createBBLNClients(network: NetworkName = getCurrentNetwork()) {
  const config = getNetworkConfig(network)
  const chain =
    network === 'mainnet' ? base : network === 'testnet' ? baseSepolia : hardhat

  // Pool custody wallet - holds tokens during active trades
  const privateKey = (process.env.POOL_CUSTODY_PRIVATE_KEY ??
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d') as `0x${string}`
  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  })

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl),
  })

  return { publicClient, walletClient }
}

/**
 * Get BBLN balance for an address
 */
async function getBBLNBalance(
  address: Address,
  network: NetworkName = getCurrentNetwork(),
): Promise<bigint> {
  const contracts = getBBLNContracts(network)
  if (!contracts.token) {
    throw new Error(`BBLN token not deployed on ${network}`)
  }

  const { publicClient } = createBBLNClients(network)
  const balance = await publicClient.readContract({
    address: contracts.token,
    abi: BBLN_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address],
  })

  return balance as bigint
}

/**
 * Transfer BBLN tokens
 */
async function transferBBLN(
  to: Address,
  amount: bigint,
  network: NetworkName = getCurrentNetwork(),
): Promise<`0x${string}`> {
  const contracts = getBBLNContracts(network)
  if (!contracts.token) {
    throw new Error(`BBLN token not deployed on ${network}`)
  }

  const { walletClient } = createBBLNClients(network)
  const txHash = await walletClient.writeContract({
    address: contracts.token,
    abi: BBLN_TOKEN_ABI,
    functionName: 'transfer',
    args: [to, amount],
  })

  return txHash
}

/**
 * Creates a WalletPort implementation for NPC actors using real BBLN tokens.
 *
 * @param actorId - The NPC actor ID
 * @returns WalletPort interface for the NPC
 */
export function createNpcWalletAdapter(actorId: string): WalletPort {
  const network = getCurrentNetwork()

  return {
    async getBalance(): Promise<{ balance: number }> {
      const walletAddress = await getNPCWalletAddress(actorId)

      if (!walletAddress) {
        // Fallback to actorState.tradingBalance for backward compatibility
        // This handles NPCs that haven't been initialized with wallets yet
        const [actor] = await db
          .select({ tradingBalance: actorState.tradingBalance })
          .from(actorState)
          .where(eq(actorState.id, actorId))
          .limit(1)

        if (!actor) {
          return { balance: 0 }
        }

        return { balance: Number(actor.tradingBalance) }
      }

      // Get on-chain BBLN balance
      const balanceWei = await getBBLNBalance(walletAddress, network)
      return { balance: Number(formatUnits(balanceWei, BBLN_DECIMALS)) }
    },

    async debit({
      amount,
      reason,
    }: {
      userId?: string
      amount: number
      reason: string
      description?: string
      relatedId?: string
    }): Promise<void> {
      const walletAddress = await getNPCWalletAddress(actorId)

      if (!walletAddress) {
        // Fallback to database balance for NPCs without wallets
        const [actor] = await db
          .select({ tradingBalance: actorState.tradingBalance })
          .from(actorState)
          .where(eq(actorState.id, actorId))
          .limit(1)

        if (!actor) {
          throw new Error(`Actor not found: ${actorId}`)
        }

        const currentBalance = Number(actor.tradingBalance)
        if (currentBalance < amount) {
          throw new Error(
            `Insufficient trading balance: ${currentBalance.toFixed(2)} < ${amount.toFixed(2)} (${reason})`,
          )
        }

        await db
          .update(actorState)
          .set({
            tradingBalance: String(currentBalance - amount),
            updatedAt: new Date(),
          })
          .where(eq(actorState.id, actorId))

        return
      }

      // Use real BBLN token transfer
      const amountWei = parseUnits(String(amount), BBLN_DECIMALS)
      const balance = await getBBLNBalance(walletAddress, network)

      if (balance < amountWei) {
        throw new Error(
          `Insufficient BBLN balance: ${formatUnits(balance, BBLN_DECIMALS)} < ${amount} (${reason})`,
        )
      }

      // Transfer from NPC wallet to pool custody
      const poolAddress = (process.env.BBLN_POOL_CUSTODY_ADDRESS ??
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8') as Address

      await transferBBLN(poolAddress, amountWei, network)

      logger.debug(
        'NPC BBLN debit',
        { actorId, amount, walletAddress, reason },
        'NpcWallet',
      )
    },

    async credit({
      amount,
      reason,
    }: {
      userId?: string
      amount: number
      reason: string
      description?: string
      relatedId?: string
    }): Promise<void> {
      const walletAddress = await getNPCWalletAddress(actorId)

      if (!walletAddress) {
        // Fallback to database balance for NPCs without wallets
        const [actor] = await db
          .select({ tradingBalance: actorState.tradingBalance })
          .from(actorState)
          .where(eq(actorState.id, actorId))
          .limit(1)

        if (!actor) {
          throw new Error(`Actor not found: ${actorId}`)
        }

        const currentBalance = Number(actor.tradingBalance)
        await db
          .update(actorState)
          .set({
            tradingBalance: String(currentBalance + amount),
            updatedAt: new Date(),
          })
          .where(eq(actorState.id, actorId))

        return
      }

      // Transfer BBLN from pool custody to NPC wallet
      const amountWei = parseUnits(String(amount), BBLN_DECIMALS)
      await transferBBLN(walletAddress, amountWei, network)

      logger.debug(
        'NPC BBLN credit',
        { actorId, amount, walletAddress, reason },
        'NpcWallet',
      )
    },

    async recordPnL({
      pnl,
      reason,
    }: {
      userId?: string
      pnl: number
      reason: string
      relatedId?: string
    }): Promise<void> {
      if (process.env.NODE_ENV === 'development') {
        logger.debug(
          'NPC PnL update',
          { actorId, pnl: pnl.toFixed(2), reason },
          'NpcWallet',
        )
      }
    },
  }
}
