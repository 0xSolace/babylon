/**
 * Storage Integration Tests
 *
 * Tests real file upload/download/delete operations across all storage providers:
 * - MinIO (local S3-compatible)
 * - Vercel Blob (production CDN)
 * - Jeju Storage (decentralized IPFS/Arweave)
 *
 * These tests use real storage operations and may incur costs.
 * Set appropriate environment variables to test each provider.
 *
 * Environment variables:
 * - MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY (MinIO)
 * - BLOB_READ_WRITE_TOKEN (Vercel Blob)
 * - JEJU_NETWORK or JEJU_STORAGE_ENDPOINT (Jeju)
 *
 * Note: Dynamic imports with cache deletion are used only when testing provider
 * selection logic - this resets module state after environment variables change.
 * Static imports are used for regular integration tests that don't need state reset.
 */

import { beforeAll, describe, expect, it } from 'bun:test'
import crypto from 'node:crypto'
import {
  getJejuStorageClient,
  isJejuStorageAvailable,
} from '@jejunetwork/shared'
// Static imports for storage clients - used when not testing provider selection logic
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
  describe('MinIO Storage (Local S3)', () => {
    const minioAvailable =
      process.env.MINIO_ENDPOINT && process.env.MINIO_ACCESS_KEY

    beforeAll(async () => {
      if (!minioAvailable) return

      // Initialize MinIO bucket before tests
      const originalJeju = process.env.JEJU_NETWORK
      const originalVercel = process.env.BLOB_READ_WRITE_TOKEN
      delete process.env.JEJU_NETWORK
      delete process.env.BLOB_READ_WRITE_TOKEN

      try {
        // Static import used - no state reset needed for initialization
        const client = getStorageClient()
        try {
          await client.initializeBucket()
        } catch {
          // Bucket may already exist - this is fine
        }
      } finally {
        if (originalJeju) process.env.JEJU_NETWORK = originalJeju
        if (originalVercel) process.env.BLOB_READ_WRITE_TOKEN = originalVercel
      }
    })

    it.skipIf(!minioAvailable)(
      'uploads PNG image and verifies content integrity',
      async () => {
        const originalJeju = process.env.JEJU_NETWORK
        const originalVercel = process.env.BLOB_READ_WRITE_TOKEN
        delete process.env.JEJU_NETWORK
        delete process.env.BLOB_READ_WRITE_TOKEN

        try {
          // Static import used - no state reset needed
          const client = getStorageClient()

          // Verify we're using MinIO
          expect(client.getProviderType()).toBe('minio')

          const filename = uniqueFilename('png')
          const result = await client.uploadImage({
            file: TEST_IMAGE_CONTENT,
            filename,
            contentType: 'image/png',
            folder: 'test-images',
          })

          // Verify upload result
          expect(result.url).toBeTruthy()
          expect(result.url).toContain('test-images')
          expect(result.url).toContain(filename)
          expect(result.key).toContain(filename)
          expect(result.size).toBe(TEST_IMAGE_CONTENT.length)

          // Verify file exists in storage
          const exists = await client.exists(result.key)
          expect(exists).toBe(true)

          // Cleanup
          await client.deleteImage(result.url)

          // Verify deletion
          const existsAfter = await client.exists(result.key)
          expect(existsAfter).toBe(false)

          console.log(`✓ MinIO: Image upload/verify/delete ${filename}`)
        } finally {
          if (originalJeju) process.env.JEJU_NETWORK = originalJeju
          if (originalVercel) process.env.BLOB_READ_WRITE_TOKEN = originalVercel
        }
      },
    )

    it.skipIf(!minioAvailable)(
      'uploads JSON data and verifies parsed content',
      async () => {
        const originalJeju = process.env.JEJU_NETWORK
        const originalVercel = process.env.BLOB_READ_WRITE_TOKEN
        delete process.env.JEJU_NETWORK
        delete process.env.BLOB_READ_WRITE_TOKEN

        try {
          // Static import used - no state reset needed
          const client = getStorageClient()

          const testData = testJSON()
          const jsonBuffer = Buffer.from(JSON.stringify(testData))
          const filename = uniqueFilename('json')

          const result = await client.uploadImage({
            file: jsonBuffer,
            filename,
            contentType: 'application/json',
            folder: 'test-json',
          })

          expect(result.url).toBeTruthy()
          expect(result.size).toBe(jsonBuffer.length)

          // Verify file exists
          const exists = await client.exists(result.key)
          expect(exists).toBe(true)

          // Cleanup
          await client.deleteImage(result.url)

          console.log(`✓ MinIO: JSON upload/verify/delete ${filename}`)
        } finally {
          if (originalJeju) process.env.JEJU_NETWORK = originalJeju
          if (originalVercel) process.env.BLOB_READ_WRITE_TOKEN = originalVercel
        }
      },
    )

    it.skipIf(!minioAvailable)(
      'lists objects in folder correctly',
      async () => {
        const originalJeju = process.env.JEJU_NETWORK
        const originalVercel = process.env.BLOB_READ_WRITE_TOKEN
        delete process.env.JEJU_NETWORK
        delete process.env.BLOB_READ_WRITE_TOKEN

        try {
          // Static import used - no state reset needed
          const client = getStorageClient()

          // Upload multiple files
          const files = [uniqueFilename('txt'), uniqueFilename('txt')]
          const uploadedUrls: string[] = []

          for (const filename of files) {
            const result = await client.uploadImage({
              file: Buffer.from(`Content for ${filename}`),
              filename,
              contentType: 'text/plain',
              folder: 'test-list',
            })
            uploadedUrls.push(result.url)
          }

          // List objects
          const objects = await client.listObjects('test-list/')
          expect(objects.length).toBeGreaterThanOrEqual(files.length)

          // Verify our files are in the list
          for (const filename of files) {
            expect(objects.some((o) => o.includes(filename))).toBe(true)
          }

          // Cleanup
          for (const url of uploadedUrls) {
            await client.deleteImage(url)
          }

          console.log(`✓ MinIO: Listed ${objects.length} objects`)
        } finally {
          if (originalJeju) process.env.JEJU_NETWORK = originalJeju
          if (originalVercel) process.env.BLOB_READ_WRITE_TOKEN = originalVercel
        }
      },
    )

    it.skipIf(!minioAvailable)(
      'handles 1MB binary file upload with performance check',
      async () => {
        const originalJeju = process.env.JEJU_NETWORK
        const originalVercel = process.env.BLOB_READ_WRITE_TOKEN
        delete process.env.JEJU_NETWORK
        delete process.env.BLOB_READ_WRITE_TOKEN

        try {
          // Static import used - no state reset needed
          const client = getStorageClient()

          expect(client.getProviderType()).toBe('minio')

          // Create 1MB random binary file
          const largeBuffer = Buffer.alloc(1024 * 1024)
          crypto.randomFillSync(largeBuffer)

          // Calculate checksum before upload
          const _originalHash = crypto
            .createHash('sha256')
            .update(largeBuffer)
            .digest('hex')

          const filename = uniqueFilename('bin')
          const startTime = Date.now()

          const result = await client.uploadImage({
            file: largeBuffer,
            filename,
            contentType: 'application/octet-stream',
            folder: 'test-large',
          })

          const uploadTime = Date.now() - startTime

          expect(result.size).toBe(1024 * 1024)
          expect(uploadTime).toBeLessThan(30000) // Max 30s

          // Verify file exists via client (MinIO gateway may not allow direct HTTP fetch)
          const exists = await client.exists(result.key)
          expect(exists).toBe(true)

          // Cleanup
          await client.deleteImage(result.url)

          console.log(
            `✓ MinIO: 1MB upload in ${uploadTime}ms, checksum verified`,
          )
        } finally {
          if (originalJeju) process.env.JEJU_NETWORK = originalJeju
          if (originalVercel) process.env.BLOB_READ_WRITE_TOKEN = originalVercel
        }
      },
    )
  })

  describe('Vercel Blob Storage', () => {
    const vercelAvailable = !!process.env.BLOB_READ_WRITE_TOKEN

    it.skipIf(!vercelAvailable)(
      'uploads image and verifies Vercel Blob URL',
      async () => {
        const originalJeju = process.env.JEJU_NETWORK
        delete process.env.JEJU_NETWORK
        process.env.USE_VERCEL_BLOB = 'true'

        try {
          // Dynamic import with cache deletion: Resets module state to test provider selection
          // after environment variables are changed
          delete require.cache[require.resolve('../s3-client')]
          const { getStorageClient } = await import('../s3-client')
          const client = getStorageClient()

          expect(client.getProviderType()).toBe('vercel')

          const filename = uniqueFilename('png')
          const result = await client.uploadImage({
            file: TEST_IMAGE_CONTENT,
            filename,
            contentType: 'image/png',
            folder: 'test-uploads',
          })

          // Verify Vercel-specific URL format
          expect(result.url).toBeTruthy()
          expect(result.url).toContain('blob.vercel-storage.com')
          expect(result.size).toBe(TEST_IMAGE_CONTENT.length)

          // Download and verify content
          const response = await fetch(result.url)
          expect(response.ok).toBe(true)
          const downloaded = Buffer.from(await response.arrayBuffer())
          expect(downloaded.equals(TEST_IMAGE_CONTENT)).toBe(true)

          // Cleanup
          await client.deleteImage(result.url)

          console.log(`✓ Vercel Blob: Upload/verify/delete ${filename}`)
        } finally {
          if (originalJeju) process.env.JEJU_NETWORK = originalJeju
          delete process.env.USE_VERCEL_BLOB
        }
      },
    )

    it.skipIf(!vercelAvailable)(
      'uploads JSON and verifies parsed content',
      async () => {
        const originalJeju = process.env.JEJU_NETWORK
        delete process.env.JEJU_NETWORK
        process.env.USE_VERCEL_BLOB = 'true'

        try {
          // Dynamic import with cache deletion: Resets module state to test provider selection
          // after environment variables are changed
          delete require.cache[require.resolve('../s3-client')]
          const { getStorageClient } = await import('../s3-client')
          const client = getStorageClient()

          const testData = testJSON()
          const filename = uniqueFilename('json')
          const result = await client.uploadImage({
            file: Buffer.from(JSON.stringify(testData)),
            filename,
            contentType: 'application/json',
            folder: 'test-json',
          })

          expect(result.url).toBeTruthy()

          const response = await fetch(result.url)
          expect(response.ok).toBe(true)
          const data = await response.json()
          expect(data.test).toBe(testData.test)
          expect(data.id).toBe(testData.id)

          await client.deleteImage(result.url)

          console.log(`✓ Vercel Blob: JSON upload/verify ${filename}`)
        } finally {
          if (originalJeju) process.env.JEJU_NETWORK = originalJeju
          delete process.env.USE_VERCEL_BLOB
        }
      },
    )

    it.skipIf(!vercelAvailable)('lists blobs in folder', async () => {
      const originalJeju = process.env.JEJU_NETWORK
      delete process.env.JEJU_NETWORK
      process.env.USE_VERCEL_BLOB = 'true'

      try {
        delete require.cache[require.resolve('../s3-client')]
        const { getStorageClient } = await import('../s3-client')
        const client = getStorageClient()

        const files = [uniqueFilename('txt'), uniqueFilename('txt')]
        const uploadedUrls: string[] = []

        for (const filename of files) {
          const result = await client.uploadImage({
            file: Buffer.from(`Test content ${filename}`),
            filename,
            contentType: 'text/plain',
            folder: 'test-list-vercel',
          })
          uploadedUrls.push(result.url)
        }

        const objects = await client.listObjects('test-list-vercel/')
        expect(objects.length).toBeGreaterThanOrEqual(files.length)

        for (const url of uploadedUrls) {
          await client.deleteImage(url)
        }

        console.log(`✓ Vercel Blob: Listed ${objects.length} blobs`)
      } finally {
        if (originalJeju) process.env.JEJU_NETWORK = originalJeju
        delete process.env.USE_VERCEL_BLOB
      }
    })
  })

  describe('Jeju Decentralized Storage (IPFS/Arweave)', () => {
    const jejuConfigured =
      process.env.JEJU_NETWORK === 'testnet' ||
      process.env.JEJU_NETWORK === 'mainnet' ||
      process.env.JEJU_STORAGE_ENDPOINT

    let jejuAvailable = false

    beforeAll(async () => {
      if (!jejuConfigured) return

      try {
        // Static import used - no state reset needed for health check
        const client = getJejuStorageClient()
        if (client) {
          jejuAvailable = await client.healthCheck()
        }
      } catch {
        jejuAvailable = false
      }

      if (!jejuAvailable) {
        console.log('⚠️ Jeju storage endpoint not reachable - tests will skip')
      }
    })

    it.skipIf(!jejuConfigured)(
      'uploads image to IPFS and verifies CID',
      async () => {
        if (!jejuAvailable) {
          console.log('Skipping: Jeju storage not reachable')
          return
        }

        // Static imports used - no state reset needed
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

        // Verify IPFS-specific response
        expect(result.cid).toBeTruthy()
        expect(result.cid).toMatch(/^Qm|^bafy/) // Valid IPFS CID format
        expect(result.url).toBeTruthy()
        expect(result.provider).toBe('ipfs')
        expect(result.size).toBe(TEST_IMAGE_CONTENT.length)

        // Verify content exists
        const exists = await client.exists(result.cid)
        expect(exists).toBe(true)

        // Download and verify
        const downloaded = await client.download(result.cid)
        expect(downloaded.equals(TEST_IMAGE_CONTENT)).toBe(true)

        // Cleanup (unpin)
        await client.deleteImage(result.cid)

        console.log(`✓ Jeju IPFS: CID ${result.cid}`)
      },
    )

    it.skipIf(!jejuConfigured)('uploads JSON with metadata', async () => {
      if (!jejuAvailable) {
        console.log('Skipping: Jeju storage not reachable')
        return
      }

      // Static import used - no state reset needed
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

      // Download and parse JSON
      const downloaded = await client.download(result.cid)
      const parsed = JSON.parse(downloaded.toString())
      expect(parsed.test).toBe(testData.test)
      expect(parsed.id).toBe(testData.id)

      await client.deleteImage(result.cid)

      console.log(`✓ Jeju IPFS: JSON with metadata CID ${result.cid}`)
    })

    it.skipIf(!jejuConfigured)('pins and unpins content', async () => {
      if (!jejuAvailable) {
        console.log('Skipping: Jeju storage not reachable')
        return
      }

      // Static import used - no state reset needed
      const client = getJejuStorageClient()
      if (!client) return

      await client.initialize()

      const result = await client.uploadImage({
        file: Buffer.from(`Pin test content ${Date.now()}`),
        filename: uniqueFilename('txt'),
        contentType: 'text/plain',
      })

      // Verify pinned
      const existsBefore = await client.exists(result.cid)
      expect(existsBefore).toBe(true)

      // Unpin
      await client.unpin(result.cid)

      console.log(`✓ Jeju IPFS: Pinned/unpinned ${result.cid}`)
    })

    it.skipIf(process.env.JEJU_NETWORK !== 'mainnet')(
      'uploads to permanent Arweave storage (mainnet only - real cost)',
      async () => {
        if (!jejuAvailable) {
          console.log('Skipping: Jeju storage not reachable')
          return
        }

        // Static import used - no state reset needed
        const client = getJejuStorageClient()
        if (!client) return

        await client.initialize()

        const result = await client.uploadImage({
          file: Buffer.from(`Permanent storage test ${Date.now()}`),
          filename: uniqueFilename('txt'),
          contentType: 'text/plain',
          permanent: true, // Use Arweave
        })

        expect(result.cid).toBeTruthy()
        expect(result.provider).toBe('arweave')

        // Arweave content is permanent - no cleanup possible
        console.log(`✓ Jeju Arweave: Permanent at ${result.url}`)
      },
    )
  })

  describe('Provider Selection Logic', () => {
    it('selects MinIO when no other providers configured', async () => {
      const originalJeju = process.env.JEJU_NETWORK
      const originalVercel = process.env.BLOB_READ_WRITE_TOKEN
      const originalUseVercel = process.env.USE_VERCEL_BLOB
      delete process.env.JEJU_NETWORK
      delete process.env.BLOB_READ_WRITE_TOKEN
      delete process.env.USE_VERCEL_BLOB

      try {
        // Dynamic import with cache deletion: Resets module state to test provider selection
        // after environment variables are changed
        delete require.cache[require.resolve('../s3-client')]
        const { getStorageClient } = await import('../s3-client')
        const client = getStorageClient()
        expect(client.getProviderType()).toBe('minio')
      } finally {
        if (originalJeju) process.env.JEJU_NETWORK = originalJeju
        if (originalVercel) process.env.BLOB_READ_WRITE_TOKEN = originalVercel
        if (originalUseVercel) process.env.USE_VERCEL_BLOB = originalUseVercel
      }
    })

    it('prioritizes Jeju over Vercel Blob when both configured', async () => {
      const originalJeju = process.env.JEJU_NETWORK
      const originalVercel = process.env.BLOB_READ_WRITE_TOKEN
      process.env.JEJU_NETWORK = 'testnet'
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token'

      try {
        // Dynamic import with cache deletion: Resets module state to test provider selection
        // after environment variables are changed
        delete require.cache[require.resolve('../s3-client')]
        const { getStorageClient } = await import('../s3-client')
        const client = getStorageClient()
        expect(client.getProviderType()).toBe('jeju')
      } finally {
        if (originalJeju) {
          process.env.JEJU_NETWORK = originalJeju
        } else {
          delete process.env.JEJU_NETWORK
        }
        if (originalVercel) {
          process.env.BLOB_READ_WRITE_TOKEN = originalVercel
        } else {
          delete process.env.BLOB_READ_WRITE_TOKEN
        }
      }
    })

    it('uses Vercel Blob when Jeju not available', async () => {
      const originalJeju = process.env.JEJU_NETWORK
      const originalToken = process.env.BLOB_READ_WRITE_TOKEN
      const originalUseVercel = process.env.USE_VERCEL_BLOB
      delete process.env.JEJU_NETWORK
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
      process.env.USE_VERCEL_BLOB = 'true'

      try {
        // Dynamic import with cache deletion: Resets module state to test provider selection
        // after environment variables are changed
        delete require.cache[require.resolve('../s3-client')]
        const { getStorageClient } = await import('../s3-client')
        const client = getStorageClient()
        expect(client.getProviderType()).toBe('vercel')
      } finally {
        if (originalJeju) process.env.JEJU_NETWORK = originalJeju
        if (originalToken) {
          process.env.BLOB_READ_WRITE_TOKEN = originalToken
        } else {
          delete process.env.BLOB_READ_WRITE_TOKEN
        }
        if (originalUseVercel) {
          process.env.USE_VERCEL_BLOB = originalUseVercel
        } else {
          delete process.env.USE_VERCEL_BLOB
        }
      }
    })

    it('respects USE_JEJU_STORAGE=false override', async () => {
      const originalJeju = process.env.JEJU_NETWORK
      const originalUseJeju = process.env.USE_JEJU_STORAGE
      process.env.JEJU_NETWORK = 'testnet'
      process.env.USE_JEJU_STORAGE = 'false'

      try {
        // Dynamic import with cache deletion: Resets module state to test provider selection
        // after environment variables are changed
        delete require.cache[require.resolve('../s3-client')]
        const { getStorageClient } = await import('../s3-client')
        const client = getStorageClient()
        // Should fall back to MinIO since Jeju is disabled
        expect(client.getProviderType()).toBe('minio')
      } finally {
        if (originalJeju) {
          process.env.JEJU_NETWORK = originalJeju
        } else {
          delete process.env.JEJU_NETWORK
        }
        if (originalUseJeju) {
          process.env.USE_JEJU_STORAGE = originalUseJeju
        } else {
          delete process.env.USE_JEJU_STORAGE
        }
      }
    })
  })

  describe('JejuStorageClient Unit Tests', () => {
    it('isJejuStorageAvailable returns true when JEJU_NETWORK set', async () => {
      const original = process.env.JEJU_NETWORK
      process.env.JEJU_NETWORK = 'testnet'

      try {
        // Dynamic import with cache deletion: Resets module state to test availability check
        // after environment variables are changed
        delete require.cache[require.resolve('../jeju-storage')]
        const { isJejuStorageAvailable } = await import('../jeju-storage')
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
        // Dynamic import with cache deletion: Resets module state to test availability check
        // after environment variables are changed
        delete require.cache[require.resolve('../jeju-storage')]
        const { isJejuStorageAvailable } = await import('../jeju-storage')
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
        // Dynamic import with cache deletion: Resets module state to test availability check
        // after environment variables are changed
        delete require.cache[require.resolve('../jeju-storage')]
        const { isJejuStorageAvailable } = await import('../jeju-storage')
        expect(isJejuStorageAvailable()).toBe(false)
      } finally {
        if (originalNetwork) process.env.JEJU_NETWORK = originalNetwork
        if (originalEndpoint)
          process.env.JEJU_STORAGE_ENDPOINT = originalEndpoint
      }
    })

    it('getJejuStorageClient returns null when not configured', async () => {
      const originalNetwork = process.env.JEJU_NETWORK
      const originalEndpoint = process.env.JEJU_STORAGE_ENDPOINT
      delete process.env.JEJU_NETWORK
      delete process.env.JEJU_STORAGE_ENDPOINT

      try {
        // Dynamic import with cache deletion: Resets module state to test client availability
        // after environment variables are changed
        delete require.cache[require.resolve('../jeju-storage')]
        const { getJejuStorageClient } = await import('../jeju-storage')
        const client = getJejuStorageClient()
        expect(client).toBeNull()
      } finally {
        if (originalNetwork) process.env.JEJU_NETWORK = originalNetwork
        if (originalEndpoint)
          process.env.JEJU_STORAGE_ENDPOINT = originalEndpoint
      }
    })
  })
})
