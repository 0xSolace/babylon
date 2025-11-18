/**
 * Payment Type Definitions
 *
 * Complete interfaces for x402 micropayment system
 */

import type { JsonValue } from './common';

/**
 * Payment request creation parameters
 */
export type PaymentRequestParams = {
  from: string;
  to: string;
  amount: string; // in wei
  service: string;
  metadata?: Record<string, JsonValue>;
};

/**
 * Payment request result from creation
 */
export type PaymentRequestCreateResult = {
  requestId: string;
  amount: string;
  expiresAt: number;
};

/**
 * Payment verification parameters
 */
export type PaymentVerificationParams = {
  requestId: string;
  txHash: string;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
  confirmed: boolean;
};

/**
 * Payment verification result
 */
export type PaymentVerificationResult = {
  verified: boolean;
  error?: string;
};

/**
 * Payment status information
 */
export type PaymentStatus = {
  requestId: string;
  status: 'pending' | 'verified' | 'expired' | 'failed';
  amount: string;
  from: string;
  to: string;
  createdAt: number;
  expiresAt: number;
  verifiedAt?: number;
  txHash?: string;
};

/**
 * Payment receipt information
 */
export type PaymentReceiptInfo = {
  requestId: string;
  txHash: string;
  verified: boolean;
  verifiedAt?: number;
  error?: string;
};
