/**
 * Social Recovery
 *
 * Guardian-based key recovery using social connections.
 */

export interface Guardian {
  address: string
  name?: string
  addedAt: number
}

export interface SocialRecoveryConfig {
  /** Minimum guardians required to approve recovery */
  threshold: number
  /** Recovery delay in seconds */
  recoveryDelay?: number
}

/**
 * SocialRecovery manages guardian-based key recovery
 */
export class SocialRecovery {
  private guardians: Guardian[] = []

  // @ts-expect-error Reserved for future implementation
  constructor(private config: SocialRecoveryConfig) {}

  /**
   * Add a guardian
   */
  async addGuardian(address: string, name?: string): Promise<void> {
    this.guardians.push({
      address,
      name,
      addedAt: Date.now(),
    })
  }

  /**
   * Remove a guardian
   */
  async removeGuardian(address: string): Promise<void> {
    this.guardians = this.guardians.filter(
      (g) => g.address.toLowerCase() !== address.toLowerCase(),
    )
  }

  /**
   * Get all guardians
   */
  getGuardians(): Guardian[] {
    return [...this.guardians]
  }

  /**
   * Initiate recovery request
   */
  async initiateRecovery(
    _newOwner: string,
  ): Promise<{ recoveryId: string; requiredApprovals: number }> {
    // TODO: Implement on-chain recovery initiation
    throw new Error('SocialRecovery not yet implemented')
  }

  /**
   * Approve recovery as guardian
   */
  async approveRecovery(
    _recoveryId: string,
    _guardianSignature: string,
  ): Promise<{ approved: boolean; approvalsReceived: number }> {
    // TODO: Implement guardian approval
    throw new Error('SocialRecovery not yet implemented')
  }

  /**
   * Execute recovery after threshold approvals and delay
   */
  async executeRecovery(_recoveryId: string): Promise<{ success: boolean }> {
    // TODO: Implement recovery execution
    throw new Error('SocialRecovery not yet implemented')
  }
}
