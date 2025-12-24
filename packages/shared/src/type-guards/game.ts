/**
 * Game Type Guards
 *
 * Type guards for game-related types including actors, organizations,
 * world events, and LLM response parsing.
 *
 * @packageDocumentation
 */

import type { z } from 'zod'
import type { ActorTier } from '../game-types'
// Import MarketType from validation to avoid duplicate exports
import type {
  MarketType,
  OrganizationSchema,
  WorldEventSchema,
} from '../validation/schemas/game-engine'

// Re-export ActorTier from game-types to avoid duplicate definitions
export type { ActorTier } from '../game-types'

// =============================================================================
// Luck Level Type Guards
// =============================================================================

/** Valid luck levels for actors */
export type LuckLevel = 'low' | 'medium' | 'high'

const LUCK_LEVELS = ['low', 'medium', 'high'] as const

/**
 * Type guard to check if a value is a valid LuckLevel
 */
export function isLuckLevel(value: string): value is LuckLevel {
  return (LUCK_LEVELS as readonly string[]).includes(value)
}

/**
 * Validates and returns a LuckLevel, or returns default
 */
export function toLuckLevel(
  value: string | undefined | null,
  defaultLevel: LuckLevel = 'medium',
): LuckLevel {
  if (!value || !isLuckLevel(value)) {
    return defaultLevel
  }
  return value
}

// =============================================================================
// Actor Tier Type Guards
// =============================================================================

const ACTOR_TIERS = ['S_TIER', 'A_TIER', 'B_TIER', 'C_TIER'] as const

/**
 * Type guard to check if a value is a valid ActorTier
 */
export function isActorTier(value: string): value is ActorTier {
  return (ACTOR_TIERS as readonly string[]).includes(value)
}

/**
 * Validates and returns an ActorTier, or returns default
 */
export function toActorTier(
  value: string | undefined | null,
  defaultTier: ActorTier = 'C_TIER',
): ActorTier {
  if (!value || !isActorTier(value)) {
    return defaultTier
  }
  return value
}

// =============================================================================
// Actor Role Type Guards
// =============================================================================

/** Valid actor roles in a game */
export type ActorRole = 'main' | 'supporting' | 'extra'

const ACTOR_ROLES = ['main', 'supporting', 'extra'] as const

/**
 * Type guard to check if a value is a valid ActorRole
 */
export function isActorRole(value: string): value is ActorRole {
  return (ACTOR_ROLES as readonly string[]).includes(value)
}

/**
 * Validates and returns an ActorRole, or returns default
 */
export function toActorRole(
  value: string | undefined | null,
  defaultRole: ActorRole = 'extra',
): ActorRole {
  if (!value || !isActorRole(value)) {
    return defaultRole
  }
  return value
}

// =============================================================================
// Organization Type Guards
// =============================================================================

/** Valid organization types */
export type OrganizationType = z.infer<typeof OrganizationSchema>['type']

const ORG_TYPES = [
  'company',
  'media',
  'government',
  'vc',
  'organization',
  'financial',
] as const

/**
 * Type guard to check if a value is a valid OrganizationType
 */
export function isOrganizationType(value: string): value is OrganizationType {
  return (ORG_TYPES as readonly string[]).includes(value)
}

/**
 * Validates and returns an OrganizationType, or returns default
 */
export function toOrganizationType(
  value: string | undefined | null,
  defaultType: OrganizationType = 'company',
): OrganizationType {
  if (!value || !isOrganizationType(value)) {
    return defaultType
  }
  return value
}

// =============================================================================
// World Event Type Guards
// =============================================================================

/** Valid world event types */
export type WorldEventType = z.infer<typeof WorldEventSchema>['type']

const EVENT_TYPES = [
  'announcement',
  'meeting',
  'leak',
  'development',
  'scandal',
  'rumor',
  'deal',
  'conflict',
  'revelation',
  'development:occurred',
  'news:published',
] as const

/**
 * Type guard to check if a value is a valid WorldEventType
 */
export function isWorldEventType(value: string): value is WorldEventType {
  return (EVENT_TYPES as readonly string[]).includes(value)
}

/**
 * Validates and returns a WorldEventType, or returns default
 */
export function toWorldEventType(
  value: string | undefined | null,
  defaultType: WorldEventType = 'announcement',
): WorldEventType {
  if (!value || !isWorldEventType(value)) {
    return defaultType
  }
  return value
}

/** Valid world event visibility */
export type WorldEventVisibility = z.infer<
  typeof WorldEventSchema
>['visibility']

const VISIBILITY_TYPES = [
  'public',
  'leaked',
  'secret',
  'private',
  'group',
] as const

/**
 * Type guard to check if a value is a valid WorldEventVisibility
 */
export function isWorldEventVisibility(
  value: string,
): value is WorldEventVisibility {
  return (VISIBILITY_TYPES as readonly string[]).includes(value)
}

/**
 * Validates and returns a WorldEventVisibility, or returns default
 */
export function toWorldEventVisibility(
  value: string | undefined | null,
  defaultVisibility: WorldEventVisibility = 'public',
): WorldEventVisibility {
  if (!value || !isWorldEventVisibility(value)) {
    return defaultVisibility
  }
  return value
}

// =============================================================================
// Question Status Type Guards
// =============================================================================

/** Valid question statuses */
export type QuestionStatus = 'active' | 'resolved' | 'cancelled'

const QUESTION_STATUSES = ['active', 'resolved', 'cancelled'] as const

/**
 * Type guard to check if a value is a valid QuestionStatus
 */
export function isQuestionStatus(value: string): value is QuestionStatus {
  return (QUESTION_STATUSES as readonly string[]).includes(value)
}

/**
 * Validates and returns a QuestionStatus, or returns default
 */
export function toQuestionStatus(
  value: string | undefined | null,
  defaultStatus: QuestionStatus = 'active',
): QuestionStatus {
  if (!value || !isQuestionStatus(value)) {
    return defaultStatus
  }
  return value
}

// =============================================================================
// LLM Response Type Guards
// =============================================================================

/**
 * Type for LLM responses that may have a nested 'response' wrapper
 */
export type MaybeWrappedResponse<T> = T | { response: T }

/**
 * Type guard to check if response has a 'response' wrapper
 */
function isWrappedResponse<T extends object>(
  value: MaybeWrappedResponse<T>,
): value is { response: T } {
  return (
    'response' in value &&
    value.response !== null &&
    typeof value.response === 'object'
  )
}

/**
 * Unwrap an LLM response that may have a 'response' wrapper
 * This handles the common pattern where LLM responses come wrapped in { response: ... }
 */
export function unwrapLLMResponse<T extends object>(
  response: MaybeWrappedResponse<T> | null | undefined,
): T | null {
  if (!response || typeof response !== 'object') {
    return null
  }

  // Check if response is wrapped
  if (isWrappedResponse<T>(response)) {
    return response.response
  }

  // Response is T directly (not wrapped)
  return response
}

/**
 * Extract a field from an LLM response that may be wrapped
 */
export function extractLLMField<T extends object, K extends keyof T>(
  response: MaybeWrappedResponse<T> | null | undefined,
  field: K,
): T[K] | null {
  const unwrapped = unwrapLLMResponse(response)
  if (!unwrapped) {
    return null
  }
  return field in unwrapped ? unwrapped[field] : null
}

/**
 * Type guard to check if LLM response contains a specific field
 */
export function hasLLMField<T extends object, K extends keyof T>(
  response: MaybeWrappedResponse<T> | null | undefined,
  field: K,
): response is MaybeWrappedResponse<T & { [P in K]: T[K] }> {
  const unwrapped = unwrapLLMResponse(response)
  return unwrapped !== null && field in unwrapped
}

// =============================================================================
// Market Type Guards
// =============================================================================

// Note: MarketType is exported from validation/schemas/game-engine.ts
// We only export the type guard functions here, not the type itself

const MARKET_TYPES = ['perp', 'prediction'] as const

/**
 * Type guard to check if a value is a valid MarketType
 */
export function isMarketType(value: string): value is MarketType {
  return (MARKET_TYPES as readonly string[]).includes(value)
}

/**
 * Validates and returns a MarketType, or returns default
 */
export function toMarketType(
  value: string | undefined | null,
  defaultType: MarketType = 'prediction',
): MarketType {
  if (!value || !isMarketType(value)) {
    return defaultType
  }
  return value
}

// =============================================================================
// Points Toward Type Guards
// =============================================================================

/** Valid pointsToward values for world events */
export type PointsToward = 'YES' | 'NO'

/**
 * Type guard to check if a value is a valid PointsToward
 */
export function isPointsToward(
  value: string | null | undefined,
): value is PointsToward | null | undefined {
  return (
    value === null || value === undefined || value === 'YES' || value === 'NO'
  )
}

/**
 * Validates and returns a PointsToward or undefined
 */
export function toPointsToward(
  value: string | null | undefined,
): PointsToward | undefined {
  if (value === 'YES' || value === 'NO') {
    return value
  }
  return undefined
}

// =============================================================================
// String Array Type Guards
// =============================================================================

/**
 * Safely extract a string array from unknown value
 * Use instead of `value as string[]`
 */
export function toStringArraySafe(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string')
}

// =============================================================================
// Filter Helpers (consolidate common inline type guard patterns)
// =============================================================================

/**
 * Filter predicate that removes null/undefined values with proper type narrowing.
 * Use instead of inline `.filter((x): x is NonNullable<typeof x> => x !== null)`
 *
 * @example
 * ```ts
 * const actors = ids.map(id => getActor(id)).filter(isDefined)
 * // actors is Actor[] instead of (Actor | null)[]
 * ```
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/**
 * Filter and map helper that removes null/undefined values.
 * Combines .map().filter(isDefined) into a single operation.
 *
 * @example
 * ```ts
 * const actors = filterMap(ids, id => getActor(id))
 * // actors is Actor[] instead of (Actor | null)[]
 * ```
 */
export function filterMap<T, U>(
  items: T[],
  fn: (item: T) => U | null | undefined,
): U[] {
  const result: U[] = []
  for (const item of items) {
    const mapped = fn(item)
    if (mapped !== null && mapped !== undefined) {
      result.push(mapped)
    }
  }
  return result
}
