/**
 * A2A Logger Utility
 *
 * @deprecated Use @/lib/logger instead. This file re-exports the main logger for backward compatibility.
 */

// Re-export logger from main logger module
export { type LogLevel, Logger, logger } from '@/lib/logger';

// Create A2A-specific logger instance with A2A_LOG_LEVEL env var
import { type LogLevel, Logger as MainLogger } from '@/lib/logger';

export const a2aLogger = new MainLogger(
  (process.env.A2A_LOG_LEVEL as LogLevel | undefined) || 'info'
);
