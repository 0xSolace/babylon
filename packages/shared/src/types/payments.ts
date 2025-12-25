/**
 * Payment Type Definitions
 *
 * Interfaces for x402 micropayment system
 */

/**
 * Payment verification parameters
 */
export interface PaymentVerificationParams {
  requestId: string
  txHash: string
  from: string
  to: string
  amount: string
  timestamp: number
  confirmed: boolean
}

/**
 * Payment verification result
 */
export interface PaymentVerificationResult {
  verified: boolean
  error?: string
}
