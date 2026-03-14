/**
 * @fileoverview Local type definitions for plugin-homeostasis
 *
 * These types mirror the types from @elizaos/plugin-homeostasis.
 * We define them locally to avoid TypeScript resolution issues when
 * the homeostasis package doesn't have built type declarations.
 */

// =============================================================================
// PHYSIOLOGICAL
// =============================================================================

/**
 * Physiological state - body needs (0-100, 0=satisfied, 100=deprived)
 */
export interface Physiological {
  hunger: number;
  fatigue: number;
  hydration: number;
  health: number;
}

// =============================================================================
// PSYCHOLOGICAL DRIVES
// =============================================================================

/**
 * Psychological drives (0-100, 50=balanced)
 */
export interface Drives {
  security: number;
  social: number;
  status: number;
  autonomy: number;
  meaning: number;
}

// =============================================================================
// RESOURCES
// =============================================================================

/**
 * Resources - dynamic key-value store for resource tracking.
 * Values can be numbers or objects with a value property.
 */
export type Resources = Record<string, number | { value: number }>;

// =============================================================================
// HOMEOSTASIS STATE
// =============================================================================

/**
 * Complete homeostasis state.
 */
export interface HomeostasisState {
  physiological: Physiological;
  drives: Drives;
  resources: Resources;
}

// =============================================================================
// HOMEOSTASIS SERVICE INTERFACE
// =============================================================================

/**
 * Minimal interface for HomeostasisService that we depend on.
 */
export interface IHomeostasisService {
  getPhysiological(): Physiological;
  getDrives(): Drives;
  getResources(): Resources;
}

// =============================================================================
// HOMEOSTASIS EVENTS
// =============================================================================

/**
 * Event names from plugin-homeostasis.
 */
export const HomeostasisEvents = {
  DRIVES_UPDATED: 'HOMEOSTASIS_DRIVES_UPDATED',
  PHYSIOLOGICAL_UPDATED: 'HOMEOSTASIS_PHYSIOLOGICAL_UPDATED',
  RESOURCES_UPDATED: 'HOMEOSTASIS_RESOURCES_UPDATED',
} as const;
