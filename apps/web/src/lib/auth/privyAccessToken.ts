const RETRYABLE_PRIVY_ERROR_MESSAGES = [
  'failed to fetch',
  'fetch failed',
  'load failed',
  'networkerror',
  'network request failed',
  'timed out',
  'timeout',
  'session',
] as const;

export interface PrivyAccessTokenRetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

export function isRetryablePrivyAccessTokenError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return error.message.toLowerCase().includes('fetch');
  }

  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') {
      return status === 408 || status === 429 || status >= 500;
    }
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error);

  return RETRYABLE_PRIVY_ERROR_MESSAGES.some((pattern) =>
    message.includes(pattern)
  );
}

export async function getPrivyAccessTokenWithRetry(
  getAccessToken: () => Promise<string | null>,
  options: PrivyAccessTokenRetryOptions = {}
): Promise<string | null> {
  const {
    maxAttempts = 3,
    initialDelayMs = 250,
    maxDelayMs = 1000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await getAccessToken();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (
        !isRetryablePrivyAccessTokenError(error) ||
        attempt === maxAttempts - 1
      ) {
        throw error;
      }

      const delayMs = Math.min(
        initialDelayMs * backoffMultiplier ** attempt,
        maxDelayMs
      );
      onRetry?.(attempt + 1, lastError, delayMs);
      await sleep(delayMs);
    }
  }

  throw lastError ?? new Error('Failed to fetch Privy access token');
}
