/**
 * Oracle Service Types
 *
 * Type definitions for blockchain oracle integration
 */

export type GameCommitment = {
  questionId: string;
  questionNumber: number;
  question: string;
  category: string;
  outcome: boolean;
  salt: string;
  commitment: string; // keccak256(abi.encode(outcome, salt))
  createdAt: Date;
};

export type CommitTransactionResult = {
  sessionId: string;
  questionId: string;
  commitment: string;
  txHash: string;
  blockNumber?: number;
  gasUsed?: string;
};

export type RevealTransactionResult = {
  sessionId: string;
  questionId: string;
  outcome: boolean;
  txHash: string;
  blockNumber?: number;
  gasUsed?: string;
};

export type BatchCommitResult = {
  successful: CommitTransactionResult[];
  failed: Array<{ questionId: string; error: string }>;
};

export type BatchRevealResult = {
  successful: RevealTransactionResult[];
  failed: Array<{ questionId: string; error: string }>;
};

export type OracleConfig = {
  oracleAddress: string;
  privateKey: string;
  rpcUrl: string;
  chainId: number;
  gasMultiplier?: number; // Multiply estimated gas by this (default: 1.2)
  maxGasPrice?: bigint; // Maximum gas price willing to pay
  confirmations?: number; // Wait for N confirmations (default: 1)
};

export type StoredCommitment = {
  questionId: string;
  sessionId: string;
  salt: string;
  commitment: string;
  createdAt: Date;
};

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

export type OracleTransaction = {
  id: string;
  questionId?: string;
  txType: 'commit' | 'reveal' | 'resolve';
  txHash: string;
  status: TransactionStatus;
  blockNumber?: number;
  gasUsed?: bigint;
  gasPrice?: bigint;
  error?: string;
  retryCount: number;
  createdAt: Date;
  confirmedAt?: Date;
};
