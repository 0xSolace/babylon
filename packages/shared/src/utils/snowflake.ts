/**
 * Snowflake ID Generator
 *
 * Generates unique 64-bit IDs similar to Twitter's Snowflake system.
 *
 * Structure (64 bits total):
 * - 1 bit: Always 0 (sign bit for compatibility)
 * - 41 bits: Timestamp in milliseconds since custom epoch (2024-01-01)
 * - 10 bits: Worker/Machine ID (0-1023)
 * - 12 bits: Sequence number (0-4095)
 */

// Custom epoch: January 1, 2024 00:00:00 UTC
const EPOCH = 1704067200000n

// Bit lengths
const WORKER_BITS = 10n
const SEQUENCE_BITS = 12n

// Maximum values
const MAX_WORKER_ID = (1n << WORKER_BITS) - 1n // 1023
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n // 4095

// Bit shifts
const TIMESTAMP_SHIFT = WORKER_BITS + SEQUENCE_BITS // 22
const WORKER_SHIFT = SEQUENCE_BITS // 12

/**
 * Parsed snowflake ID components
 */
export interface SnowflakeParsed {
  timestamp: Date
  workerId: number
  sequence: number
}

/**
 * Queue item for async ID generation
 */
interface QueueItem {
  resolve: (value: string) => void
  reject: (error: Error) => void
}

/**
 * Snowflake ID Generator Class
 */
export class SnowflakeGenerator {
  private workerId: bigint
  private sequence = 0n
  private lastTimestamp = 0n
  private generating = false
  private queue: QueueItem[] = []

  constructor(workerId = 0) {
    if (workerId < 0 || workerId > Number(MAX_WORKER_ID)) {
      throw new Error(`Worker ID must be between 0 and ${MAX_WORKER_ID}`)
    }
    this.workerId = BigInt(workerId)
  }

  /**
   * Generate a new Snowflake ID (async with mutex for concurrency safety)
   */
  async generate(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject })
      this.processQueue()
    })
  }

  /**
   * Process the queue of ID generation requests
   */
  private processQueue(): void {
    if (this.generating || this.queue.length === 0) {
      return
    }

    this.generating = true
    const request = this.queue.shift()
    if (!request) {
      this.generating = false
      return
    }

    const id = this.generateSync()
    request.resolve(id)
    this.generating = false

    // Process next item in queue
    if (this.queue.length > 0) {
      setImmediate(() => this.processQueue())
    }
  }

  /**
   * Generate a new Snowflake ID (synchronous, internal use)
   */
  private generateSync(): string {
    let timestamp = BigInt(Date.now()) - EPOCH

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & MAX_SEQUENCE
      if (this.sequence === 0n) {
        // Sequence exhausted, wait for next millisecond
        while (timestamp <= this.lastTimestamp) {
          timestamp = BigInt(Date.now()) - EPOCH
        }
      }
    } else {
      this.sequence = 0n
    }

    this.lastTimestamp = timestamp

    const id =
      (timestamp << TIMESTAMP_SHIFT) |
      (this.workerId << WORKER_SHIFT) |
      this.sequence

    return id.toString()
  }

  /**
   * Parse a Snowflake ID into its components
   */
  static parse(id: string): SnowflakeParsed {
    const idBigInt = BigInt(id)

    const timestamp = Number((idBigInt >> TIMESTAMP_SHIFT) + EPOCH)
    const workerId = Number((idBigInt >> WORKER_SHIFT) & MAX_WORKER_ID)
    const sequence = Number(idBigInt & MAX_SEQUENCE)

    return {
      timestamp: new Date(timestamp),
      workerId,
      sequence,
    }
  }
}

// Default generator instance
let defaultGenerator: SnowflakeGenerator | null = null

/**
 * Get or create the default generator
 */
function getDefaultGenerator(): SnowflakeGenerator {
  if (!defaultGenerator) {
    // Use process ID as worker ID (mod 1024 for safety)
    const workerId = (process.pid || 0) % 1024
    defaultGenerator = new SnowflakeGenerator(workerId)
  }
  return defaultGenerator
}

/**
 * Generate a new Snowflake ID using the default generator
 */
export async function generateSnowflakeId(): Promise<string> {
  return getDefaultGenerator().generate()
}

/**
 * Parse a Snowflake ID into its components
 */
export function parseSnowflakeId(id: string): SnowflakeParsed {
  return SnowflakeGenerator.parse(id)
}

/**
 * Validate a Snowflake ID
 */
export function isValidSnowflakeId(id: string): boolean {
  try {
    const idBigInt = BigInt(id)
    // Must be positive and fit in 64 bits
    return idBigInt > 0n && idBigInt < 2n ** 64n
  } catch {
    return false
  }
}
