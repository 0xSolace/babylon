/**
 * Plugin Autonomy Types
 *
 * Type definitions for the autonomy plugin service.
 */

/**
 * Service type enum for ElizaOS runtime.getService()
 */
export const AutonomousServiceType = {
  AUTONOMOUS: 'autonomous',
} as const

export type AutonomousServiceType =
  (typeof AutonomousServiceType)[keyof typeof AutonomousServiceType]

/**
 * Autonomy status returned by getStatus()
 */
export interface AutonomyStatus {
  enabled: boolean
  running: boolean
  interval: number
  autonomousRoomId?: string
}
