/**
 * x402 Payment Protocol Integration
 *
 * HTTP 402 micropayments for premium features.
 * Used for DM priority, premium content, NPC interactions.
 *
 * @see https://x402.org
 */

import { logger } from '@babylon/shared';
import { verifyMessage } from 'ethers';
import type { Address } from 'viem';

export type X402Network =
  | 'sepolia'
  | 'base-sepolia'
  | 'ethereum'
  | 'base'
  | 'jeju'
  | 'jeju-testnet';

export interface X402PaymentHeader {
  scheme: string;
  network: string;
  payload: string;
  asset: string;
  amount: string;
}

export interface X402PaymentRequirement {
  x402Version: number;
  error: string;
  accepts: Array<{
    scheme: string;
    network: X402Network | string;
    maxAmountRequired: string;
    asset: Address;
    payTo: Address;
    resource: string;
    description: string;
  }>;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

/**
 * Babylon-specific payment types
 */
export type BabylonPaymentType =
  | 'dm_priority'
  | 'premium_content'
  | 'npc_interaction'
  | 'market_creation';

/**
 * Babylon payment pricing (in wei, assuming 18 decimals)
 */
export const BABYLON_PRICING = {
  dm_priority: 10000000000000n, // 0.00001 (priority DM to NPC)
  premium_content: 100000000000000n, // 0.0001 (access premium article)
  npc_interaction: 50000000000000n, // 0.00005 (direct NPC response)
  market_creation: 1000000000000000n, // 0.001 (create prediction market)
} as const;

/**
 * Get payment requirement for a Babylon feature
 */
export function getBabylonPaymentRequirement(
  paymentType: BabylonPaymentType,
  payTo: Address,
  resource: string
): X402PaymentRequirement {
  const priceWei = BABYLON_PRICING[paymentType];
  const descriptions: Record<BabylonPaymentType, string> = {
    dm_priority: 'Priority message delivery to NPC',
    premium_content: 'Access to premium content',
    npc_interaction: 'Direct NPC response',
    market_creation: 'Create new prediction market',
  };

  return {
    x402Version: 1,
    error: 'Payment required',
    accepts: [
      {
        scheme: 'exact',
        network: 'jeju',
        maxAmountRequired: priceWei.toString(),
        asset: ZERO_ADDRESS, // Native token or configured USDC
        payTo,
        resource,
        description: descriptions[paymentType],
      },
    ],
  };
}

/**
 * Check if x402 payments are enabled for Babylon
 */
export function isBabylonX402Enabled(): boolean {
  return process.env.BABYLON_X402_ENABLED === 'true';
}

/**
 * Get Babylon's x402 recipient address
 */
export function getBabylonX402Recipient(): Address | null {
  const addr = process.env.BABYLON_X402_RECIPIENT as Address | undefined;
  if (!addr || addr === ZERO_ADDRESS) {
    return null;
  }
  return addr;
}

/**
 * Parse x402 payment header
 */
export function parseX402Header(header: string): X402PaymentHeader | null {
  const parts: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [key, value] = part.split('=');
    if (key && value) parts[key.trim()] = value.trim();
  }
  if (!parts.scheme || !parts.network || !parts.payload) return null;
  return {
    scheme: parts.scheme,
    network: parts.network,
    payload: parts.payload,
    asset: parts.asset || ZERO_ADDRESS,
    amount: parts.amount || '0',
  };
}

/**
 * Verify x402 payment signature
 */
export function verifyX402Signature(
  payment: X402PaymentHeader,
  providerAddress: Address,
  expectedUserAddress: Address
): boolean {
  if (payment.scheme !== 'exact') return false;
  const message = `x402:${payment.network}:${providerAddress}:${payment.amount}`;
  const recovered = verifyMessage(message, payment.payload);
  return recovered.toLowerCase() === expectedUserAddress.toLowerCase();
}

/**
 * Verify x402 payment for Babylon feature
 */
export function verifyBabylonPayment(
  paymentHeader: string,
  paymentType: BabylonPaymentType,
  userAddress: Address
): { valid: boolean; error?: string } {
  const recipient = getBabylonX402Recipient();
  if (!recipient) {
    return { valid: false, error: 'x402 payments not configured' };
  }

  const payment = parseX402Header(paymentHeader);
  if (!payment) {
    return { valid: false, error: 'Invalid x402 payment header' };
  }

  const priceWei = BABYLON_PRICING[paymentType];
  if (BigInt(payment.amount) < priceWei) {
    return { valid: false, error: 'Insufficient payment amount' };
  }

  const isValid = verifyX402Signature(payment, recipient, userAddress);
  if (!isValid) {
    return { valid: false, error: 'Invalid payment signature' };
  }

  logger.info(
    'x402 payment verified',
    { paymentType, userAddress, amount: payment.amount },
    'X402'
  );
  return { valid: true };
}

/**
 * Generate x402 402 response for payment required
 */
export function generate402Response(
  paymentType: BabylonPaymentType,
  resource: string
): Response {
  const recipient = getBabylonX402Recipient();
  if (!recipient) {
    return new Response(JSON.stringify({ error: 'x402 not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const requirement = getBabylonPaymentRequirement(
    paymentType,
    recipient,
    resource
  );

  return new Response(JSON.stringify(requirement), {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Required': 'true',
    },
  });
}
