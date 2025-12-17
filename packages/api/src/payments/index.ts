/**
 * Payments Module
 *
 * - ERC-4337 Paymaster: Prepaid credit system for gas sponsorship
 * - x402: HTTP 402 micropayments for premium features
 */

// ERC-4337 Paymaster
export {
  type DepositResult,
  getPaymasterClient,
  initializePaymaster,
  isPaymasterAvailable,
  PaymasterClient,
  type PaymasterConfig,
  resetPaymasterClient,
  type SponsorResult,
  type UserCredits,
  type UserOperation,
} from './paymaster-client';

// x402 HTTP 402 Micropayments
export {
  BABYLON_PRICING,
  type BabylonPaymentType,
  getBabylonPaymentRequirement,
  getBabylonX402Recipient,
  isBabylonX402Enabled,
  verifyBabylonPayment,
} from './x402-client';
