#!/usr/bin/env bun
/**
 * Register NPC FIDs on Farcaster
 *
 * This script registers Farcaster IDs (FIDs) for all NPC actors on Optimism.
 * FID registration requires gas on Optimism mainnet.
 *
 * Prerequisites:
 * - NPC wallets must be provisioned (run bootstrap first)
 * - Funding wallet with OP ETH for gas
 * - Optimism RPC access
 *
 * Usage:
 *   bun run scripts/register-npc-fids.ts [options]
 *
 * Options:
 *   --dry-run         Simulate without sending transactions
 *   --actor <id>      Register specific actor only
 *   --batch-size <n>  Number of registrations per batch (default: 5)
 *   --delay <ms>      Delay between batches in ms (default: 5000)
 *
 * Environment Variables:
 *   OPTIMISM_RPC_URL        Optimism RPC endpoint
 *   FUNDING_WALLET_KEY      Private key for gas funding
 *   FARCASTER_RECOVERY_KEY  Recovery address for FIDs (optional)
 *
 * @packageDocumentation
 */

import { db, eq, users } from '@babylon/db'
import { StaticDataRegistry } from '@babylon/engine'
import {
  type Address,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
  parseEther,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { optimism } from 'viem/chains'

// Farcaster IdRegistry on Optimism
const FARCASTER_ID_REGISTRY =
  '0x00000000Fc6c5F01Fc30151999387Bb99A9f489b' as const

// Minimal ABI for IdRegistry
const ID_REGISTRY_ABI = [
  {
    name: 'register',
    type: 'function',
    inputs: [{ name: 'recovery', type: 'address' }],
    outputs: [{ name: 'fid', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'idOf',
    type: 'function',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: 'fid', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'price',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

interface RegistrationResult {
  actorId: string
  walletAddress: Address
  fid: number
  txHash?: string
  status: 'success' | 'skipped' | 'failed'
  error?: string
}

interface ScriptOptions {
  dryRun: boolean
  actorId?: string
  batchSize: number
  batchDelay: number
}

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2)
  const options: ScriptOptions = {
    dryRun: false,
    batchSize: 5,
    batchDelay: 5000,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        options.dryRun = true
        break
      case '--actor':
        options.actorId = args[++i]
        break
      case '--batch-size':
        options.batchSize = parseInt(args[++i] ?? '5', 10)
        break
      case '--delay':
        options.batchDelay = parseInt(args[++i] ?? '5000', 10)
        break
      case '--help':
        console.log(`
Register NPC FIDs on Farcaster

Usage: bun run scripts/register-npc-fids.ts [options]

Options:
  --dry-run         Simulate without sending transactions
  --actor <id>      Register specific actor only
  --batch-size <n>  Number of registrations per batch (default: 5)
  --delay <ms>      Delay between batches in ms (default: 5000)
  --help            Show this help message

Environment Variables:
  OPTIMISM_RPC_URL        Optimism RPC endpoint
  FUNDING_WALLET_KEY      Private key for gas funding
  FARCASTER_RECOVERY_KEY  Recovery address for FIDs (optional)

Example:
  bun run scripts/register-npc-fids.ts --dry-run
  bun run scripts/register-npc-fids.ts --actor ailon-musk
  bun run scripts/register-npc-fids.ts --batch-size 10 --delay 10000
`)
        process.exit(0)
    }
  }

  return options
}

async function main() {
  const options = parseArgs()

  console.log('🎭 Farcaster NPC FID Registration')
  console.log('==================================')
  console.log(`Mode: ${options.dryRun ? 'DRY RUN (no transactions)' : 'LIVE'}`)
  console.log(`Batch Size: ${options.batchSize}`)
  console.log(`Batch Delay: ${options.batchDelay}ms`)
  console.log('')

  // Validate environment
  const rpcUrl = process.env.OPTIMISM_RPC_URL ?? 'https://mainnet.optimism.io'
  const fundingKey = process.env.FUNDING_WALLET_KEY as Hex | undefined
  const recoveryAddress = (
    (process.env.FARCASTER_RECOVERY_KEY ?? process.env.FUNDING_WALLET_KEY)
      ? privateKeyToAccount(process.env.FUNDING_WALLET_KEY as Hex).address
      : undefined
  ) as Address | undefined

  if (!options.dryRun && !fundingKey) {
    console.error(
      '❌ FUNDING_WALLET_KEY environment variable required for live mode',
    )
    process.exit(1)
  }

  // Create clients
  const publicClient = createPublicClient({
    chain: optimism,
    transport: http(rpcUrl),
  })

  let walletClient: ReturnType<typeof createWalletClient> | null = null
  let fundingAccount: ReturnType<typeof privateKeyToAccount> | null = null

  if (!options.dryRun && fundingKey) {
    fundingAccount = privateKeyToAccount(fundingKey)
    walletClient = createWalletClient({
      account: fundingAccount,
      chain: optimism,
      transport: http(rpcUrl),
    })
    console.log(`💰 Funding wallet: ${fundingAccount.address}`)
  }

  // Get current FID price
  const fidPrice = await publicClient.readContract({
    address: FARCASTER_ID_REGISTRY,
    abi: ID_REGISTRY_ABI,
    functionName: 'price',
  })

  console.log(`💵 Current FID price: ${Number(fidPrice) / 1e18} ETH`)
  console.log('')

  // Get actors to register
  const allActors = StaticDataRegistry.getAllActors()
  const actors = options.actorId
    ? allActors.filter((a) => a.id === options.actorId)
    : allActors

  if (actors.length === 0) {
    console.error('❌ No actors found')
    process.exit(1)
  }

  console.log(`📋 Found ${actors.length} actors to process`)
  console.log('')

  // Load NPC user records with wallets
  const npcsWithWallets: Array<{
    actorId: string
    userId: string
    walletAddress: Address
    currentFid: number | null
  }> = []

  for (const actor of actors) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, actor.id))
      .limit(1)

    if (!user?.walletAddress) {
      console.warn(`⚠️  ${actor.id}: No wallet address, skipping`)
      continue
    }

    npcsWithWallets.push({
      actorId: actor.id,
      userId: user.id,
      walletAddress: user.walletAddress as Address,
      currentFid: user.farcasterFid ? parseInt(user.farcasterFid, 10) : null,
    })
  }

  console.log(`✅ ${npcsWithWallets.length} NPCs have wallets`)
  console.log('')

  // Check existing FIDs
  const toRegister: typeof npcsWithWallets = []
  const alreadyRegistered: typeof npcsWithWallets = []

  for (const npc of npcsWithWallets) {
    // Check if already has FID on-chain
    const existingFid = await publicClient.readContract({
      address: FARCASTER_ID_REGISTRY,
      abi: ID_REGISTRY_ABI,
      functionName: 'idOf',
      args: [npc.walletAddress],
    })

    if (existingFid > 0n) {
      alreadyRegistered.push({ ...npc, currentFid: Number(existingFid) })
    } else {
      toRegister.push(npc)
    }
  }

  console.log(`📊 Status:`)
  console.log(`   Already registered: ${alreadyRegistered.length}`)
  console.log(`   Need registration: ${toRegister.length}`)
  console.log('')

  if (toRegister.length === 0) {
    console.log('✅ All NPCs already have FIDs!')

    // Update database with any missing FIDs
    for (const npc of alreadyRegistered) {
      if (!npc.currentFid) continue

      await db
        .update(users)
        .set({
          farcasterFid: npc.currentFid.toString(),
          hasFarcaster: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, npc.userId))
    }

    console.log('✅ Database updated with existing FIDs')
    process.exit(0)
  }

  // Estimate total cost
  const totalCost = fidPrice * BigInt(toRegister.length)
  console.log(`💰 Estimated total cost: ${Number(totalCost) / 1e18} ETH`)
  console.log('')

  if (options.dryRun) {
    console.log('🔍 DRY RUN - Would register the following NPCs:')
    for (const npc of toRegister) {
      console.log(`   - ${npc.actorId} (${npc.walletAddress})`)
    }
    console.log('')
    console.log('Run without --dry-run to execute transactions')
    process.exit(0)
  }

  // Confirm before proceeding
  console.log('⚠️  This will register FIDs on Optimism mainnet.')
  console.log('   Press Ctrl+C within 5 seconds to cancel...')
  await new Promise((resolve) => setTimeout(resolve, 5000))
  console.log('')

  // Process registrations in batches
  const results: RegistrationResult[] = []

  for (let i = 0; i < toRegister.length; i += options.batchSize) {
    const batch = toRegister.slice(i, i + options.batchSize)
    console.log(
      `📦 Processing batch ${Math.floor(i / options.batchSize) + 1}/${Math.ceil(toRegister.length / options.batchSize)}`,
    )

    for (const npc of batch) {
      const result = await registerFID(
        npc,
        publicClient,
        walletClient,
        fundingAccount,
        recoveryAddress,
        fidPrice,
      )
      results.push(result)

      if (result.status === 'success') {
        // Update database
        await db
          .update(users)
          .set({
            farcasterFid: result.fid.toString(),
            hasFarcaster: true,
            updatedAt: new Date(),
          })
          .where(eq(users.id, npc.userId))
      }
    }

    // Delay between batches
    if (i + options.batchSize < toRegister.length) {
      console.log(`⏳ Waiting ${options.batchDelay}ms before next batch...`)
      await new Promise((resolve) => setTimeout(resolve, options.batchDelay))
    }
  }

  // Summary
  console.log('')
  console.log('📊 Registration Summary')
  console.log('=======================')

  const successful = results.filter((r) => r.status === 'success')
  const skipped = results.filter((r) => r.status === 'skipped')
  const failed = results.filter((r) => r.status === 'failed')

  console.log(`✅ Successful: ${successful.length}`)
  console.log(`⏭️  Skipped: ${skipped.length}`)
  console.log(`❌ Failed: ${failed.length}`)
  console.log('')

  if (failed.length > 0) {
    console.log('Failed registrations:')
    for (const f of failed) {
      console.log(`   - ${f.actorId}: ${f.error}`)
    }
  }

  if (successful.length > 0) {
    console.log('')
    console.log('Registered FIDs:')
    for (const s of successful) {
      console.log(`   - ${s.actorId}: FID ${s.fid} (tx: ${s.txHash})`)
    }
  }
}

async function registerFID(
  npc: { actorId: string; userId: string; walletAddress: Address },
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  fundingAccount: ReturnType<typeof privateKeyToAccount>,
  recoveryAddress: Address,
  fidPrice: bigint,
): Promise<RegistrationResult> {
  const result: RegistrationResult = {
    actorId: npc.actorId,
    walletAddress: npc.walletAddress,
    fid: 0,
    status: 'failed',
  }

  try {
    console.log(`   🔄 Registering ${npc.actorId}...`)

    // First, fund the NPC wallet with enough ETH for gas + FID price
    const npcBalance = await publicClient.getBalance({
      address: npc.walletAddress,
    })
    const requiredBalance = fidPrice + parseEther('0.001') // Extra for gas

    if (npcBalance < requiredBalance) {
      const fundAmount = requiredBalance - npcBalance
      console.log(
        `      💸 Funding wallet with ${Number(fundAmount) / 1e18} ETH...`,
      )

      const fundTx = await walletClient.sendTransaction({
        to: npc.walletAddress,
        value: fundAmount,
      })

      await publicClient.waitForTransactionReceipt({ hash: fundTx })
    }

    // Register FID from NPC wallet
    // Note: In production, you'd use the NPC's private key from KMS
    // For now, we register from the funding wallet with NPC as recovery
    const { request } = await publicClient.simulateContract({
      address: FARCASTER_ID_REGISTRY,
      abi: ID_REGISTRY_ABI,
      functionName: 'register',
      args: [recoveryAddress],
      account: fundingAccount,
      value: fidPrice,
    })

    const txHash = await walletClient.writeContract(request)
    const _receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    })

    // Get the FID from the transaction logs
    // The FID is returned from the register function
    const fid = await publicClient.readContract({
      address: FARCASTER_ID_REGISTRY,
      abi: ID_REGISTRY_ABI,
      functionName: 'idOf',
      args: [fundingAccount.address], // The funding wallet now owns the FID
    })

    result.fid = Number(fid)
    result.txHash = txHash
    result.status = 'success'

    console.log(
      `      ✅ Registered FID ${result.fid} (tx: ${txHash.slice(0, 10)}...)`,
    )
  } catch (error) {
    result.status = 'failed'
    result.error = error instanceof Error ? error.message : String(error)
    console.log(`      ❌ Failed: ${result.error}`)
  }

  return result
}

main().catch(console.error)
