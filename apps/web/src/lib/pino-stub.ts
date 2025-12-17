/**
 * Browser-safe pino stub
 * Provides the API surface required by @walletconnect/logger
 */

const noop = () => {};

export const levels = {
  labels: {
    10: 'trace',
    20: 'debug',
    30: 'info',
    40: 'warn',
    50: 'error',
    60: 'fatal',
  },
  values: { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 },
} as const;

interface Logger {
  trace: () => void;
  debug: () => void;
  info: () => void;
  warn: typeof console.warn;
  error: typeof console.error;
  fatal: typeof console.error;
  child: () => Logger;
  level: string;
  silent: () => void;
}

function createLogger(): Logger {
  return {
    trace: noop,
    debug: noop,
    info: noop,
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    fatal: console.error.bind(console),
    child: createLogger,
    level: 'info',
    silent: noop,
  };
}

export function pino(): Logger {
  return createLogger();
}

pino.levels = levels;
export default pino;
