/**
 * DID Manager - creates DIDs, links accounts, manages key shares.
 */

import {
  AuthenticationError,
  logger,
  NotFoundError,
  ValidationError,
} from '@babylon/shared';
import { type Address, type Hex, verifyMessage } from 'viem';
import { MPCClient, type MPCClientConfig } from '../mpc/client';
import type {
  AuthMethod,
  DID,
  DIDDocument,
  LinkedAccount,
} from '../types/index';
import { createDID, validateDID } from './utils';

/** Redact address for logging */
function redactAddr(addr: Address | string | undefined): string {
  if (!addr) return '[none]';
  if (addr.length < 12) return '[invalid]';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** Redact DID for logging */
function redactDid(did: DID | string | undefined): string {
  if (!did) return '[none]';
  const parts = did.split(':');
  if (parts.length < 4) return '[invalid]';
  return `${parts[0]}:${parts[1]}:${parts[2]}:${redactAddr(parts[3] ?? '')}`;
}

export interface DIDManagerConfig {
  mpcConfig?: Partial<MPCClientConfig>;
  network: 'mainnet' | 'testnet' | 'localnet';
}

export class DIDManager {
  private mpcClient: MPCClient;
  private config: DIDManagerConfig;
  private documents: Map<DID, DIDDocument> = new Map();

  constructor(config: DIDManagerConfig = { network: 'localnet' }) {
    this.config = config;
    this.mpcClient = new MPCClient(config.mpcConfig);
  }

  async initialize(): Promise<void> {
    await this.mpcClient.initialize();
  }

  async createIdentity(authMethod: AuthMethod): Promise<{
    did: DID;
    document: DIDDocument;
    walletAddress: Address;
  }> {
    logger.debug(
      'Creating identity',
      { authType: authMethod.type },
      'DIDManager'
    );
    this.validateAuthMethod(authMethod);
    const identifier = this.getIdentifier(authMethod);

    const keyResult = await this.mpcClient.generateKey(
      `did:jeju:${this.config.network}:pending` as DID,
      {
        type: authMethod.type,
        proof: this.extractProof(authMethod),
        identifier,
      }
    );

    if (
      !keyResult.success ||
      !keyResult.walletAddress ||
      !keyResult.publicKey
    ) {
      logger.error(
        'Identity creation failed',
        { authType: authMethod.type, error: keyResult.error },
        'DIDManager'
      );
      throw new ValidationError(
        `Failed to create identity: ${keyResult.error}`,
        ['authMethod']
      );
    }

    const did = createDID(keyResult.publicKey, this.config.network);
    const document: DIDDocument = {
      id: did,
      verificationMethod: [
        {
          id: `${did}#key-1`,
          type: 'EcdsaSecp256k1VerificationKey2019',
          controller: did,
          publicKeyHex: keyResult.publicKey,
        },
      ],
      authentication: [`${did}#key-1`],
      linkedAccounts: [
        {
          type: authMethod.type,
          identifier,
          verifiedAt: Date.now(),
          metadata: this.extractMetadata(authMethod),
        },
      ],
      created: Date.now(),
      updated: Date.now(),
    };

    this.documents.set(did, document);
    logger.info(
      'Identity created',
      {
        did: redactDid(did),
        walletAddress: redactAddr(keyResult.walletAddress),
      },
      'DIDManager'
    );
    return { did, document, walletAddress: keyResult.walletAddress };
  }

  async linkAccount(
    did: DID,
    authMethod: AuthMethod,
    ownershipProof: Hex
  ): Promise<LinkedAccount> {
    const document = this.documents.get(did);
    if (!document) throw new NotFoundError('DID', did);

    const isOwner = await this.verifyOwnership(
      did,
      ownershipProof,
      'link-account'
    );
    if (!isOwner) {
      throw new AuthenticationError(
        'Ownership verification failed',
        'INVALID_CREDENTIALS'
      );
    }

    this.validateAuthMethod(authMethod);

    const linkedAccount: LinkedAccount = {
      type: authMethod.type,
      identifier: this.getIdentifier(authMethod),
      verifiedAt: Date.now(),
      metadata: this.extractMetadata(authMethod),
    };

    if (
      document.linkedAccounts.find(
        (a) =>
          a.type === linkedAccount.type &&
          a.identifier === linkedAccount.identifier
      )
    ) {
      throw new ValidationError(
        `Account already linked: ${linkedAccount.type}:${linkedAccount.identifier}`,
        ['linkedAccount']
      );
    }

    document.linkedAccounts.push(linkedAccount);
    document.updated = Date.now();
    return linkedAccount;
  }

  async unlinkAccount(
    did: DID,
    type: LinkedAccount['type'],
    identifier: string,
    ownershipProof: Hex
  ): Promise<void> {
    const document = this.documents.get(did);
    if (!document) throw new NotFoundError('DID', did);

    const isOwner = await this.verifyOwnership(
      did,
      ownershipProof,
      'unlink-account'
    );
    if (!isOwner) {
      throw new AuthenticationError(
        'Ownership verification failed',
        'INVALID_CREDENTIALS'
      );
    }

    if (document.linkedAccounts.length <= 1) {
      throw new ValidationError('Cannot unlink last account', [
        'linkedAccounts',
      ]);
    }

    const index = document.linkedAccounts.findIndex(
      (a) => a.type === type && a.identifier === identifier
    );
    if (index === -1) {
      throw new NotFoundError('Linked Account', `${type}:${identifier}`);
    }

    document.linkedAccounts.splice(index, 1);
    document.updated = Date.now();
  }

  async resolve(did: DID): Promise<DIDDocument | null> {
    if (!validateDID(did)) {
      throw new ValidationError(`Invalid DID format: ${did}`, ['did']);
    }
    return this.documents.get(did) ?? null;
  }

  async findByAccount(
    type: LinkedAccount['type'],
    identifier: string
  ): Promise<DID | null> {
    for (const [did, doc] of this.documents) {
      if (
        doc.linkedAccounts.find(
          (a) =>
            a.type === type &&
            a.identifier.toLowerCase() === identifier.toLowerCase()
        )
      ) {
        return did;
      }
    }
    return null;
  }

  private async verifyOwnership(
    did: DID,
    signature: Hex,
    action = 'verify-ownership'
  ): Promise<boolean> {
    const document = this.documents.get(did);
    if (!document?.verificationMethod[0]) return false;

    const identifier = did.split(':')[3];
    if (!identifier?.startsWith('0x')) return false;

    const message = `Authorize ${action} for ${did}`;
    return verifyMessage({
      address: identifier as Address,
      message,
      signature,
    });
  }

  getOwnershipProofMessage(did: DID, action: string): string {
    return `Authorize ${action} for ${did}`;
  }

  private validateAuthMethod(authMethod: AuthMethod): void {
    switch (authMethod.type) {
      case 'email':
        if (!authMethod.email.includes('@')) {
          throw new ValidationError('Invalid email format', ['email']);
        }
        break;
      case 'wallet':
        if (
          !authMethod.address.startsWith('0x') ||
          authMethod.address.length !== 42
        ) {
          throw new ValidationError('Invalid wallet address format', [
            'address',
          ]);
        }
        break;
      case 'farcaster':
        if (authMethod.fid <= 0) {
          throw new ValidationError('Invalid FID', ['fid']);
        }
        break;
      case 'twitter':
      case 'discord':
        if (!authMethod.code || !authMethod.codeVerifier) {
          throw new ValidationError('Missing OAuth params', [
            'code',
            'codeVerifier',
          ]);
        }
        break;
    }
  }

  private getIdentifier(authMethod: AuthMethod): string {
    switch (authMethod.type) {
      case 'email':
        return authMethod.email.toLowerCase();
      case 'wallet':
        return authMethod.address.toLowerCase();
      case 'farcaster':
        return String(authMethod.fid);
      case 'twitter':
        return `twitter:${authMethod.state}`;
      case 'discord':
        return `discord:${authMethod.state}`;
    }
  }

  private extractProof(authMethod: AuthMethod): Hex | string {
    switch (authMethod.type) {
      case 'email':
        return authMethod.codeHash;
      case 'wallet':
        return authMethod.signature;
      case 'farcaster':
        return authMethod.signature;
      case 'twitter':
      case 'discord':
        return authMethod.code;
    }
  }

  private extractMetadata(authMethod: AuthMethod): LinkedAccount['metadata'] {
    if (authMethod.type === 'farcaster') {
      return {
        fid: authMethod.fid,
        username: authMethod.username,
        displayName: authMethod.displayName,
        pfpUrl: authMethod.pfpUrl,
      };
    }
    if (authMethod.type === 'wallet') return { chainId: 1 };
    return undefined;
  }
}
