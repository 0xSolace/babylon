import { describe, expect, it } from 'bun:test';
import { HttpRequestError, RpcRequestError, TimeoutError } from 'viem';
import {
  isRetryableWalletBalanceRpcError,
  retryWalletBalanceRpcOperation,
} from '../../../apps/web/src/lib/wallet-balance-rpc';

function createHttpRequestError() {
  return new HttpRequestError({
    cause: new Error('fetch failed'),
    details: 'HTTP request failed',
    url: 'https://eth.llamarpc.com',
  });
}

describe('wallet balance RPC retry', () => {
  it('classifies viem transport errors as retryable', () => {
    expect(isRetryableWalletBalanceRpcError(createHttpRequestError())).toBe(
      true
    );
    expect(
      isRetryableWalletBalanceRpcError(
        new RpcRequestError({
          body: { method: 'eth_getBalance' },
          error: { code: -32000, message: 'upstream unavailable' },
          url: 'https://eth.llamarpc.com',
        })
      )
    ).toBe(true);
    expect(
      isRetryableWalletBalanceRpcError(
        new TimeoutError({
          body: { method: 'eth_getBalance' },
          url: 'https://eth.llamarpc.com',
        })
      )
    ).toBe(true);
    expect(isRetryableWalletBalanceRpcError(new Error('nope'))).toBe(false);
  });

  it('retries transient RPC errors and eventually succeeds', async () => {
    let attempts = 0;

    const result = await retryWalletBalanceRpcOperation(
      async () => {
        attempts++;
        if (attempts < 3) {
          throw createHttpRequestError();
        }

        return 42n;
      },
      { initialDelayMs: 1, maxDelayMs: 1 }
    );

    expect(result).toBe(42n);
    expect(attempts).toBe(3);
  });

  it('does not retry non-RPC errors', async () => {
    let attempts = 0;

    await expect(
      retryWalletBalanceRpcOperation(
        async () => {
          attempts++;
          throw new Error('unexpected');
        },
        { initialDelayMs: 1, maxDelayMs: 1 }
      )
    ).rejects.toThrow('unexpected');

    expect(attempts).toBe(1);
  });

  it('stops retrying when the operation is aborted', async () => {
    const controller = new AbortController();
    let attempts = 0;

    await expect(
      retryWalletBalanceRpcOperation(
        async () => {
          attempts++;
          throw createHttpRequestError();
        },
        {
          signal: controller.signal,
          initialDelayMs: 50,
          maxDelayMs: 50,
          onRetry: () => controller.abort(),
        }
      )
    ).rejects.toThrow('Operation cancelled');

    expect(attempts).toBe(1);
  });
});
