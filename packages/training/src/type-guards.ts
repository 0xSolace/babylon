/**
 * Training Type Guards
 *
 * Training-specific type guards.
 */

import { isAddress } from '@babylon/shared'
import {
  isArrayOf,
  isJsonValue,
  isObject,
  isString,
  type JsonValue,
} from '@jejunetwork/shared'

export { isAddress, isArrayOf, isObject, isString }

// ============================================================================
// Environment Type Guards (Training-specific)
// ============================================================================

/** Valid TEE providers */
export const TEE_PROVIDERS = [
  'phala',
  'intel-sgx',
  'intel-tdx',
  'amd-sev',
  'simulated',
] as const

export type TEEProvider = (typeof TEE_PROVIDERS)[number]

/**
 * Check if value is a valid TEE provider
 */
export function isTEEProvider(value: unknown): value is TEEProvider {
  return isString(value) && (TEE_PROVIDERS as readonly string[]).includes(value)
}

/** Valid GPU providers */
export const GPU_PROVIDERS = ['onchain', 'cloud', 'local'] as const
export type GPUProvider = (typeof GPU_PROVIDERS)[number]

/**
 * Check if value is a valid GPU provider
 */
export function isGPUProvider(value: unknown): value is GPUProvider {
  return isString(value) && (GPU_PROVIDERS as readonly string[]).includes(value)
}

// ============================================================================
// API Response Type Guards (Training-specific)
// ============================================================================

/**
 * Response with a CID field
 */
export interface CIDResponse {
  cid: string
}

export function isCIDResponse(value: unknown): value is CIDResponse {
  return isObject(value) && isString(value.cid)
}

/**
 * Response with a runId field
 */
export interface RunIdResponse {
  runId: string
}

export function isRunIdResponse(value: unknown): value is RunIdResponse {
  return isObject(value) && isString(value.runId)
}

/**
 * GPU rental response
 */
export interface GPURentalResponse {
  rentalId: string
  providerAddress: string
  sshHost: string
  sshPort: number
  expiresAt: number
  costWei: string
}

export function isGPURentalResponse(
  value: unknown,
): value is GPURentalResponse {
  return (
    isObject(value) &&
    isString(value.rentalId) &&
    isString(value.providerAddress) &&
    isString(value.sshHost) &&
    typeof value.sshPort === 'number' &&
    typeof value.expiresAt === 'number' &&
    isString(value.costWei)
  )
}

/**
 * GPU rental status response
 */
export interface GPURentalStatusResponse {
  status: string
  modelCID?: string
  modelHash?: string
  error?: string
}

export function isGPURentalStatusResponse(
  value: unknown,
): value is GPURentalStatusResponse {
  return isObject(value) && isString(value.status)
}

/**
 * TEE initialization response
 */
export interface TEEInitResponse {
  operatorAddress: string
  attestation: string
}

export function isTEEInitResponse(value: unknown): value is TEEInitResponse {
  return (
    isObject(value) &&
    isString(value.operatorAddress) &&
    isString(value.attestation)
  )
}

/**
 * Training result response from compute service
 */
export interface TrainingComputeResponse {
  trainedModel: Record<string, JsonValue>
  finalLoss: number
}

export function isTrainingComputeResponse(
  value: unknown,
): value is TrainingComputeResponse {
  return (
    isObject(value) &&
    isObject(value.trainedModel) &&
    typeof value.finalLoss === 'number'
  )
}

/**
 * Simulation result response
 */
export interface SimulationResultResponse {
  pnl: number
  trades: number
}

export function isSimulationResultResponse(
  value: unknown,
): value is SimulationResultResponse {
  return (
    isObject(value) &&
    typeof value.pnl === 'number' &&
    typeof value.trades === 'number'
  )
}

/**
 * LLM judging score response (also used as scored data format)
 */
export interface JudgingScoreResponse {
  score: number
  trajectory: Record<string, JsonValue>
}

export function isJudgingScoreResponse(
  value: unknown,
): value is JudgingScoreResponse {
  return (
    isObject(value) &&
    typeof value.score === 'number' &&
    isObject(value.trajectory)
  )
}

/**
 * Scored training data format
 */
export type ScoredTrainingData = JudgingScoreResponse

export const isScoredTrainingData = isJudgingScoreResponse

/**
 * Generic object guard for unstructured data (e.g., trajectory steps)
 * @deprecated Use isObject from @babylon/shared instead
 */
export const isGenericObject = isObject

// ============================================================================
// JSON Parsing Guards
// ============================================================================

/**
 * Guard for trajectory steps array from JSON
 */
export interface ParsedTrajectoryStep {
  timestamp?: number
  environmentState?: Record<string, unknown>
  providerAccesses?: Array<{
    providerName: string
    data?: Record<string, unknown>
    purpose: string
  }>
  llmCalls?: Array<{
    model: string
    modelVersion?: string
    systemPrompt?: string
    userPrompt?: string
    response?: string
    reasoning?: string
    temperature?: number
    maxTokens?: number
    latencyMs?: number
    purpose?: string
    actionType?: string
  }>
  action?: {
    actionType: string
    parameters?: Record<string, unknown>
    reasoning?: string
    success?: boolean
    result?: Record<string, unknown>
    error?: string
  }
  reward?: number
}

export function isParsedTrajectoryStep(
  value: unknown,
): value is ParsedTrajectoryStep {
  return isObject(value)
}

/**
 * Guard for RULER judge response
 */
export interface RulerJudgeResponse {
  scores: Array<{
    trajectory_id: string
    explanation: string
    score: number
  }>
}

export function isRulerJudgeResponse(
  value: unknown,
): value is RulerJudgeResponse {
  return (
    isObject(value) &&
    Array.isArray(value.scores) &&
    value.scores.every(
      (s: unknown) =>
        isObject(s) &&
        isString(s.trajectory_id) &&
        isString(s.explanation) &&
        typeof s.score === 'number',
    )
  )
}

/**
 * Guard for judge prompt data
 */
export interface JudgePromptData {
  system: string
  user: string
}

export function isJudgePromptData(value: unknown): value is JudgePromptData {
  return isObject(value) && isString(value.system) && isString(value.user)
}

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Encrypted payload from storage
 */
export interface EncryptedPayload {
  ciphertext: string
  dataHash: string
  accessControlConditions: unknown[]
  accessControlConditionType: 'unified'
  encryptedSymmetricKey: string
  chain?: string
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return (
    isObject(value) &&
    isString(value.ciphertext) &&
    isString(value.dataHash) &&
    Array.isArray(value.accessControlConditions) &&
    value.accessControlConditionType === 'unified' &&
    isString(value.encryptedSymmetricKey)
  )
}

/**
 * RLAIF run status response
 */
export interface RLAIFRunStatusResponse {
  state: number
  currentIteration: number
  bestPolicyCID?: string
  bestEvalScore?: number
}

export function isRLAIFRunStatusResponse(
  value: unknown,
): value is RLAIFRunStatusResponse {
  return (
    isObject(value) &&
    typeof value.state === 'number' &&
    typeof value.currentIteration === 'number'
  )
}

// ============================================================================
// Simulation State Types (Training-specific)
// ============================================================================

/**
 * Prediction market in simulation state
 */
export interface SimulationPredictionMarket {
  id: string
  question: string
  yesShares: number
  noShares: number
  yesPrice: number
  noPrice: number
  liquidity: number
  totalVolume: number
  createdAt: number
  resolveAt: number
  resolved: boolean
}

/** Type guard for SimulationPredictionMarket */
export function isSimulationPredictionMarket(
  value: unknown,
): value is SimulationPredictionMarket {
  return (
    isObject(value) &&
    isString(value.id) &&
    typeof value.yesPrice === 'number' &&
    typeof value.noPrice === 'number'
  )
}

/**
 * Perpetual market in simulation state
 */
export interface SimulationPerpetualMarket {
  ticker: string
  price: number
  priceChange24h?: number
  volume24h: number
  openInterest: number
  fundingRate: number
  nextFundingTime?: number
}

/** Type guard for SimulationPerpetualMarket */
export function isSimulationPerpetualMarket(
  value: unknown,
): value is SimulationPerpetualMarket {
  return (
    isObject(value) && isString(value.ticker) && typeof value.price === 'number'
  )
}

/**
 * Feed post in simulation state
 */
export interface SimulationFeedPost {
  id: string
  authorId: string
  authorName: string
  content: string
  createdAt: number
  likes: number
  comments: number
  marketId?: string
}

/** Type guard for SimulationFeedPost */
export function isSimulationFeedPost(
  value: unknown,
): value is SimulationFeedPost {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.authorId) &&
    isString(value.content)
  )
}

/**
 * Group chat in simulation state
 */
export interface SimulationGroupChat {
  id: string
  name: string
  memberIds: string[]
  messageCount: number
  lastActivity: number
  invitedAgent?: boolean
  messages?: Array<{
    id: string
    authorId: string
    authorName: string
    content: string
    timestamp: number
  }>
}

/** Type guard for SimulationGroupChat */
export function isSimulationGroupChat(
  value: unknown,
): value is SimulationGroupChat {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.name) &&
    Array.isArray(value.memberIds)
  )
}

/**
 * Agent in simulation state
 */
export interface SimulationAgent {
  id: string
  totalPnl?: number
}

/** Type guard for SimulationAgent */
export function isSimulationAgent(value: unknown): value is SimulationAgent {
  return isObject(value) && isString(value.id)
}

/**
 * Full simulation state
 */
export interface SimulationState {
  tick: number
  initialized: boolean
  predictionMarkets: SimulationPredictionMarket[]
  perpetualMarkets: SimulationPerpetualMarket[]
  posts?: SimulationFeedPost[]
  groupChats?: SimulationGroupChat[]
  agents: SimulationAgent[]
}

/** Type guard for SimulationState */
export function isSimulationState(value: unknown): value is SimulationState {
  return (
    isObject(value) &&
    typeof value.tick === 'number' &&
    typeof value.initialized === 'boolean' &&
    Array.isArray(value.predictionMarkets) &&
    Array.isArray(value.perpetualMarkets) &&
    Array.isArray(value.agents)
  )
}

// ============================================================================
// IPFS Response Guards
// ============================================================================

/**
 * IPFS upload result
 */
export interface IPFSUploadResult {
  cid: string
  size?: number
  name?: string
}

/** Type guard for IPFSUploadResult */
export function isIPFSUploadResult(value: unknown): value is IPFSUploadResult {
  return isObject(value) && isString(value.cid)
}

// ============================================================================
// JSON Value Conversion Helpers
// ============================================================================

/**
 * Convert a parsed JSON object to Record<string, JsonValue>
 */
export function toJsonValueRecord(
  obj: Record<string, unknown> | undefined,
): Record<string, JsonValue> {
  if (!obj) return {}
  const result: Record<string, JsonValue> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (isJsonValue(value)) {
      result[key] = value
    }
  }
  return result
}

/**
 * Normalize LLM purpose to valid enum value
 */
export function toLLMPurpose(
  purpose: string | undefined,
): 'action' | 'reasoning' | 'evaluation' | 'response' | 'other' {
  const valid = ['action', 'reasoning', 'evaluation', 'response', 'other']
  if (purpose && valid.includes(purpose)) {
    return purpose as
      | 'action'
      | 'reasoning'
      | 'evaluation'
      | 'response'
      | 'other'
  }
  return 'other'
}

// ============================================================================
// Type Coercion Helpers (with validation)
// ============================================================================

/**
 * Coerce a string to uppercase position side
 * @throws if value is not a valid position side
 */
export function toPositionSide(value: string): 'LONG' | 'SHORT' {
  const upper = value.toUpperCase()
  if (upper === 'LONG' || upper === 'SHORT') {
    return upper
  }
  throw new Error(`Invalid position side: ${value}`)
}

// ============================================================================
// Benchmark Type Guards
// ============================================================================

/**
 * Guard for BenchmarkGameSnapshot loaded from JSON files.
 */
export function isBenchmarkGameSnapshot(
  value: unknown,
): value is { id: string; initialState: unknown; groundTruth: unknown } {
  return (
    isObject(value) &&
    isString(value.id) &&
    isObject(value.initialState) &&
    isObject(value.groundTruth)
  )
}
