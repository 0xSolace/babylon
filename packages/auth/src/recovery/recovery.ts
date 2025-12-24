/**
 * Recovery Manager
 *
 * Manages account recovery using multiple methods:
 * - Backup password
 * - OAuth re-authentication
 * - Social recovery (guardians)
 */

import { getMPCCoordinator, type MPCCoordinatorConfig } from '@jejunetwork/kms'
import {
  DiscordProvider,
  FarcasterProvider,
  type OAuthConfig,
  TwitterProvider,
} from '@jejunetwork/oauth3'
import type { Address } from 'viem'
import {
  EMPTY_ADDRESS,
  isBackupRecovery,
  isDID,
  isOAuthRecovery,
  PENDING_DID,
} from '../types/guards'
import type {
  DID,
  KeyBackup,
  OAuthRecoveryProof,
  RecoveryProof,
  SocialRecoveryProof,
} from '../types/index'
import { KeyBackupManager } from './backup'
import { SocialRecovery } from './social-recovery'

export interface RecoveryOptions {
  /** MPC configuration */
  mpcConfig?: Partial<MPCCoordinatorConfig>
  /** OAuth client credentials */
  oauth?: {
    twitter?: OAuthConfig
    discord?: OAuthConfig
  }
  /** Farcaster config */
  farcaster?: {
    neynarApiKey?: string
  }
  /** Network */
  network: 'mainnet' | 'testnet' | 'localnet'
}

export interface RecoveryResult {
  success: boolean
  userId: DID
  walletAddress: Address
  error?: string
}

interface IdentityRecord {
  did: DID
  linkedAccounts: Array<{ type: string; identifier: string }>
}

/**
 * Recovery Manager
 *
 * Coordinates account recovery across multiple methods.
 */
export class RecoveryManager {
  private options: RecoveryOptions
  private backupManager: KeyBackupManager
  private socialRecovery: SocialRecovery
  private mpcCoordinator: ReturnType<typeof getMPCCoordinator>
  private identities: Map<string, IdentityRecord> = new Map()

  constructor(options: RecoveryOptions) {
    this.options = options
    this.backupManager = new KeyBackupManager()
    this.socialRecovery = new SocialRecovery(options.mpcConfig)
    this.mpcCoordinator = getMPCCoordinator(options.mpcConfig)
  }

  /**
   * Initialize the recovery manager
   */
  async initialize(): Promise<void> {
    await this.socialRecovery.initialize()
  }

  /**
   * Recover account using a backup file and password
   */
  async recoverWithBackup(
    backup: KeyBackup,
    password: string,
  ): Promise<RecoveryResult> {
    const isValid = await this.backupManager.verifyBackup(backup, password)
    if (!isValid) {
      return {
        success: false,
        userId: backup.userId,
        walletAddress: EMPTY_ADDRESS,
        error: 'Invalid backup or password',
      }
    }

    const key = this.mpcCoordinator.getKey(backup.userId)
    if (!key) {
      return {
        success: false,
        userId: backup.userId,
        walletAddress: EMPTY_ADDRESS,
        error: 'Key not found in MPC coordinator',
      }
    }

    return {
      success: true,
      userId: backup.userId,
      walletAddress: key.address,
    }
  }

  /**
   * Recover account using OAuth re-authentication
   */
  async recoverWithOAuth(proof: OAuthRecoveryProof): Promise<RecoveryResult> {
    let userInfo: { id: string; username?: string }

    switch (proof.provider) {
      case 'twitter': {
        if (!this.options.oauth?.twitter) {
          throw new Error('Twitter OAuth not configured')
        }
        const twitter = new TwitterProvider(this.options.oauth.twitter)
        const token = {
          accessToken: proof.token,
          tokenType: 'Bearer',
          expiresIn: 0,
          scope: '',
        }
        const profile = await twitter.getProfile(token)
        userInfo = { id: profile.id, username: profile.handle }
        break
      }
      case 'discord': {
        if (!this.options.oauth?.discord) {
          throw new Error('Discord OAuth not configured')
        }
        const discord = new DiscordProvider(this.options.oauth.discord)
        const token = {
          accessToken: proof.token,
          tokenType: 'Bearer',
          expiresIn: 0,
          scope: '',
        }
        const profile = await discord.getProfile(token)
        userInfo = { id: profile.id, username: profile.handle }
        break
      }
      case 'farcaster': {
        const farcaster = new FarcasterProvider({
          apiKey: this.options.farcaster?.neynarApiKey,
        })
        const profile = await farcaster.getProfileByFid(
          parseInt(proof.identifier, 10),
        )
        userInfo = { id: String(profile.fid), username: profile.username }
        break
      }
    }

    if (userInfo.id !== proof.identifier) {
      return {
        success: false,
        userId: PENDING_DID,
        walletAddress: EMPTY_ADDRESS,
        error: 'OAuth identifier mismatch',
      }
    }

    const did = this.findByAccount(proof.provider, proof.identifier)
    if (!did) {
      return {
        success: false,
        userId: PENDING_DID,
        walletAddress: EMPTY_ADDRESS,
        error: 'No account found for this OAuth identity',
      }
    }

    const key = this.mpcCoordinator.getKey(did)
    if (!key) {
      return {
        success: false,
        userId: did,
        walletAddress: EMPTY_ADDRESS,
        error: 'Key not found in MPC coordinator',
      }
    }

    return {
      success: true,
      userId: did,
      walletAddress: key.address,
    }
  }

  /**
   * Recover account using social recovery (guardians)
   */
  async recoverWithGuardians(
    userId: DID,
    proof: SocialRecoveryProof,
  ): Promise<RecoveryResult> {
    const isValid = await this.socialRecovery.verifyRecoveryRequest(
      userId,
      proof,
    )
    if (!isValid) {
      return {
        success: false,
        userId,
        walletAddress: EMPTY_ADDRESS,
        error: 'Invalid guardian signatures',
      }
    }

    const result = await this.socialRecovery.executeRecovery(userId, proof)
    if (!result.success || !result.walletAddress) {
      return {
        success: false,
        userId,
        walletAddress: EMPTY_ADDRESS,
        error: result.error ?? 'Failed to recover wallet address',
      }
    }

    return {
      success: true,
      userId,
      walletAddress: result.walletAddress,
    }
  }

  /**
   * Generic recovery dispatcher
   */
  async recover(proof: RecoveryProof): Promise<RecoveryResult> {
    if (isBackupRecovery(proof)) {
      return this.recoverWithBackup(proof.data.backup, proof.data.decryptedKey)
    }
    if (isOAuthRecovery(proof)) {
      return this.recoverWithOAuth(proof.data)
    }
    // Social recovery requires explicit userId
    throw new Error('Social recovery requires explicit userId')
  }

  /**
   * Check available recovery methods for a linked account
   */
  async getRecoveryMethods(
    type: 'email' | 'wallet' | 'farcaster' | 'twitter' | 'discord',
    identifier: string,
  ): Promise<string[]> {
    const did = this.findByAccount(type, identifier)
    if (!did) {
      return []
    }

    const methods: string[] = []
    methods.push('backup')

    const identity = this.identities.get(did)
    if (identity) {
      for (const account of identity.linkedAccounts) {
        if (['twitter', 'discord', 'farcaster'].includes(account.type)) {
          methods.push(`oauth:${account.type}`)
        }
      }
    }

    const guardians = await this.socialRecovery.getGuardians(did)
    if (guardians.length >= 2) {
      methods.push('social')
    }

    return methods
  }

  /**
   * Find DID by linked account
   */
  private findByAccount(type: string, identifier: string): DID | null {
    for (const [did, identity] of this.identities) {
      const found = identity.linkedAccounts.find(
        (a) =>
          a.type === type &&
          a.identifier.toLowerCase() === identifier.toLowerCase(),
      )
      if (found && isDID(did)) {
        return did
      }
    }
    return null
  }
}
