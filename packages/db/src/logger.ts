/**
 * Database Logger
 *
 * Re-exports the shared Logger from @babylon/shared.
 * The shared Logger provides structured logging with configurable levels
 * and environment awareness.
 */

import { Logger, type LogLevel, logger } from '@babylon/shared';

export { Logger, type LogLevel, logger };

/**
 * Get the logger instance (for compatibility with existing code).
 * @returns The shared logger singleton
 */
export function getLogger(): Logger {
  return logger;
}
