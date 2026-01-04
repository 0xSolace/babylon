/**
 * Storage Integration Tests
 *
 * Tests real file upload/download/delete operations with Jeju Storage (DWS).
 * All storage routes through decentralized IPFS/Arweave.
 *
 * Environment variables:
 * - JEJU_NETWORK or JEJU_STORAGE_ENDPOINT (required)
 */

import { beforeAll, describe, expect, it } from 'bun:test'
import crypto from 'node:crypto'
import {
  getJejuStorageClient,
  isJejuStorageAvailable,
} from '@jejunetwork/shared'
import { getStorageClient } from '../s3-client'

// Real test file content - 1x1 red PNG (valid image)
const TEST_IMAGE_CONTENT = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64',
)

// Generate unique filenames to avoid test collisions
function uniqueFilename(ext: string): string {
  return `test-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`
}

// Generate test JSON with timestamp for verification
function testJSON(): { test: boolean; timestamp: number; id: string } {
  return {
    test: true,
    timestamp: Date.now(),
    id: crypto.randomBytes(8).toString('hex'),
  }
}

describe('Storage Integration Tests', () => {
  describe('Jeju Decentralized Storage (IPFS/Arweave)', () => {
    const jejuConfigured =
      process.env.JEJU_NETWORK === 'testnet' ||
      process.env.JEJU_NETWORK === 'mainnet' ||
      process.env.JEJU_STORAGE_ENDPOINT

    let jejuAvailable = false

    beforeAll(async () => {
      if (!jejuConfigured) return

      try {
        const client = getJejuStorageClient()
        if (client) {
          jejuAvailable = await client.healthCheck()
        }
      } catch {
        jejuAvailable = false
      }
    })

    it.skipIf(!jejuConfigured)(
      'uploads image to IPFS and verifies CID',
      async () => {
        if (!jejuAvailable) return

        expect(isJejuStorageAvailable()).toBe(true)

        const client = getJejuStorageClient()
        expect(client).not.toBeNull()
        if (!client) return

        await client.initialize()

        const filename = uniqueFilename('png')
        const result = await client.uploadImage({
          file: TEST_IMAGE_CONTENT,
          filename,
          contentType: 'image/png',
          folder: 'test-uploads',
        })

        expect(result.cid).toBeTruthy()
        expect(result.cid).toMatch(/^Qm|^bafy/)
        expect(result.url).toBeTruthy()
        expect(result.provider).toBe('ipfs')
        expect(result.size).toBe(TEST_IMAGE_CONTENT.length)

        const exists = await client.exists(result.cid)
        expect(exists).toBe(true)

        const downloaded = await client.download(result.cid)
        expect(downloaded.equals(TEST_IMAGE_CONTENT)).toBe(true)

        await client.deleteImage(result.cid)
      },
    )

    it.skipIf(!jejuConfigured)('uploads JSON with metadata', async () => {
      if (!jejuAvailable) return

      const client = getJejuStorageClient()
      if (!client) return

      await client.initialize()

      const testData = testJSON()
      const filename = uniqueFilename('json')
      const result = await client.uploadImage({
        file: Buffer.from(JSON.stringify(testData)),
        filename,
        contentType: 'application/json',
        folder: 'test-metadata',
        metadata: {
          version: '1.0',
          type: 'test',
          testId: testData.id,
        },
      })

      expect(result.cid).toBeTruthy()
      expect(result.provider).toBe('ipfs')

      const downloaded = await client.download(result.cid)
      const parsed = JSON.parse(downloaded.toString())
      expect(parsed.test).toBe(testData.test)
      expect(parsed.id).toBe(testData.id)

      await client.deleteImage(result.cid)
    })

    it.skipIf(!jejuConfigured)('pins and unpins content', async () => {
      if (!jejuAvailable) return

      const client = getJejuStorageClient()
      if (!client) return

      await client.initialize()

      const result = await client.uploadImage({
        file: Buffer.from(`Pin test content ${Date.now()}`),
        filename: uniqueFilename('txt'),
        contentType: 'text/plain',
      })

      const existsBefore = await client.exists(result.cid)
      expect(existsBefore).toBe(true)

      await client.unpin(result.cid)
    })

    it.skipIf(process.env.JEJU_NETWORK !== 'mainnet')(
      'uploads to permanent Arweave storage (mainnet only - real cost)',
      async () => {
        if (!jejuAvailable) return

        const client = getJejuStorageClient()
        if (!client) return

        await client.initialize()

        const result = await client.uploadImage({
          file: Buffer.from(`Permanent storage test ${Date.now()}`),
          filename: uniqueFilename('txt'),
          contentType: 'text/plain',
          permanent: true,
        })

        expect(result.cid).toBeTruthy()
        expect(result.provider).toBe('arweave')
      },
    )
  })

  describe('StorageClient wrapper', () => {
    const jejuConfigured =
      process.env.JEJU_NETWORK === 'testnet' ||
      process.env.JEJU_NETWORK === 'mainnet' ||
      process.env.JEJU_STORAGE_ENDPOINT

    let jejuAvailable = false

    beforeAll(async () => {
      if (!jejuConfigured) return

      try {
        const client = getJejuStorageClient()
        if (client) {
          jejuAvailable = await client.healthCheck()
        }
      } catch {
        jejuAvailable = false
      }
    })

    it.skipIf(!jejuConfigured)('uploads via wrapper client', async () => {
      if (!jejuAvailable) return

      const client = getStorageClient()
      const filename = uniqueFilename('png')

      const result = await client.uploadImage({
        file: TEST_IMAGE_CONTENT,
        filename,
        contentType: 'image/png',
        folder: 'test-uploads',
      })

      expect(result.cid).toBeTruthy()
      expect(result.url).toBeTruthy()
      expect(result.provider).toBe('ipfs')

      await client.deleteImage(result.cid)
    })

    it.skipIf(!jejuConfigured)('downloads via wrapper client', async () => {
      if (!jejuAvailable) return

      const client = getStorageClient()
      const filename = uniqueFilename('txt')
      const content = `Test content ${Date.now()}`

      const result = await client.uploadImage({
        file: Buffer.from(content),
        filename,
        contentType: 'text/plain',
      })

      const downloaded = await client.download(result.cid)
      expect(downloaded.toString()).toBe(content)

      await client.deleteImage(result.cid)
    })
  })

  describe('JejuStorageClient Unit Tests', () => {
    it('isJejuStorageAvailable returns true when JEJU_NETWORK set', async () => {
      const original = process.env.JEJU_NETWORK
      process.env.JEJU_NETWORK = 'testnet'

      try {
        expect(isJejuStorageAvailable()).toBe(true)
      } finally {
        if (original) {
          process.env.JEJU_NETWORK = original
        } else {
          delete process.env.JEJU_NETWORK
        }
      }
    })

    it('isJejuStorageAvailable returns true when JEJU_STORAGE_ENDPOINT set', async () => {
      const originalNetwork = process.env.JEJU_NETWORK
      const originalEndpoint = process.env.JEJU_STORAGE_ENDPOINT
      delete process.env.JEJU_NETWORK
      process.env.JEJU_STORAGE_ENDPOINT = 'https://storage.example.com'

      try {
        expect(isJejuStorageAvailable()).toBe(true)
      } finally {
        if (originalNetwork) process.env.JEJU_NETWORK = originalNetwork
        if (originalEndpoint) {
          process.env.JEJU_STORAGE_ENDPOINT = originalEndpoint
        } else {
          delete process.env.JEJU_STORAGE_ENDPOINT
        }
      }
    })

    it('isJejuStorageAvailable returns false when not configured', async () => {
      const originalNetwork = process.env.JEJU_NETWORK
      const originalEndpoint = process.env.JEJU_STORAGE_ENDPOINT
      delete process.env.JEJU_NETWORK
      delete process.env.JEJU_STORAGE_ENDPOINT

      try {
        expect(isJejuStorageAvailable()).toBe(false)
      } finally {
        if (originalNetwork) process.env.JEJU_NETWORK = originalNetwork
        if (originalEndpoint)
          process.env.JEJU_STORAGE_ENDPOINT = originalEndpoint
      }
    })

    it('getJejuStorageClient throws when not configured', async () => {
      const originalNetwork = process.env.JEJU_NETWORK
      const originalEndpoint = process.env.JEJU_STORAGE_ENDPOINT
      delete process.env.JEJU_NETWORK
      delete process.env.JEJU_STORAGE_ENDPOINT

      try {
        expect(() => getJejuStorageClient()).toThrow(
          'Jeju Storage not configured',
        )
      } finally {
        if (originalNetwork) process.env.JEJU_NETWORK = originalNetwork
        if (originalEndpoint)
          process.env.JEJU_STORAGE_ENDPOINT = originalEndpoint
      }
    })
  })
})
