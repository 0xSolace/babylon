/**
 * MPC Types
 *
 * Types specific to MPC network operations.
 */

import type { Address, Hex } from 'viem'
import type { DID } from '../types/index'

export interface MPCClientConfig {
  /** MPC network endpoints (at least 2 for redundancy) */
  endpoints: string[]
  /** Network identifier (e.g., 'jeju-testnet', 'jeju-mainnet') */
  networkId: string
  /** Threshold for operations (e.g., 2 of 3) */
  threshold: number
  /** Request timeout in ms */
  timeout: number
  /** Whether to use dev mode (simulated TEE) */
  devMode: boolean
}

export interface SigningRequest {
  /** User's DID */
  userId: DID
  /** Message to sign (hex-encoded) */
  message: Hex
  /** Type of signature */
  signatureType: 'message' | 'transaction' | 'typedData'
  /** Optional: EIP-712 domain for typed data */
  domain?: EIP712Domain
  /** Request timestamp */
  timestamp: number
  /** Request nonce */
  nonce: Hex
}

export interface EIP712Domain {
  name: string
  version: string
  chainId: number
  verifyingContract: Address
}

export interface ThresholdSignatureResult {
  /** The signature bytes */
  signature: Hex
  /** Which nodes participated */
  participants: string[]
  /** Threshold used (e.g., 2 of 3) */
  threshold: number
  /** Total nodes in network */
  totalNodes: number
  /** Recovery ID for signature */
  recoveryId: number
}

export interface SigningResponse {
  /** Whether signing succeeded */
  success: boolean
  /** The threshold signature */
  signature?: ThresholdSignatureResult
  /** Error message if failed */
  error?: string
  /** Participating nodes */
  participants?: string[]
}

export interface KeyGenRequest {
  /** User's DID to generate key for */
  userId: DID
  /** Auth proof that user owns this DID */
  authProof: AuthProofData
  /** Request timestamp */
  timestamp: number
}

export interface AuthProofData {
  /** Type of auth */
  type: 'email' | 'wallet' | 'farcaster' | 'twitter' | 'discord'
  /** Proof data (signature, token, etc.) */
  proof: Hex | string
  /** Identifier (email, address, username) */
  identifier: string
}

export interface KeyGenResponse {
  /** Whether key generation succeeded */
  success: boolean
  /** User's new wallet address */
  walletAddress?: Address
  /** Public key */
  publicKey?: Hex
  /** Error message if failed */
  error?: string
}

export interface NodeStatus {
  nodeId: string
  healthy: boolean
  latencyMs: number
  attestation: {
    valid: boolean
    isSimulated: boolean
    mrEnclave: Hex
  }
}

export interface NetworkStatus {
  /** Whether network is operational */
  operational: boolean
  /** Number of healthy nodes */
  healthyNodes: number
  /** Total nodes in network */
  totalNodes: number
  /** Whether threshold is met */
  thresholdMet: boolean
  /** Individual node statuses */
  nodes: NodeStatus[]
}
