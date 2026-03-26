import { describe, expect, it, mock } from 'bun:test';
import {
  getPrivyAccessTokenSafely,
  getPrivyAccessTokenWithRetry,
} from './privyAccessToken';

describe('privyAccessToken', () => {
  it('returns the token when the getter succeeds', async () => {
    await expect(
      getPrivyAccessTokenSafely(() => Promise.resolve('token-123'))
    ).resolves.toBe('token-123');
  });

  it('returns null and reports the error when the getter rejects with null', async () => {
    const onError = mock(() => {});

    await expect(
      getPrivyAccessTokenSafely(() => Promise.reject(null), { onError })
    ).resolves.toBeNull();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0]?.[0]?.message).toBe('null');
  });

  it('retries retryable getter failures before succeeding', async () => {
    const getAccessToken = mock<
      () => Promise<string | null>
    >(async () => {
      if (getAccessToken.mock.calls.length < 3) {
        throw new Error('Failed to fetch');
      }
      return 'recovered-token';
    });

    await expect(
      getPrivyAccessTokenWithRetry(getAccessToken, {
        initialDelayMs: 1,
        maxDelayMs: 1,
      })
    ).resolves.toBe('recovered-token');

    expect(getAccessToken).toHaveBeenCalledTimes(3);
  });
});
