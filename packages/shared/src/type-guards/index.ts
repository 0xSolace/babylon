/**
 * Type Guards Module
 *
 * Centralized type guards for the Babylon application.
 * Import guards from here for consistent type validation across the codebase.
 *
 * @packageDocumentation
 */

// Re-export nullish guards from Jeju shared
export { isNotNullish, isNullish } from '@jejunetwork/shared'
// Base type guards - objects, arrays, primitives
export {
  // Generic utilities
  assertDefined,
  assertNotNull,
  // JSON parsing
  fetchJsonAs,
  // Error handling
  getErrorMessage,
  // Property checks
  hasArrayProperty,
  hasBooleanProperty,
  hasNumberProperty,
  hasProperty,
  hasStringProperty,
  // Primitive guards
  isArray,
  isArrayOf,
  isBoolean,
  isDate,
  isFiniteNumber,
  isJsonRecord,
  isJsonValue,
  isNonEmptyString,
  isNumber,
  isNumberArray,
  isObject,
  isPlainObject,
  isPositiveInteger,
  isString,
  isStringArray,
  isStringRecord,
  isUint8Array,
  parseJson,
  parseJsonAs,
  responseJson,
  toError,
  // JSON value converters
  toJsonRecord,
  toJsonValueOrNull,
  toStringArray,
} from './base'
// Blockchain type guards - addresses, hex, networks
export {
  // Agent0 ID guards
  type Agent0Id,
  // Endpoint type guards
  type EndpointType,
  // IPFS response guards
  extractIpfsCid,
  formatAgent0Id,
  // IPFS response type
  type IpfsAddResponse,
  // IPFS provider guards
  type IpfsProvider,
  // Address guards
  isAddress,
  isAddressArray,
  isAgent0Id,
  // Contract return value guards
  isBigint,
  isBigintArray,
  isBigintTuple3,
  isBigintTuple6,
  isEndpointType,
  // Hex guards
  isHex,
  isHexAddress,
  isIpfsAddResponse,
  isIpfsProvider,
  // Jeju network guards
  isJejuNetwork,
  isNetworkName,
  isReadonlyAddressArray,
  // Transaction hash guards
  isTransactionHash,
  isValidAddress,
  isValidHex,
  type JejuNetwork,
  // Network guards
  type NetworkName,
  parseAgent0Id,
  parseIpfsResponse,
  toAddress,
  toAddressArray,
  toAddressArraySafe,
  toAddressOrDefault,
  toAddressOrNull,
  toAgent0Id,
  toAgent0IdOrNull,
  toEndpointType,
  toHexOrNull,
  toHexString,
  toIpfsProvider,
  toJejuNetwork,
  toNetworkName,
  toTransactionHash,
  toTransactionHashOrNull,
} from './blockchain'
// Entity type guards - companies, users, actors
export {
  type ActorEntity,
  type CompanyEntity,
  type EntityMention,
  isActorEntity,
  isCompanyEntity,
  isUserEntity,
  type UserEntity,
} from './entities'
// Game type guards - actors, organizations, events
// Note: ActorTier is exported from game-types.ts, not here (to avoid duplicate exports)
// Note: Error guards (isError, toError, toErrorMessage) are now exported from base.ts
export {
  // Actor role guards
  type ActorRole,
  extractLLMField,
  // Filter helpers
  filterMap,
  hasLLMField,
  isActorRole,
  isActorTier,
  // Defined filter helper
  isDefined,
  isLuckLevel,
  // Market type guards (MarketType type exported from validation/schemas/game-engine)
  isMarketType,
  isOrganizationType,
  // Points toward guards
  isPointsToward,
  isQuestionStatus,
  isWorldEventType,
  isWorldEventVisibility,
  // Luck level guards
  type LuckLevel,
  // LLM response guards
  type MaybeWrappedResponse,
  // Organization type guards
  type OrganizationType,
  // Points toward type
  type PointsToward,
  // Question status guards
  type QuestionStatus,
  toActorRole,
  toActorTier,
  toLuckLevel,
  toMarketType,
  toOrganizationType,
  toPointsToward,
  toQuestionStatus,
  // String array guards
  toStringArraySafe,
  toWorldEventType,
  toWorldEventVisibility,
  unwrapLLMResponse,
  // World event type guards
  type WorldEventType,
  // World event visibility guards
  type WorldEventVisibility,
} from './game'
