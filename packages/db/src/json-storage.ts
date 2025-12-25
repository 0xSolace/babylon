/**
 * JSON Storage Backend for @babylon/db
 *
 * Provides a file-based storage implementation that mirrors the PostgreSQL interface.
 * Used for simulation, training data generation, and debugging.
 *
 * Usage:
 * ```typescript
 * import { initJsonStorage, db } from '@babylon/db';
 *
 * // Initialize JSON mode
 * await initJsonStorage('./simulation-data');
 *
 * // Use db exactly like with PostgreSQL
 * const user = await db.user.create({ data: { ... } });
 * const posts = await db.post.findMany({ where: { authorId: user.id } });
 *
 * // Save snapshot
 * await saveJsonSnapshot();
 * ```
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { first } from '@jejunetwork/shared'
import {
  isDate,
  isDecrementOp,
  isIncrementOp,
  isJsonValue,
  isPlainObject,
} from './type-guards'
import type { JsonValue } from './types'

// ============================================================================
// Types
// ============================================================================

export type StorageMode = 'cql' | 'postgres' | 'json' | 'memory'

// Current storage mode - defaults to cql (decentralized)
let currentStorageMode: StorageMode = 'cql'

interface JsonStorageState {
  metadata: {
    version: string
    createdAt: string
    updatedAt: string
    mode: StorageMode
  }
  tables: Record<string, Record<string, JsonRecord>>
  counters: Record<string, number>
}

/**
 * Type guard to validate and narrow an unknown value to JsonStorageState.
 * Performs runtime validation of the expected structure.
 */
function isJsonStorageState(value: unknown): value is JsonStorageState {
  if (!isPlainObject(value)) return false

  // Check required top-level properties exist
  if (
    !('metadata' in value) ||
    !('tables' in value) ||
    !('counters' in value)
  ) {
    return false
  }

  // Validate metadata structure
  const metadata = value.metadata
  if (
    !isPlainObject(metadata) ||
    typeof metadata.version !== 'string' ||
    typeof metadata.createdAt !== 'string' ||
    typeof metadata.updatedAt !== 'string' ||
    typeof metadata.mode !== 'string'
  ) {
    return false
  }

  // Validate tables is an object (detailed validation happens lazily)
  if (!isPlainObject(value.tables)) return false

  // Validate counters is an object with number values
  if (!isPlainObject(value.counters)) return false

  return true
}

type JsonRecord = Record<string, JsonValue | Date | undefined>

interface FindOptions<T> {
  where?: WhereInput<T>
  orderBy?: OrderByInput<T> | OrderByInput<T>[]
  take?: number
  skip?: number
  include?: Record<string, boolean>
}

type WhereValue<T> =
  | T
  | {
      equals?: T
      not?: T
      in?: T[]
      notIn?: T[]
      lt?: T
      lte?: T
      gt?: T
      gte?: T
      contains?: string
    }
  | null
  | undefined

type WhereInput<T> = {
  [K in keyof T]?: WhereValue<T[K]>
} & {
  AND?: WhereInput<T> | WhereInput<T>[]
  OR?: WhereInput<T>[]
  NOT?: WhereInput<T>
}

type OrderByInput<T> = { [K in keyof T]?: 'asc' | 'desc' }

// ============================================================================
// State Management
// ============================================================================

let storageState: JsonStorageState | null = null
let storagePath: string | null = null
let autoSave = true

function createEmptyState(): JsonStorageState {
  return {
    metadata: {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mode: 'json',
    },
    tables: {},
    counters: {},
  }
}

function getState(): JsonStorageState {
  if (!storageState) {
    storageState = createEmptyState()
  }
  return storageState
}

function getTable(tableName: string): Record<string, JsonRecord> {
  const state = getState()
  if (!state.tables[tableName]) {
    state.tables[tableName] = {}
  }
  return state.tables[tableName]
}

function generateId(tableName: string): string {
  const state = getState()
  if (!state.counters[tableName]) {
    state.counters[tableName] = 0
  }
  state.counters[tableName]++
  const timestamp = Date.now()
  const counter = state.counters[tableName]
  return `json-${tableName}-${timestamp}-${counter}`
}

// ============================================================================
// Query Matching
// ============================================================================

function matchesWhere<T extends object>(
  record: T,
  where: WhereInput<T> | undefined,
): boolean {
  if (!where) return true

  // Handle AND
  if (where.AND) {
    const andConditions = Array.isArray(where.AND) ? where.AND : [where.AND]
    if (!andConditions.every((w) => matchesWhere(record, w))) return false
  }

  // Handle OR
  if (where.OR) {
    if (!where.OR.some((w) => matchesWhere(record, w))) return false
  }

  // Handle NOT
  if (where.NOT) {
    if (matchesWhere(record, where.NOT)) return false
  }

  // Handle field conditions
  const recordObj = record as Record<string, unknown>
  for (const [key, condition] of Object.entries(where)) {
    if (key === 'AND' || key === 'OR' || key === 'NOT') continue

    const value = recordObj[key]

    if (condition === null) {
      if (value !== null && value !== undefined) return false
      continue
    }

    if (condition === undefined) continue

    if (isPlainObject(condition) && !isDate(condition)) {
      const ops = condition

      if ('equals' in ops) {
        if (value !== ops.equals) return false
      }
      if ('not' in ops) {
        if (value === ops.not) return false
      }
      if ('in' in ops && Array.isArray(ops.in)) {
        const inValues = ops.in
        if (!inValues.some((v) => v === value)) return false
      }
      if ('notIn' in ops && Array.isArray(ops.notIn)) {
        const notInValues = ops.notIn
        if (notInValues.some((v) => v === value)) return false
      }
      if ('lt' in ops && typeof ops.lt === 'number') {
        if (typeof value !== 'number' || value >= ops.lt) return false
      }
      if ('lte' in ops && typeof ops.lte === 'number') {
        if (typeof value !== 'number' || value > ops.lte) return false
      }
      if ('gt' in ops && typeof ops.gt === 'number') {
        if (typeof value !== 'number' || value <= ops.gt) return false
      }
      if ('gte' in ops && typeof ops.gte === 'number') {
        if (typeof value !== 'number' || value < ops.gte) return false
      }
      if ('contains' in ops && typeof ops.contains === 'string') {
        if (typeof value !== 'string' || !value.includes(ops.contains))
          return false
      }
    } else {
      // Direct equality
      if (value !== condition) return false
    }
  }

  return true
}

function sortRecords<T extends object>(
  records: T[],
  orderBy: OrderByInput<T> | OrderByInput<T>[] | undefined,
): T[] {
  if (!orderBy) return records

  const orders = Array.isArray(orderBy) ? orderBy : [orderBy]

  return [...records].sort((a, b) => {
    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>
    for (const order of orders) {
      for (const [key, direction] of Object.entries(order)) {
        const aVal = aObj[key]
        const bVal = bObj[key]

        if (aVal === bVal) continue
        if (aVal === null || aVal === undefined)
          return direction === 'asc' ? 1 : -1
        if (bVal === null || bVal === undefined)
          return direction === 'asc' ? -1 : 1

        const comparison = aVal < bVal ? -1 : 1
        return direction === 'desc' ? -comparison : comparison
      }
    }
    return 0
  })
}

// ============================================================================
// JSON Table Repository
// ============================================================================

/**
 * Helper to get a property value from a record by key.
 * Uses type assertion since schema types don't have index signatures.
 */
function getRecordValue(
  record: object,
  key: string,
): JsonValue | Date | undefined {
  return (record as Record<string, JsonValue | Date | undefined>)[key]
}

/**
 * JSON-backed table repository that mirrors the PostgreSQL TableRepository interface.
 * Uses `object` constraint to allow schema types without index signatures.
 */
export class JsonTableRepository<
  TSelect extends object,
  TInsert extends object = Partial<TSelect>,
> {
  constructor(
    private readonly tableName: string,
    private readonly idField: string = 'id',
  ) {}

  /** Get all records from this table, typed as TSelect */
  private getRecords(): TSelect[] {
    const table = getTable(this.tableName)
    // Records stored in the table conform to TSelect by construction
    // (they were inserted via create/update which accepts TInsert)
    return Object.values(table) as TSelect[]
  }

  async findUnique(options: FindOptions<TSelect>): Promise<TSelect | null> {
    const records = this.getRecords()
    const matching = records.filter((r) => matchesWhere(r, options.where))
    return first(matching)
  }

  async findUniqueOrThrow(options: FindOptions<TSelect>): Promise<TSelect> {
    const result = await this.findUnique(options)
    if (!result) throw new Error(`Record not found in ${this.tableName}`)
    return result
  }

  async findFirst(options: FindOptions<TSelect> = {}): Promise<TSelect | null> {
    let records = this.getRecords()
    records = records.filter((r) => matchesWhere(r, options.where))
    records = sortRecords(records, options.orderBy)
    if (options.skip) records = records.slice(options.skip)
    return first(records)
  }

  async findFirstOrThrow(options: FindOptions<TSelect> = {}): Promise<TSelect> {
    const result = await this.findFirst(options)
    if (!result) throw new Error(`Record not found in ${this.tableName}`)
    return result
  }

  async findMany(options: FindOptions<TSelect> = {}): Promise<TSelect[]> {
    let records = this.getRecords()
    records = records.filter((r) => matchesWhere(r, options.where))
    records = sortRecords(records, options.orderBy)
    if (options.skip) records = records.slice(options.skip)
    if (options.take) records = records.slice(0, options.take)
    return records
  }

  async create(options: { data: TInsert }): Promise<TSelect> {
    const table = getTable(this.tableName)
    // Cast to JsonRecord for internal storage operations
    const data: JsonRecord = { ...options.data } as JsonRecord

    // Generate ID if not provided
    if (!data[this.idField]) {
      data[this.idField] = generateId(this.tableName)
    }

    // Set timestamps
    if (!data.createdAt) data.createdAt = new Date()
    if (!data.updatedAt) data.updatedAt = new Date()

    const id = String(data[this.idField])
    table[id] = data

    onStateChange()
    // Data conforms to TSelect by construction
    return data as TSelect
  }

  async createMany(options: {
    data: TInsert[]
    skipDuplicates?: boolean
  }): Promise<{ count: number }> {
    let count = 0
    for (const item of options.data) {
      const id = item[this.idField as keyof TInsert]
      if (options.skipDuplicates && id) {
        const table = getTable(this.tableName)
        if (table[String(id)]) continue
      }
      await this.create({ data: item })
      count++
    }
    return { count }
  }

  async update(options: {
    where: WhereInput<TSelect>
    data: Partial<TInsert>
  }): Promise<TSelect> {
    const record = await this.findFirst({ where: options.where })
    if (!record) throw new Error(`Record not found in ${this.tableName}`)

    const table = getTable(this.tableName)
    const id = String(getRecordValue(record, this.idField))

    // Handle increment/decrement operations
    const updateData: JsonRecord = {}
    for (const [key, value] of Object.entries(options.data)) {
      if (isIncrementOp(value)) {
        const currentVal = getRecordValue(record, key)
        const current = typeof currentVal === 'number' ? currentVal : 0
        updateData[key] = current + value.increment
      } else if (isDecrementOp(value)) {
        const currentVal = getRecordValue(record, key)
        const current = typeof currentVal === 'number' ? currentVal : 0
        updateData[key] = current - value.decrement
      } else if (isDate(value)) {
        updateData[key] = value
      } else if (isJsonValue(value)) {
        updateData[key] = value
      }
    }

    const updated = { ...record, ...updateData, updatedAt: new Date() }
    table[id] = updated as JsonRecord

    onStateChange()
    return updated
  }

  async updateMany(options: {
    where: WhereInput<TSelect>
    data: Partial<TInsert>
  }): Promise<{ count: number }> {
    const records = await this.findMany({ where: options.where })
    for (const record of records) {
      const idValue = getRecordValue(record, this.idField)
      await this.update({
        where: { [this.idField]: idValue } as WhereInput<TSelect>,
        data: options.data,
      })
    }
    return { count: records.length }
  }

  async delete(options: { where: WhereInput<TSelect> }): Promise<TSelect> {
    const record = await this.findFirst({ where: options.where })
    if (!record) throw new Error(`Record not found in ${this.tableName}`)

    const table = getTable(this.tableName)
    const id = String(getRecordValue(record, this.idField))
    delete table[id]

    onStateChange()
    return record
  }

  async deleteMany(
    options: { where?: WhereInput<TSelect> } = {},
  ): Promise<{ count: number }> {
    const records = await this.findMany({ where: options.where })
    const table = getTable(this.tableName)

    for (const record of records) {
      const id = String(getRecordValue(record, this.idField))
      delete table[id]
    }

    onStateChange()
    return { count: records.length }
  }

  async upsert(options: {
    where: WhereInput<TSelect>
    create: TInsert
    update: Partial<TInsert>
  }): Promise<TSelect> {
    const existing = await this.findFirst({ where: options.where })
    if (existing) {
      return this.update({ where: options.where, data: options.update })
    }
    return this.create({ data: options.create })
  }

  async count(options: { where?: WhereInput<TSelect> } = {}): Promise<number> {
    const records = await this.findMany({ where: options.where })
    return records.length
  }

  async aggregate(options: {
    where?: WhereInput<TSelect>
    _count?: boolean
    _sum?: Record<string, boolean>
    _avg?: Record<string, boolean>
    _min?: Record<string, boolean>
    _max?: Record<string, boolean>
  }): Promise<Record<string, JsonValue>> {
    const records = await this.findMany({ where: options.where })
    const result: Record<string, JsonValue> = {}

    if (options._count) {
      result._count = { _all: records.length }
    }

    if (options._sum) {
      const sums: Record<string, number | null> = {}
      for (const key of Object.keys(options._sum)) {
        if (options._sum[key]) {
          sums[key] = records.reduce((sum, r) => {
            const val = getRecordValue(r, key)
            return sum + (typeof val === 'number' ? val : 0)
          }, 0)
        }
      }
      result._sum = sums
    }

    if (options._avg) {
      const avgs: Record<string, number | null> = {}
      for (const key of Object.keys(options._avg)) {
        if (options._avg[key]) {
          const nums: number[] = []
          for (const r of records) {
            const val = getRecordValue(r, key)
            if (typeof val === 'number') nums.push(val)
          }
          avgs[key] =
            nums.length > 0
              ? nums.reduce((a, b) => a + b, 0) / nums.length
              : null
        }
      }
      result._avg = avgs
    }

    return result
  }

  async groupBy<TKey extends keyof TSelect>(options: {
    by: TKey[]
    where?: WhereInput<TSelect>
    _count?: boolean
  }): Promise<Array<Record<string, JsonValue>>> {
    const records = await this.findMany({ where: options.where })
    const groups = new Map<string, TSelect[]>()

    for (const record of records) {
      const key = options.by
        .map((k) => String(getRecordValue(record, k as string)))
        .join('|')
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)?.push(record)
    }

    return Array.from(groups.entries()).map(([, groupRecords]) => {
      const result: Record<string, JsonValue> = {}
      const firstRecord = groupRecords[0]
      if (!firstRecord) return result

      for (const key of options.by) {
        const val = getRecordValue(firstRecord, key as string)
        if (isJsonValue(val)) {
          result[key as string] = val
        }
      }

      if (options._count) {
        result._count = groupRecords.length
      }

      return result
    })
  }
}

// ============================================================================
// State Change Handler
// ============================================================================

function onStateChange(): void {
  if (autoSave && storagePath) {
    void saveJsonSnapshot()
  }
}

// ============================================================================
// Public API
// ============================================================================

/** Initialize JSON storage mode */
export async function initJsonStorage(
  basePath: string,
  options: { autoSave?: boolean } = {},
): Promise<void> {
  storagePath = basePath
  autoSave = options.autoSave ?? true

  // Ensure directory exists
  if (!existsSync(basePath)) {
    mkdirSync(basePath, { recursive: true })
  }

  // Load existing state if available
  const statePath = join(basePath, 'state.json')
  if (existsSync(statePath)) {
    const data = readFileSync(statePath, 'utf-8')
    const parsed: unknown = JSON.parse(data)
    // Use type guard to validate and narrow the parsed data
    if (isJsonStorageState(parsed)) {
      storageState = parsed
    } else {
      storageState = createEmptyState()
    }
  } else {
    storageState = createEmptyState()
  }
}

/** Save current state to JSON file */
export async function saveJsonSnapshot(): Promise<void> {
  if (!storagePath || !storageState) return

  const statePath = join(storagePath, 'state.json')
  storageState.metadata.updatedAt = new Date().toISOString()
  writeFileSync(statePath, JSON.stringify(storageState, null, 2))
}

/** Load state from JSON file */
export async function loadJsonSnapshot(path: string): Promise<void> {
  const data = readFileSync(path, 'utf-8')
  const parsed: unknown = JSON.parse(data)
  // Use type guard to validate and narrow the parsed data
  if (isJsonStorageState(parsed)) {
    storageState = parsed
  } else {
    throw new Error('Invalid JSON storage state format')
  }
}

/** Export state to a specific JSON file */
export async function exportJsonState(path: string): Promise<void> {
  if (!storageState) return
  storageState.metadata.updatedAt = new Date().toISOString()
  writeFileSync(path, JSON.stringify(storageState, null, 2))
}

/** Check if running in JSON mode */
export function isJsonMode(): boolean {
  return storageState !== null
}

/** Clear JSON storage state (for testing) */
export function clearJsonStorage(): void {
  storageState = createEmptyState()
  storagePath = null
}

/** Get raw state access (for debugging) */
export function getJsonState(): JsonStorageState | null {
  return storageState
}

// ============================================================================
// Storage Mode Management
// ============================================================================

/** Get current storage mode */
export function getStorageMode(): StorageMode {
  return currentStorageMode
}

/** Check if running in simulation mode (json or memory) */
export function isSimulationMode(): boolean {
  return currentStorageMode === 'json' || currentStorageMode === 'memory'
}

/** Initialize JSON storage mode */
export async function initializeJsonMode(basePath: string): Promise<void> {
  await initJsonStorage(basePath)
  currentStorageMode = 'json'
}

/** Initialize memory storage mode (no persistence) */
export async function initializeMemoryMode(): Promise<void> {
  storageState = createEmptyState()
  storageState.metadata.mode = 'memory'
  storagePath = null
  autoSave = false
  currentStorageMode = 'memory'
}

/** Reset to CQL mode */
export function resetToCQLMode(): void {
  storageState = null
  storagePath = null
  currentStorageMode = 'cql'
}
