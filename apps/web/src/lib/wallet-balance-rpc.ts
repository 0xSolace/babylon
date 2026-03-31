import { HttpRequestError, RpcRequestError, TimeoutError } from 'viem';

interface RetryWalletBalanceOptions {
  signal?: AbortSignal;
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_RETRY_OPTIONS = {
  maxAttempts: 3,
  initialDelayMs: 250,
  maxDelayMs: 1000,
} as const;
const RETRYABLE_WALLET_BALANCE_ERROR_NAMES = new Set([
  'HttpRequestError',
  'RpcRequestError',
  'TimeoutError',
]);

function getCancelledError(): Error {
  return new Error('Operation cancelled');
}

export function isRetryableWalletBalanceRpcError(error: unknown): boolean {
  return (
    error instanceof HttpRequestError ||
    error instanceof RpcRequestError ||
    error instanceof TimeoutError ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      typeof error.name === 'string' &&
      RETRYABLE_WALLET_BALANCE_ERROR_NAMES.has(error.name))
  );
}

async function sleepWithSignal(
  delayMs: number,
  signal: AbortSignal | undefined
): Promise<void> {
  if (!signal) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return;
  }

  if (signal.aborted) {
    throw getCancelledError();
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', onAbort);
      reject(getCancelledError());
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function retryWalletBalanceRpcOperation<T>(
  operation: () => Promise<T>,
  options: RetryWalletBalanceOptions = {}
): Promise<T> {
  const { signal, maxAttempts, initialDelayMs, maxDelayMs, onRetry } = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw getCancelledError();
    }

    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (signal?.aborted) {
        throw getCancelledError();
      }

      if (
        !isRetryableWalletBalanceRpcError(error) ||
        attempt === maxAttempts - 1
      ) {
        throw error;
      }

      const delayMs = Math.min(initialDelayMs * 2 ** attempt, maxDelayMs);
      onRetry?.(
        attempt + 1,
        error instanceof Error ? error : new Error(String(error)),
        delayMs
      );
      await sleepWithSignal(delayMs, signal);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Wallet balance check failed');
}
