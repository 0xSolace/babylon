/**
 * Recovery Manager
 *
 * Manages account recovery using multiple methods:
 * - Backup password
 * - OAuth re-authentication
 * - Social recovery (guardians)
 */

import type { Address } from 'viem';
import { DIDManager } from '../did/manager';
import { MPCClient, type MPCClientConfig } from '../mpc/client';
import { DiscordOAuth } from '../oauth/discord';
import { FarcasterAuth } from '../oauth/farcaster';
import { TwitterOAuth } from '../oauth/twitter';
import type {
  BackupRecoveryProof,
  DID,
  KeyBackup,
  OAuthRecoveryProof,
  RecoveryProof,
  SocialRecoveryProof,
} from '../types/index';
import { KeyBackupManager } from './backup';
import { SocialRecovery } from './social-recovery';

export interface RecoveryOptions {
  /** MPC configuration */
  mpcConfig?: Partial<MPCClientConfig>;
  /** OAuth client IDs */
  oauth?: {
    twitter?: string;
    discord?: string;
  };
  /** Farcaster config */
  farcaster?: {
    neynarApiKey?: string;
  };
  /** Network */
  network: 'mainnet' | 'testnet' | 'localnet';
}

export interface RecoveryResult {
  success: boolean;
  userId: DID;
  walletAddress: Address;
  error?: string;
}

/**
 * Recovery Manager
 *
 * Coordinates account recovery across multiple methods.
 */
export class RecoveryManager {
  private options: RecoveryOptions;
  private backupManager: KeyBackupManager;
  private socialRecovery: SocialRecovery;
  private didManager: DIDManager;
  private mpcClient: MPCClient;

  constructor(options: RecoveryOptions) {
    this.options = options;
    this.backupManager = new KeyBackupManager();
    this.socialRecovery = new SocialRecovery(options.mpcConfig);
    this.didManager = new DIDManager({
      network: options.network,
      mpcConfig: options.mpcConfig,
    });
    this.mpcClient = new MPCClient(options.mpcConfig);
  }

  /**
   * Initialize the recovery manager
   */
  async initialize(): Promise<void> {
    await this.mpcClient.initialize();
    await this.didManager.initialize();
  }

  /**
   * Recover account using a backup file and password
   */
  async recoverWithBackup(
    backup: KeyBackup,
    password: string
  ): Promise<RecoveryResult> {
    // Verify and decrypt the backup
    const isValid = await this.backupManager.verifyBackup(backup, password);
    if (!isValid) {
      return {
        success: false,
        userId: backup.userId,
        walletAddress: '0x' as Address,
        error: 'Invalid backup or password',
      };
    }

    // Re-derive wallet from MPC network
    const keyResult = await this.mpcClient.generateKey(backup.userId, {
      type: 'wallet',
      proof: '0x', // Backup verification is the proof
      identifier: backup.userId,
    });

    if (!keyResult.success || !keyResult.walletAddress) {
      return {
        success: false,
        userId: backup.userId,
        walletAddress: '0x' as Address,
        error: keyResult.error ?? 'Key generation failed',
      };
    }

    return {
      success: true,
      userId: backup.userId,
      walletAddress: keyResult.walletAddress,
    };
  }

  /**
   * Recover account using OAuth re-authentication
   */
  async recoverWithOAuth(proof: OAuthRecoveryProof): Promise<RecoveryResult> {
    // Verify OAuth token
    let userInfo: { id: string; username?: string };

    switch (proof.provider) {
      case 'twitter': {
        if (!this.options.oauth?.twitter) {
          throw new Error('Twitter OAuth not configured');
        }
        const twitter = new TwitterOAuth({
          clientId: this.options.oauth.twitter,
        });
        userInfo = await twitter.getUserInfo(proof.token);
        break;
      }
      case 'discord': {
        if (!this.options.oauth?.discord) {
          throw new Error('Discord OAuth not configured');
        }
        const discord = new DiscordOAuth({
          clientId: this.options.oauth.discord,
        });
        userInfo = await discord.getUserInfo(proof.token);
        break;
      }
      case 'farcaster': {
        const farcaster = new FarcasterAuth(this.options.farcaster);
        userInfo = await farcaster.getUserProfile(
          parseInt(proof.identifier, 10)
        );
        break;
      }
    }

    // Verify the identifier matches
    if (userInfo.id !== proof.identifier) {
      return {
        success: false,
        userId: 'did:jeju:pending:0x' as DID,
        walletAddress: '0x' as Address,
        error: 'OAuth identifier mismatch',
      };
    }

    // Find DID by linked account
    const did = await this.didManager.findByAccount(
      proof.provider,
      proof.identifier
    );
    if (!did) {
      return {
        success: false,
        userId: 'did:jeju:pending:0x' as DID,
        walletAddress: '0x' as Address,
        error: 'No account found for this OAuth identity',
      };
    }

    // Re-derive wallet
    const keyResult = await this.mpcClient.generateKey(did, {
      type: proof.provider,
      proof: proof.token,
      identifier: proof.identifier,
    });

    if (!keyResult.success || !keyResult.walletAddress) {
      return {
        success: false,
        userId: did,
        walletAddress: '0x' as Address,
        error: keyResult.error ?? 'Key generation failed',
      };
    }

    return {
      success: true,
      userId: did,
      walletAddress: keyResult.walletAddress,
    };
  }

  /**
   * Recover account using social recovery (guardians)
   */
  async recoverWithGuardians(
    userId: DID,
    proof: SocialRecoveryProof
  ): Promise<RecoveryResult> {
    // Verify guardian signatures
    const isValid = await this.socialRecovery.verifyRecoveryRequest(
      userId,
      proof
    );
    if (!isValid) {
      return {
        success: false,
        userId,
        walletAddress: '0x' as Address,
        error: 'Invalid guardian signatures',
      };
    }

    // Execute recovery
    const result = await this.socialRecovery.executeRecovery(userId, proof);
    if (!result.success) {
      return {
        success: false,
        userId,
        walletAddress: '0x' as Address,
        error: result.error,
      };
    }

    return {
      success: true,
      userId,
      walletAddress: result.walletAddress!,
    };
  }

  /**
   * Generic recovery dispatcher
   */
  async recover(proof: RecoveryProof): Promise<RecoveryResult> {
    switch (proof.type) {
      case 'backup':
        return this.recoverWithBackup(
          (proof.data as BackupRecoveryProof).backup,
          (proof.data as BackupRecoveryProof).decryptedKey as unknown as string
        );
      case 'oauth':
        return this.recoverWithOAuth(proof.data as OAuthRecoveryProof);
      case 'social':
        // Need to determine userId from the request hash
        throw new Error('Social recovery requires explicit userId');
    }
  }

  /**
   * Check available recovery methods for a linked account
   */
  async getRecoveryMethods(
    type: 'email' | 'wallet' | 'farcaster' | 'twitter' | 'discord',
    identifier: string
  ): Promise<string[]> {
    const did = await this.didManager.findByAccount(type, identifier);
    if (!did) {
      return [];
    }

    const methods: string[] = [];

    // Check what's linked
    const document = await this.didManager.resolve(did);
    if (!document) {
      return [];
    }

    // Backup is always available if they created one
    methods.push('backup');

    // Check OAuth providers
    for (const account of document.linkedAccounts) {
      if (['twitter', 'discord', 'farcaster'].includes(account.type)) {
        methods.push(`oauth:${account.type}`);
      }
    }

    // Check if social recovery is set up
    const guardians = await this.socialRecovery.getGuardians(did);
    if (guardians.length >= 2) {
      methods.push('social');
    }

    return methods;
  }
}
