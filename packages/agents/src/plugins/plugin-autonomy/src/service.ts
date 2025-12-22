/**
 * Plugin Autonomy Service Interface
 *
 * Interface definition for the autonomy service that controls agent autonomous behavior.
 */

import type { AutonomyStatus } from './types';

/**
 * Autonomy service interface for ElizaOS runtime
 *
 * Provides methods to control autonomous agent behavior including
 * enabling/disabling autonomy and configuring loop intervals.
 */
export interface AutonomyService {
  /**
   * Get current autonomy status
   */
  getStatus(): AutonomyStatus;

  /**
   * Enable autonomous behavior
   */
  enableAutonomy(): Promise<void>;

  /**
   * Disable autonomous behavior
   */
  disableAutonomy(): Promise<void>;

  /**
   * Set the autonomous loop interval in milliseconds
   */
  setLoopInterval(intervalMs: number): void;
}
