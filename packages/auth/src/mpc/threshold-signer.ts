/**
 * Threshold Signer
 *
 * Higher-level abstraction for threshold signing operations.
 * Wraps MPCClient with convenient methods for common signing patterns.
 */

import { type Address, type Hex, keccak256, toBytes } from 'viem';
import type { DID } from '../types/index';
import { MPCClient, type MPCClientConfig } from './client';

export interface TypedDataDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

export interface SignatureResult {
  signature: Hex;
  signerAddress: Address;
  recoveryId: number;
}

/**
 * Threshold Signer
 *
 * Provides a clean interface for signing operations using the MPC network.
 */
export class ThresholdSigner {
  private client: MPCClient;
  private userId: DID;
  private walletAddress: Address | null = null;

  constructor(userId: DID, config?: Partial<MPCClientConfig>) {
    this.userId = userId;
    this.client = new MPCClient(config);
  }

  /**
   * Initialize the signer and derive wallet address
   */
  async initialize(): Promise<Address> {
    await this.client.initialize();

    // Get or derive wallet address
    const keyResult = await this.client.generateKey(this.userId, {
      type: 'wallet',
      proof: '0x', // No proof needed for existing user
      identifier: this.userId,
    });

    if (!keyResult.success || !keyResult.walletAddress) {
      throw new Error(`Failed to initialize signer: ${keyResult.error}`);
    }

    this.walletAddress = keyResult.walletAddress;
    return this.walletAddress;
  }

  /**
   * Get the wallet address
   */
  getAddress(): Address {
    if (!this.walletAddress) {
      throw new Error('Signer not initialized');
    }
    return this.walletAddress;
  }

  /**
   * Sign a personal message (EIP-191)
   */
  async signMessage(message: string): Promise<SignatureResult> {
    if (!this.walletAddress) {
      throw new Error('Signer not initialized');
    }

    // Hash the message with Ethereum prefix
    const prefix = `\x19Ethereum Signed Message:\n${message.length}`;
    const prefixedMessage = `${prefix}${message}`;
    const messageHash = keccak256(toBytes(prefixedMessage));

    const result = await this.client.sign(this.userId, messageHash, 'message');

    if (!result.success || !result.signature) {
      throw new Error(`Signing failed: ${result.error}`);
    }

    return {
      signature: result.signature.signature,
      signerAddress: this.walletAddress,
      recoveryId: result.signature.recoveryId,
    };
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<{ name: string; type: string }>>,
    primaryType: string,
    message: Record<string, unknown>
  ): Promise<SignatureResult> {
    if (!this.walletAddress) {
      throw new Error('Signer not initialized');
    }

    // Compute EIP-712 hash (simplified - production would use proper encoding)
    const domainSeparator = this.hashDomain(domain);
    const structHash = this.hashStruct(primaryType, message, types);
    const digest = keccak256(
      toBytes(`0x1901${domainSeparator.slice(2)}${structHash.slice(2)}`)
    );

    const result = await this.client.sign(this.userId, digest, 'typedData');

    if (!result.success || !result.signature) {
      throw new Error(`Signing failed: ${result.error}`);
    }

    return {
      signature: result.signature.signature,
      signerAddress: this.walletAddress,
      recoveryId: result.signature.recoveryId,
    };
  }

  /**
   * Sign a transaction hash
   */
  async signTransactionHash(txHash: Hex): Promise<SignatureResult> {
    if (!this.walletAddress) {
      throw new Error('Signer not initialized');
    }

    const result = await this.client.sign(this.userId, txHash, 'transaction');

    if (!result.success || !result.signature) {
      throw new Error(`Signing failed: ${result.error}`);
    }

    return {
      signature: result.signature.signature,
      signerAddress: this.walletAddress,
      recoveryId: result.signature.recoveryId,
    };
  }

  /**
   * Hash EIP-712 domain
   */
  private hashDomain(domain: TypedDataDomain): Hex {
    const typeHash = keccak256(
      toBytes(
        'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
      )
    );

    const encoded = toBytes(
      typeHash +
        keccak256(toBytes(domain.name)).slice(2) +
        keccak256(toBytes(domain.version)).slice(2) +
        domain.chainId.toString(16).padStart(64, '0') +
        domain.verifyingContract.slice(2).padStart(64, '0')
    );

    return keccak256(encoded);
  }

  /**
   * Hash EIP-712 struct (simplified)
   */
  private hashStruct(
    primaryType: string,
    message: Record<string, unknown>,
    _types: Record<string, Array<{ name: string; type: string }>>
  ): Hex {
    // Simplified: just hash the JSON representation
    // Production would use proper ABI encoding
    const messageStr = JSON.stringify({ type: primaryType, ...message });
    return keccak256(toBytes(messageStr));
  }

  /**
   * Get network status
   */
  async getNetworkStatus() {
    return this.client.getNetworkStatus();
  }
}
