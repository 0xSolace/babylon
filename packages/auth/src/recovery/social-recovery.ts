/**
 * Social Recovery - guardian-based account recovery requiring M-of-N approvals.
 */

import { isHexAddress } from '@babylon/shared'
import { getMPCCoordinator, type MPCCoordinatorConfig } from '@jejunetwork/kms'
import { type Address, type Hex, keccak256, toBytes, verifyMessage } from 'viem'
import type { DID, SocialRecoveryProof } from '../types/index'

export interface Guardian {
  address: Address
  addedAt: number
  label?: string
}

export interface RecoveryRequest {
  userId: DID
  requestHash: Hex
  newDevicePublicKey: Hex
  createdAt: number
  expiresAt: number
  approvals: Address[]
}

export class SocialRecovery {
  private guardians: Map<DID, Guardian[]> = new Map()
  private pendingRecoveries: Map<Hex, RecoveryRequest> = new Map()
  private mpcCoordinator: ReturnType<typeof getMPCCoordinator>
  private threshold: number

  constructor(mpcConfig?: Partial<MPCCoordinatorConfig>, threshold = 2) {
    this.mpcCoordinator = getMPCCoordinator(mpcConfig)
    this.threshold = threshold
  }

  async initialize(): Promise<void> {
    // MPC coordinator is already initialized via singleton
  }

  async addGuardian(
    userId: DID,
    guardianAddress: Address,
    ownerSignature: Hex,
    label?: string,
  ): Promise<Guardian> {
    const message = this.getOwnerActionMessage(
      userId,
      'add-guardian',
      guardianAddress,
    )
    const ownerAddress = this.extractAddressFromDID(userId)

    const isValid = await verifyMessage({
      address: ownerAddress,
      message,
      signature: ownerSignature,
    })
    if (!isValid) throw new Error('Invalid owner signature')

    const guardian: Guardian = {
      address: guardianAddress,
      addedAt: Date.now(),
      label,
    }
    const existing = this.guardians.get(userId) ?? []

    if (
      existing.some(
        (g) => g.address.toLowerCase() === guardianAddress.toLowerCase(),
      )
    ) {
      throw new Error('Guardian already added')
    }

    existing.push(guardian)
    this.guardians.set(userId, existing)
    return guardian
  }

  async removeGuardian(
    userId: DID,
    guardianAddress: Address,
    ownerSignature: Hex,
  ): Promise<void> {
    const message = this.getOwnerActionMessage(
      userId,
      'remove-guardian',
      guardianAddress,
    )
    const ownerAddress = this.extractAddressFromDID(userId)

    const isValid = await verifyMessage({
      address: ownerAddress,
      message,
      signature: ownerSignature,
    })
    if (!isValid) throw new Error('Invalid owner signature')

    const existing = this.guardians.get(userId) ?? []
    const filtered = existing.filter(
      (g) => g.address.toLowerCase() !== guardianAddress.toLowerCase(),
    )
    if (filtered.length === existing.length)
      throw new Error('Guardian not found')

    this.guardians.set(userId, filtered)
  }

  async getGuardians(userId: DID): Promise<Guardian[]> {
    return this.guardians.get(userId) ?? []
  }

  async initiateRecovery(
    userId: DID,
    newDevicePublicKey: Hex,
  ): Promise<RecoveryRequest> {
    const guardians = await this.getGuardians(userId)
    if (guardians.length < this.threshold) {
      throw new Error(
        `Insufficient guardians: ${guardians.length}/${this.threshold} required`,
      )
    }

    const requestHash = keccak256(
      toBytes(`${userId}:${newDevicePublicKey}:${Date.now()}`),
    )
    const request: RecoveryRequest = {
      userId,
      requestHash,
      newDevicePublicKey,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      approvals: [],
    }

    this.pendingRecoveries.set(requestHash, request)
    return request
  }

  async approveRecovery(
    requestHash: Hex,
    guardianSignature: Hex,
    guardianAddress: Address,
  ): Promise<{ approved: boolean; total: number; needed: number }> {
    const request = this.pendingRecoveries.get(requestHash)
    if (!request) throw new Error('Recovery request not found')
    if (Date.now() > request.expiresAt)
      throw new Error('Recovery request expired')

    const guardians = await this.getGuardians(request.userId)
    if (
      !guardians.some(
        (g) => g.address.toLowerCase() === guardianAddress.toLowerCase(),
      )
    ) {
      throw new Error('Not a guardian for this account')
    }

    const message = `Approve recovery ${requestHash}`
    const isValid = await verifyMessage({
      address: guardianAddress,
      message,
      signature: guardianSignature,
    })
    if (!isValid) throw new Error('Invalid guardian signature')
    if (request.approvals.includes(guardianAddress))
      throw new Error('Guardian already approved')

    request.approvals.push(guardianAddress)
    return {
      approved: request.approvals.length >= this.threshold,
      total: request.approvals.length,
      needed: this.threshold,
    }
  }

  async verifyRecoveryRequest(
    userId: DID,
    proof: SocialRecoveryProof,
  ): Promise<boolean> {
    if (proof.guardians.length < this.threshold) return false
    if (proof.signatures.length !== proof.guardians.length) return false

    const userGuardians = await this.getGuardians(userId)
    for (const guardian of proof.guardians) {
      if (
        !userGuardians.some(
          (g) => g.address.toLowerCase() === guardian.toLowerCase(),
        )
      ) {
        return false
      }
    }

    const message = `Approve recovery ${proof.requestHash}`
    for (let i = 0; i < proof.guardians.length; i++) {
      const guardianAddress = proof.guardians[i]
      const signature = proof.signatures[i]
      if (!guardianAddress || !signature) return false

      const isValid = await verifyMessage({
        address: guardianAddress,
        message,
        signature,
      })
      if (!isValid) return false
    }

    return true
  }

  async executeRecovery(
    userId: DID,
    proof: SocialRecoveryProof,
  ): Promise<{ success: boolean; walletAddress?: Address; error?: string }> {
    const isValid = await this.verifyRecoveryRequest(userId, proof)
    if (!isValid) return { success: false, error: 'Invalid recovery proof' }

    const key = this.mpcCoordinator.getKey(userId)
    if (!key) {
      return { success: false, error: 'Key not found in MPC coordinator' }
    }

    this.pendingRecoveries.delete(proof.requestHash)
    return { success: true, walletAddress: key.address }
  }

  async getPendingRecoveries(userId: DID): Promise<RecoveryRequest[]> {
    return Array.from(this.pendingRecoveries.values()).filter(
      (r) => r.userId === userId && Date.now() < r.expiresAt,
    )
  }

  async cancelRecovery(requestHash: Hex, ownerSignature: Hex): Promise<void> {
    const request = this.pendingRecoveries.get(requestHash)
    if (!request) throw new Error('Recovery request not found')

    const message = `Cancel recovery ${requestHash}`
    const ownerAddress = this.extractAddressFromDID(request.userId)
    const isValid = await verifyMessage({
      address: ownerAddress,
      message,
      signature: ownerSignature,
    })
    if (!isValid) throw new Error('Invalid owner signature')

    this.pendingRecoveries.delete(requestHash)
  }

  getOwnerActionMessage(userId: DID, action: string, target?: Address): string {
    return target
      ? `Authorize ${action} ${target} for ${userId}`
      : `Authorize ${action} for ${userId}`
  }

  private extractAddressFromDID(did: DID): Address {
    const identifier = did.split(':')[3]
    if (!identifier || !isHexAddress(identifier)) {
      throw new Error(`Invalid DID format: ${did}`)
    }
    return identifier
  }
}
