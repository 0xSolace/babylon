/**
 * Key Backup Manager - encrypts/exports key material using PBKDF2 + AES-GCM.
 */

import { logger } from '@babylon/shared'
import { toBytes, toHex } from 'viem'
import { KeyBackupSchema } from '../schemas/index'
import type { DID, KeyBackup } from '../types/index'

export interface BackupOptions {
  iterations?: number
  saltLength?: number
  ivLength?: number
}

/** Minimum PBKDF2 iterations for production security (OWASP recommendation) */
const MIN_PRODUCTION_ITERATIONS = 100000

const DEFAULT_OPTIONS: Required<BackupOptions> = {
  iterations: MIN_PRODUCTION_ITERATIONS,
  saltLength: 32,
  ivLength: 12,
}

export class KeyBackupManager {
  private options: Required<BackupOptions>

  constructor(options?: BackupOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options }

    // Production security check
    const isProduction = process.env.NODE_ENV === 'production'
    if (isProduction && this.options.iterations < MIN_PRODUCTION_ITERATIONS) {
      throw new Error(
        `PBKDF2 iterations too low for production: ${this.options.iterations}. ` +
          `Minimum required: ${MIN_PRODUCTION_ITERATIONS}`,
      )
    }

    // Warn about low iterations in any environment
    if (this.options.iterations < 10000) {
      logger.warn(
        'PBKDF2 iterations below 10000 - only use for testing',
        { iterations: this.options.iterations },
        'KeyBackupManager',
      )
    }
  }

  async createBackup(userId: DID, password: string): Promise<KeyBackup> {
    const salt = crypto.getRandomValues(new Uint8Array(this.options.saltLength))
    const iv = crypto.getRandomValues(new Uint8Array(this.options.ivLength))
    const key = await this.deriveKey(password, salt)
    const keyMaterial = await this.getKeyMaterial(userId)
    const encryptedKey = await this.encrypt(keyMaterial, key, iv)

    return {
      version: 1,
      userId,
      encryptedKey: toHex(new Uint8Array(encryptedKey)),
      salt: toHex(salt),
      iv: toHex(iv),
      iterations: this.options.iterations,
      createdAt: Date.now(),
    }
  }

  async verifyBackup(backup: KeyBackup, password: string): Promise<boolean> {
    const key = await this.deriveKey(
      password,
      toBytes(backup.salt),
      backup.iterations,
    )
    const decrypted = await this.decrypt(
      toBytes(backup.encryptedKey),
      key,
      toBytes(backup.iv),
    )
    return decrypted.length > 0
  }

  async restoreFromBackup(
    backup: KeyBackup,
    password: string,
  ): Promise<Uint8Array> {
    const key = await this.deriveKey(
      password,
      toBytes(backup.salt),
      backup.iterations,
    )
    return this.decrypt(toBytes(backup.encryptedKey), key, toBytes(backup.iv))
  }

  private async deriveKey(
    password: string,
    salt: Uint8Array,
    iterations = this.options.iterations,
  ): Promise<CryptoKey> {
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey'],
    )

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: this.toArrayBuffer(salt),
        iterations,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
  }

  private toArrayBuffer(arr: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(arr.length)
    new Uint8Array(buffer).set(arr)
    return buffer
  }

  private async encrypt(
    data: Uint8Array,
    key: CryptoKey,
    iv: Uint8Array,
  ): Promise<ArrayBuffer> {
    return crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: this.toArrayBuffer(iv) },
      key,
      this.toArrayBuffer(data),
    )
  }

  private async decrypt(
    data: Uint8Array,
    key: CryptoKey,
    iv: Uint8Array,
  ): Promise<Uint8Array> {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.toArrayBuffer(iv) },
      key,
      this.toArrayBuffer(data),
    )
    return new Uint8Array(decrypted)
  }

  private async getKeyMaterial(userId: DID): Promise<Uint8Array> {
    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(userId),
    )
    return new Uint8Array(hash)
  }

  static exportToJSON(backup: KeyBackup): string {
    return JSON.stringify(backup, null, 2)
  }

  static importFromJSON(json: string): KeyBackup {
    const parsed = JSON.parse(json)
    const result = KeyBackupSchema.safeParse(parsed)
    if (!result.success) {
      throw new Error('Invalid backup format')
    }
    return result.data
  }

  static exportToBase64(backup: KeyBackup): string {
    return btoa(JSON.stringify(backup))
  }

  static importFromBase64(base64: string): KeyBackup {
    return KeyBackupManager.importFromJSON(atob(base64))
  }
}
