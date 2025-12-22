/**
 * Babylon TEE Enclave - encrypted state and attestation (simulated)
 */

import { logger } from '@babylon/shared';
import { type Address, type Hex, keccak256, toBytes } from 'viem';

// ============================================================================
// Types
// ============================================================================

export interface BabylonEnclaveConfig {
  codeHash: Hex;
  instanceId: string;
  treasuryAddress: Address;
  rpcUrl: string;
  verbose?: boolean;
}

export interface AttestationQuote {
  measurement: Hex;
  platform: 'intel_tdx' | 'nvidia_cc' | 'simulated';
  operatorAddress: Address;
  cpuSignature: Hex;
  gpuSignature?: Hex;
  timestamp: number;
  reportData: Hex;
}

export interface SealedState {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
  sealedAt: number;
}

export interface EnclaveStatus {
  running: boolean;
  address: Address | null;
  stateVersion: number;
  keyVersion: number;
  lastHeartbeat: number;
  attestationValid: boolean;
}

// ============================================================================
// Babylon Enclave
// ============================================================================

export class BabylonEnclave {
  private config: BabylonEnclaveConfig;
  private isRunning = false;
  private operatorAddress: Address | null = null;
  private attestationQuote: AttestationQuote | null = null;
  private keyVersion = 1;
  private stateVersion = 0;
  private lastHeartbeat = 0;
  private sealedState: SealedState | null = null;

  // Simulated encryption key (in real TEE, derived from hardware)
  private encryptionKey: Uint8Array | null = null;

  private constructor(config: BabylonEnclaveConfig) {
    this.config = config;
  }

  /**
   * Create and boot a Babylon enclave
   */
  static async create(config: BabylonEnclaveConfig): Promise<BabylonEnclave> {
    const enclave = new BabylonEnclave(config);
    await enclave.boot();
    return enclave;
  }

  /**
   * Boot the enclave
   */
  private async boot(): Promise<void> {
    if (this.config.verbose) {
      logger.info('[BabylonEnclave] Booting enclave...');
    }

    // Generate measurement from code hash and instance ID
    const measurement = keccak256(
      toBytes(`${this.config.codeHash}:${this.config.instanceId}`)
    );

    // Derive operator address (simulated - in real TEE uses DStack SDK)
    this.operatorAddress = await this.deriveOperatorAddress(measurement);

    // Generate encryption key (simulated - in real TEE uses hardware KMS)
    this.encryptionKey = await this.deriveEncryptionKey(measurement);

    // Generate attestation quote
    this.attestationQuote = this.generateAttestation(measurement);

    this.isRunning = true;
    this.lastHeartbeat = Date.now();

    if (this.config.verbose) {
      logger.info('[BabylonEnclave] Enclave booted successfully', {
        operatorAddress: this.operatorAddress,
        measurement,
      });
    }
  }

  /**
   * Get the operator's Ethereum address
   */
  getOperatorAddress(): Address {
    this.ensureRunning();
    return this.operatorAddress!;
  }

  /**
   * Get the attestation quote
   */
  getAttestation(): AttestationQuote {
    this.ensureRunning();
    return this.attestationQuote!;
  }

  private toArrayBuffer(arr: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(arr.length);
    new Uint8Array(buffer).set(arr);
    return buffer;
  }

  /**
   * Encrypt and seal game state
   */
  async sealState<T extends object>(state: T): Promise<SealedState> {
    this.ensureRunning();

    const plaintext = JSON.stringify(state);

    // Use Web Crypto API for encryption
    const ivBytes = new Uint8Array(12);
    crypto.getRandomValues(ivBytes);

    const key = await crypto.subtle.importKey(
      'raw',
      this.toArrayBuffer(new Uint8Array(this.encryptionKey!)),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const ivBuffer = this.toArrayBuffer(ivBytes);
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      key,
      this.toArrayBuffer(encoded)
    );

    this.stateVersion++;

    const sealed: SealedState = {
      ciphertext: this.bufferToBase64(ciphertext),
      iv: this.bufferToBase64(ivBuffer),
      tag: '', // GCM includes tag in ciphertext
      keyVersion: this.keyVersion,
      sealedAt: Date.now(),
    };

    this.sealedState = sealed;

    if (this.config.verbose) {
      logger.info('[BabylonEnclave] State sealed', {
        version: this.stateVersion,
        keyVersion: this.keyVersion,
      });
    }

    return sealed;
  }

  /**
   * Decrypt and unseal game state
   */
  async unsealState<T extends object>(sealed: SealedState): Promise<T> {
    this.ensureRunning();

    // Verify key version (would need old keys for older versions)
    if (sealed.keyVersion !== this.keyVersion) {
      throw new Error(
        `Key version mismatch: sealed=${sealed.keyVersion}, current=${this.keyVersion}`
      );
    }

    const key = await crypto.subtle.importKey(
      'raw',
      this.toArrayBuffer(new Uint8Array(this.encryptionKey!)),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const ciphertext = new Uint8Array(this.base64ToBuffer(sealed.ciphertext));
    const iv = new Uint8Array(this.base64ToBuffer(sealed.iv));

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.toArrayBuffer(iv) },
      key,
      this.toArrayBuffer(ciphertext)
    );

    const state = JSON.parse(new TextDecoder().decode(plaintext)) as T;

    if (this.config.verbose) {
      logger.info('[BabylonEnclave] State unsealed', {
        keyVersion: sealed.keyVersion,
      });
    }

    return state;
  }

  /**
   * Rotate the encryption key
   */
  async rotateKey(): Promise<{ oldVersion: number; newVersion: number }> {
    this.ensureRunning();

    const oldVersion = this.keyVersion;
    this.keyVersion++;

    // Derive new encryption key
    const measurement = keccak256(
      toBytes(
        `${this.config.codeHash}:${this.config.instanceId}:v${this.keyVersion}`
      )
    );
    this.encryptionKey = await this.deriveEncryptionKey(measurement);

    if (this.config.verbose) {
      logger.info('[BabylonEnclave] Key rotated', {
        oldVersion,
        newVersion: this.keyVersion,
      });
    }

    return { oldVersion, newVersion: this.keyVersion };
  }

  /**
   * Re-encrypt state with new key after rotation
   */
  async reencryptState<T extends object>(state: T): Promise<SealedState> {
    return this.sealState(state);
  }

  /**
   * Generate heartbeat for liveness proof
   */
  generateHeartbeat(): { timestamp: number; signature: Hex; stateHash: Hex } {
    this.ensureRunning();

    this.lastHeartbeat = Date.now();

    // Generate state hash
    const stateHash = this.sealedState
      ? keccak256(toBytes(this.sealedState.ciphertext))
      : (('0x' + '0'.repeat(64)) as Hex);

    // Sign heartbeat (simulated)
    const heartbeatData = `heartbeat:${this.lastHeartbeat}:${stateHash}`;
    const signature = keccak256(toBytes(heartbeatData + this.operatorAddress));

    return {
      timestamp: this.lastHeartbeat,
      signature,
      stateHash,
    };
  }

  /**
   * Get enclave status
   */
  getStatus(): EnclaveStatus {
    return {
      running: this.isRunning,
      address: this.operatorAddress,
      stateVersion: this.stateVersion,
      keyVersion: this.keyVersion,
      lastHeartbeat: this.lastHeartbeat,
      attestationValid: this.attestationQuote !== null,
    };
  }

  /**
   * Get current sealed state
   */
  getSealedState(): SealedState | null {
    return this.sealedState;
  }

  /**
   * Shutdown the enclave
   */
  async shutdown(): Promise<void> {
    if (this.config.verbose) {
      logger.info('[BabylonEnclave] Shutting down...');
    }

    this.isRunning = false;
    this.encryptionKey = null;
    this.operatorAddress = null;
    this.attestationQuote = null;

    if (this.config.verbose) {
      logger.info('[BabylonEnclave] Shutdown complete');
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private ensureRunning(): void {
    if (!this.isRunning) {
      throw new Error('Enclave is not running');
    }
  }

  // Simulated - in prod uses DStack SDK
  private async deriveOperatorAddress(measurement: Hex): Promise<Address> {
    const addressHash = keccak256(toBytes(measurement + 'operator'));
    return ('0x' + addressHash.slice(-40)) as Address;
  }

  // Simulated - in prod uses hardware KMS
  private async deriveEncryptionKey(measurement: Hex): Promise<Uint8Array> {
    const keyHash = keccak256(toBytes(measurement + `key:${this.keyVersion}`));
    return new Uint8Array(Buffer.from(keyHash.slice(2), 'hex'));
  }

  // Simulated attestation - not verifiable
  private generateAttestation(measurement: Hex): AttestationQuote {
    const timestamp = Date.now();
    const reportData = keccak256(
      toBytes(`${measurement}:${this.operatorAddress}:${timestamp}`)
    );
    const cpuSignature = keccak256(toBytes(`cpu:${reportData}`));
    const gpuSignature = keccak256(toBytes(`gpu:${reportData}`));

    return {
      measurement,
      platform: 'simulated',
      operatorAddress: this.operatorAddress!,
      cpuSignature,
      gpuSignature,
      timestamp,
      reportData,
    };
  }

  private bufferToBase64(buffer: ArrayBuffer): string {
    return Buffer.from(buffer).toString('base64');
  }

  private base64ToBuffer(base64: string): Uint8Array {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
}

// ============================================================================
// Factory
// ============================================================================

let babylonEnclave: BabylonEnclave | null = null;

export async function getBabylonEnclave(
  config?: Partial<BabylonEnclaveConfig>
): Promise<BabylonEnclave> {
  if (!babylonEnclave) {
    // Hard-fail in production if REQUIRE_REAL_TEE is set
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.REQUIRE_REAL_TEE === 'true'
    ) {
      throw new Error(
        'Real TEE required in production (REQUIRE_REAL_TEE=true). ' +
          'Deploy to Phala Network CVM with Intel TDX or AMD SEV.'
      );
    }

    if (process.env.NODE_ENV === 'production') {
      logger.warn(
        '[BabylonEnclave] Running SIMULATED enclave in production. ' +
          'Set REQUIRE_REAL_TEE=true to enforce real TEE.'
      );
    }

    babylonEnclave = await BabylonEnclave.create({
      codeHash: (process.env.BABYLON_CODE_HASH ?? '0x' + '0'.repeat(64)) as Hex,
      instanceId: process.env.BABYLON_INSTANCE_ID ?? `instance-${Date.now()}`,
      treasuryAddress: (process.env.BABYLON_TREASURY_ADDRESS ??
        '0x0000000000000000000000000000000000000000') as Address,
      rpcUrl: process.env.JEJU_RPC_URL ?? 'http://localhost:9545',
      verbose: process.env.BABYLON_VERBOSE === 'true',
      ...config,
    });
  }
  return babylonEnclave;
}

export async function shutdownBabylonEnclave(): Promise<void> {
  if (babylonEnclave) {
    await babylonEnclave.shutdown();
    babylonEnclave = null;
  }
}
