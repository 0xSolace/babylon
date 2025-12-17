/**
 * Gas Estimator
 *
 * Estimates gas for various operation types.
 */

import { type Address, createPublicClient, type Hex, http } from 'viem';

export interface GasEstimate {
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  totalCost: bigint;
}

export interface EstimatorConfig {
  rpcUrl: string;
  chainId: number;
}

/**
 * Gas Estimator
 *
 * Provides gas estimates for transactions.
 */
export class GasEstimator {
  private config: EstimatorConfig;

  constructor(config: EstimatorConfig) {
    this.config = config;
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateTransaction(
    from: Address,
    to: Address,
    data: Hex,
    value = 0n
  ): Promise<GasEstimate> {
    const client = createPublicClient({
      transport: http(this.config.rpcUrl),
    });

    // Get gas estimate
    const gasLimit = await client.estimateGas({
      account: from,
      to,
      data,
      value,
    });

    // Get current gas price
    const feeData = await client.estimateFeesPerGas();
    const maxFeePerGas = feeData.maxFeePerGas ?? 0n;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 0n;

    const totalCost = gasLimit * maxFeePerGas;

    return {
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
      totalCost,
    };
  }

  /**
   * Estimate gas for a simple transfer
   */
  async estimateTransfer(
    _from: Address,
    _to: Address,
    _value: bigint
  ): Promise<GasEstimate> {
    const client = createPublicClient({
      transport: http(this.config.rpcUrl),
    });

    // Simple transfers use 21000 gas
    const gasLimit = 21000n;

    const feeData = await client.estimateFeesPerGas();
    const maxFeePerGas = feeData.maxFeePerGas ?? 0n;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 0n;

    const totalCost = gasLimit * maxFeePerGas;

    return {
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
      totalCost,
    };
  }

  /**
   * Estimate gas for a contract deployment
   */
  async estimateDeployment(from: Address, bytecode: Hex): Promise<GasEstimate> {
    const client = createPublicClient({
      transport: http(this.config.rpcUrl),
    });

    const gasLimit = await client.estimateGas({
      account: from,
      data: bytecode,
    });

    const feeData = await client.estimateFeesPerGas();
    const maxFeePerGas = feeData.maxFeePerGas ?? 0n;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 0n;

    const totalCost = gasLimit * maxFeePerGas;

    return {
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
      totalCost,
    };
  }

  /**
   * Get current gas prices
   */
  async getGasPrices(): Promise<{
    slow: bigint;
    standard: bigint;
    fast: bigint;
    instant: bigint;
  }> {
    const client = createPublicClient({
      transport: http(this.config.rpcUrl),
    });

    const gasPrice = await client.getGasPrice();

    return {
      slow: (gasPrice * 80n) / 100n, // 80% of current
      standard: gasPrice,
      fast: (gasPrice * 120n) / 100n, // 120% of current
      instant: (gasPrice * 150n) / 100n, // 150% of current
    };
  }

  /**
   * Check if an address has sufficient gas
   */
  async hasSufficientGas(
    address: Address,
    requiredGas: bigint
  ): Promise<boolean> {
    const client = createPublicClient({
      transport: http(this.config.rpcUrl),
    });

    const balance = await client.getBalance({ address });
    return balance >= requiredGas;
  }

  /**
   * Get recommended gas for common operations
   */
  getRecommendedGas(
    operation: 'transfer' | 'swap' | 'mint' | 'approve'
  ): bigint {
    const gasLimits: Record<typeof operation, bigint> = {
      transfer: 21_000n,
      swap: 200_000n,
      mint: 150_000n,
      approve: 50_000n,
    };

    return gasLimits[operation];
  }
}
