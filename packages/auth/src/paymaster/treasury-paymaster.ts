/**
 * Treasury Paymaster - gas sponsorship from Babylon Treasury for users without gas.
 */

import {
  type Address,
  createPublicClient,
  createWalletClient,
  type Hex,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type {
  DID,
  PaymasterData,
  PaymasterDecision,
  UserOperation,
} from '../types/index';
import type {
  SponsorshipPolicy,
  SponsorshipResult,
  UserSponsorshipState,
} from './types';

export interface PaymasterConfig {
  treasuryAddress: Address;
  operatorPrivateKey: Hex;
  rpcUrl: string;
  chainId: number;
  policy: Partial<SponsorshipPolicy>;
}

const DEFAULT_POLICY: SponsorshipPolicy = {
  maxGasPerTx: 500_000n,
  maxGasPerUserPerDay: 5_000_000n,
  whitelistedContracts: [],
  blacklistedContracts: [],
  newUsersOnly: false,
  minReputation: 0,
};

const TREASURY_ABI = [
  {
    inputs: [],
    name: 'getBalance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'isOperatorActive',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export class TreasuryPaymaster {
  private config: PaymasterConfig;
  private policy: SponsorshipPolicy;
  private userStates: Map<DID, UserSponsorshipState> = new Map();

  constructor(config: PaymasterConfig) {
    this.config = config;
    this.policy = { ...DEFAULT_POLICY, ...config.policy };
  }

  async shouldSponsor(
    userId: DID,
    userOp: UserOperation
  ): Promise<PaymasterDecision> {
    const policyCheck = this.checkPolicy(userId, userOp);
    if (!policyCheck.sponsor) return policyCheck;

    const hasGas = await this.userHasGas(userOp.sender);
    if (hasGas) return { sponsor: false, reason: 'User has sufficient gas' };

    const treasuryBalance = await this.getTreasuryBalance();
    const estimatedGas = await this.estimateGas(userOp);
    if (treasuryBalance < estimatedGas)
      return { sponsor: false, reason: 'Treasury balance insufficient' };

    return {
      sponsor: true,
      reason: 'User eligible for sponsorship',
      maxGas: this.policy.maxGasPerTx,
      validUntil: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  async createPaymasterData(
    userId: DID,
    userOp: UserOperation
  ): Promise<SponsorshipResult> {
    const decision = await this.shouldSponsor(userId, userOp);
    if (!decision.sponsor) return { sponsored: false, error: decision.reason };

    const account = privateKeyToAccount(this.config.operatorPrivateKey);
    const validUntil =
      decision.validUntil ?? Math.floor(Date.now() / 1000) + 3600;
    const validAfter = Math.floor(Date.now() / 1000);

    const paymasterData: PaymasterData = {
      paymaster: account.address,
      paymasterData: '0x' as Hex,
      validUntil,
      validAfter,
    };

    this.updateUserState(userId, decision.maxGas ?? 0n);
    return { sponsored: true, paymasterData, gasLimit: decision.maxGas };
  }

  private checkPolicy(userId: DID, userOp: UserOperation): PaymasterDecision {
    const targetContract = userOp.sender;

    if (
      this.policy.blacklistedContracts.some(
        (c) => c.toLowerCase() === targetContract.toLowerCase()
      )
    ) {
      return { sponsor: false, reason: 'Contract is blacklisted' };
    }

    if (
      this.policy.whitelistedContracts.length > 0 &&
      !this.policy.whitelistedContracts.some(
        (c) => c.toLowerCase() === targetContract.toLowerCase()
      )
    ) {
      return { sponsor: false, reason: 'Contract is not whitelisted' };
    }

    const userState = this.getUserState(userId);
    if (userState.gasUsedToday >= this.policy.maxGasPerUserPerDay) {
      return { sponsor: false, reason: 'Daily gas limit exceeded' };
    }

    return {
      sponsor: true,
      reason: 'Policy check passed',
      maxGas: this.policy.maxGasPerTx,
    };
  }

  private async userHasGas(address: Address): Promise<boolean> {
    const client = createPublicClient({ transport: http(this.config.rpcUrl) });
    const balance = await client.getBalance({ address });
    return balance > 1_000_000_000_000_000n;
  }

  private async getTreasuryBalance(): Promise<bigint> {
    const client = createPublicClient({ transport: http(this.config.rpcUrl) });
    return client.readContract({
      address: this.config.treasuryAddress,
      abi: TREASURY_ABI,
      functionName: 'getBalance',
    });
  }

  private async estimateGas(userOp: UserOperation): Promise<bigint> {
    const totalGas =
      userOp.callGasLimit +
      userOp.verificationGasLimit +
      userOp.preVerificationGas;
    return totalGas * userOp.maxFeePerGas;
  }

  private getUserState(userId: DID): UserSponsorshipState {
    let state = this.userStates.get(userId);
    if (!state) {
      state = {
        userId,
        gasUsedToday: 0n,
        lastReset: Date.now(),
        totalGasSponsored: 0n,
        transactionCount: 0,
      };
      this.userStates.set(userId, state);
    }

    const oneDayMs = 24 * 60 * 60 * 1000;
    if (Date.now() - state.lastReset > oneDayMs) {
      state.gasUsedToday = 0n;
      state.lastReset = Date.now();
    }
    return state;
  }

  private updateUserState(userId: DID, gasUsed: bigint): void {
    const state = this.getUserState(userId);
    state.gasUsedToday += gasUsed;
    state.totalGasSponsored += gasUsed;
    state.transactionCount += 1;
  }

  async fundUser(userAddress: Address, amount: bigint): Promise<Hex> {
    const account = privateKeyToAccount(this.config.operatorPrivateKey);
    const { baseSepolia, foundry } = await import('viem/chains');

    const client = createWalletClient({
      account,
      chain: this.config.chainId === 31337 ? foundry : baseSepolia,
      transport: http(this.config.rpcUrl),
    });

    await client.writeContract({
      address: this.config.treasuryAddress,
      abi: TREASURY_ABI,
      functionName: 'withdraw',
      args: [amount],
    });
    return client.sendTransaction({ to: userAddress, value: amount });
  }

  getStats(): {
    totalUsers: number;
    totalTransactions: number;
    totalGasSponsored: bigint;
  } {
    let totalTransactions = 0;
    let totalGasSponsored = 0n;
    for (const state of this.userStates.values()) {
      totalTransactions += state.transactionCount;
      totalGasSponsored += state.totalGasSponsored;
    }
    return {
      totalUsers: this.userStates.size,
      totalTransactions,
      totalGasSponsored,
    };
  }
}
