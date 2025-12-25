/**
 * Viem client utilities for properly typed contract interactions.
 *
 * These utilities work around viem 2.43+ strict EIP-7702 type requirements
 * that make authorizationList appear required when chain types are unions.
 *
 * Solution: Use wrapper functions that accept simple parameters and handle
 * the type assertions internally.
 */

import {
  type Abi,
  type Account,
  type Address,
  type Chain,
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type Transport,
  type WalletClient,
} from 'viem'
import type { hardhat } from 'viem/chains'

/**
 * Babylon's chain type - uses hardhat for type inference
 * but works with any EVM chain at runtime.
 */
export type BabylonChain = typeof hardhat

/**
 * Properly typed public client for Babylon.
 */
export type BabylonPublicClient = PublicClient<Transport, BabylonChain>

/**
 * Properly typed wallet client for Babylon.
 */
export type BabylonWalletClient = WalletClient<Transport, BabylonChain, Account>

/**
 * Create a public client with proper chain typing for Babylon.
 *
 * Uses hardhat chain type for TypeScript inference but accepts any
 * chain at runtime. This enables full type inference for contract methods.
 *
 * The generic TChain ensures the returned client's chain type matches the input.
 *
 * @param options - Client options (chain is required, rpcUrl is optional)
 * @returns A properly typed public client
 */
export function createBabylonPublicClient<TChain extends Chain>(options: {
  chain: TChain
  rpcUrl?: string
}): PublicClient<Transport, TChain> {
  // Cast through unknown to bypass viem 2.43+'s strict account type inference.
  // Viem adds a stub account object to public clients, but the type says undefined.
  return createPublicClient({
    chain: options.chain,
    transport: http(options.rpcUrl),
  }) as unknown as PublicClient<Transport, TChain>
}

/**
 * Create a wallet client with proper chain typing for Babylon.
 *
 * Returns WalletClient with Account type to work around viem's
 * strict generic type variance requirements with ParseAccount.
 *
 * @param options - Client options (account and chain are required)
 * @returns A properly typed wallet client
 */
export function createBabylonWalletClient<TChain extends Chain>(options: {
  account: Account
  chain: TChain
  rpcUrl?: string
}): WalletClient<Transport, TChain, Account> {
  // Cast through unknown to bypass viem's strict ParseAccount variance.
  // The returned client is correctly typed for contract interactions.
  return createWalletClient({
    account: options.account,
    chain: options.chain,
    transport: http(options.rpcUrl),
  }) as unknown as WalletClient<Transport, TChain, Account>
}

/**
 * Parameters for readContract - uses simple types to avoid viem's
 * strict EIP-7702 type checking.
 */
export interface SafeReadContractParams {
  address: Address
  abi: Abi | readonly unknown[]
  functionName: string
  args?: readonly unknown[]
}

/**
 * Parameters for writeContract - uses simple types to avoid viem's
 * strict EIP-7702 type checking.
 */
export interface SafeWriteContractParams {
  address: Address
  abi: Abi | readonly unknown[]
  functionName: string
  args?: readonly unknown[]
  chain?: Chain
  account?: Account | Address
  value?: bigint
}

/**
 * Parameters for safeSendTransaction.
 */
export interface SafeSendTransactionParams {
  to: Address
  value?: bigint
  data?: `0x${string}`
}

// Internal type to represent any client with readContract
type AnyReadClient = {
  readContract: (...args: never[]) => Promise<unknown>
}

// Internal type to represent any client with writeContract
type AnyWriteClient = {
  writeContract: (...args: never[]) => Promise<`0x${string}`>
}

// Internal type to represent any client with sendTransaction
type AnySendClient = {
  sendTransaction: (...args: never[]) => Promise<`0x${string}`>
}

/**
 * Type-safe readContract wrapper for viem 2.43+
 *
 * This function wraps client.readContract with loose enough types to work
 * around the EIP-7702 authorizationList requirement in viem 2.43+.
 *
 * Usage:
 * ```ts
 * const result = await readContract(client, {
 *   address: contractAddress,
 *   abi: CONTRACT_ABI,
 *   functionName: 'balanceOf',
 *   args: [walletAddress],
 * });
 * ```
 *
 * @param client - A public client with readContract method
 * @param params - Contract read parameters
 * @returns The contract read result (cast to your expected type)
 */
export async function readContract<TReturn = unknown>(
  client: AnyReadClient,
  params: SafeReadContractParams,
): Promise<TReturn> {
  // Use Function.call to bypass TypeScript's strict parameter checking
  const readFn = client.readContract as (
    params: SafeReadContractParams,
  ) => Promise<unknown>
  const result = await readFn(params)
  return result as TReturn
}

/**
 * Type-safe writeContract wrapper for viem 2.43+
 *
 * This function wraps client.writeContract with loose enough types to work
 * around the EIP-7702 authorizationList requirement in viem 2.43+.
 *
 * Usage:
 * ```ts
 * const hash = await writeContract(client, {
 *   address: contractAddress,
 *   abi: CONTRACT_ABI,
 *   functionName: 'transfer',
 *   args: [recipient, amount],
 * });
 * ```
 *
 * @param client - A wallet client with writeContract method
 * @param params - Contract write parameters
 * @returns The transaction hash
 */
export async function writeContract(
  client: AnyWriteClient,
  params: SafeWriteContractParams,
): Promise<`0x${string}`> {
  const writeFn = client.writeContract as (
    params: SafeWriteContractParams,
  ) => Promise<`0x${string}`>
  return writeFn(params)
}

/**
 * Type-safe sendTransaction wrapper for viem 2.43+
 *
 * @param client - A wallet client with sendTransaction method
 * @param params - Transaction parameters
 * @returns The transaction hash
 */
export async function safeSendTransaction(
  client: AnySendClient,
  params: SafeSendTransactionParams,
): Promise<`0x${string}`> {
  const sendFn = client.sendTransaction as (
    params: SafeSendTransactionParams,
  ) => Promise<`0x${string}`>
  return sendFn(params)
}

export type { Chain, Account, PublicClient, WalletClient, Abi, Address }
