/**
 * Payments Module
 *
 * Use @jejunetwork/auth paymaster or x402 modules instead.
 */

export interface UserOperation {
  sender: string
  nonce: bigint
  callData: string
}

export class PaymasterClient {
  async getCredits(_userId: string): Promise<null> {
    return null
  }
}
