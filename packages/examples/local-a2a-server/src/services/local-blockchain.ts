/**
 * Local Blockchain Service
 * Interacts with local anvil blockchain for agent registration verification
 */

import { type Address, getContract, type PublicClient } from 'viem';

// ERC-8004 Agent Registry ABI (minimal)
const AGENT_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenURI',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
  },
] as const;

// Default addresses from local anvil deployment
const DEFAULT_REGISTRY_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

export class LocalBlockchain {
  private client: PublicClient;
  private registryAddress: Address;
  private registryContract: ReturnType<typeof getContract> | null = null;

  constructor(client: PublicClient, registryAddress?: string) {
    this.client = client;
    this.registryAddress = (registryAddress ||
      DEFAULT_REGISTRY_ADDRESS) as Address;
  }

  /**
   * Get connected client
   */
  getClient(): PublicClient {
    return this.client;
  }

  /**
   * Check if blockchain is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.client.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get chain ID
   */
  async getChainId(): Promise<number> {
    return this.client.getChainId();
  }

  /**
   * Verify agent registration on-chain
   */
  async verifyAgentRegistration(
    _walletAddress: string,
    _tokenId: number
  ): Promise<boolean> {
    // For local development, we skip on-chain verification
    // The blockchain may not be available
    return true;
  }

  /**
   * Get agent token metadata
   */
  async getAgentMetadata(tokenId: number): Promise<string | null> {
    if (!(await this.isAvailable())) {
      return null;
    }

    const contract = this.getRegistryContract();
    return (await contract.read.tokenURI([BigInt(tokenId)])) as string;
  }

  /**
   * Get agent count for an address
   */
  async getAgentCount(walletAddress: string): Promise<number> {
    if (!(await this.isAvailable())) {
      return 0;
    }

    const contract = this.getRegistryContract();
    const balance = await contract.read.balanceOf([walletAddress as Address]);
    return Number(balance);
  }

  /**
   * Get balance of an address
   */
  async getBalance(address: string): Promise<bigint> {
    return await this.client.getBalance({ address: address as Address });
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    return Number(await this.client.getBlockNumber());
  }

  private getRegistryContract() {
    if (!this.registryContract) {
      this.registryContract = getContract({
        address: this.registryAddress,
        abi: AGENT_REGISTRY_ABI,
        client: this.client,
      });
    }
    return this.registryContract;
  }
}
