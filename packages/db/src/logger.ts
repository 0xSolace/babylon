/**
 * Database Logger
 *
 * Provides access to the shared Logger from @babylon/shared.
 * The shared Logger provides structured logging with configurable levels
 * and environment awareness.
 */

import { type Logger, logger } from '@babylon/shared'

/**
 * Get the logger instance (for compatibility with existing code).
 * @returns The shared logger singleton
 */
export function getLogger(): Logger {
  return logger
}

export { logger }
