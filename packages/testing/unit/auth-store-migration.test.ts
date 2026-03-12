import { beforeEach, describe, expect, test } from 'bun:test';

const storage = new Map<string, string>();

const storageMock = {
  getItem(key: string) {
    return storage.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    storage.set(key, value);
  },
  removeItem(key: string) {
    storage.delete(key);
  },
  clear() {
    storage.clear();
  },
  key(index: number) {
    return Array.from(storage.keys())[index] ?? null;
  },
  get length() {
    return storage.size;
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  configurable: true,
});

const { migrateAuthStoreState } = await import('@/stores/authStore');

beforeEach(() => {
  storage.clear();
});

describe('migrateAuthStoreState', () => {
  test('migrates persisted auth data from legacy versions without keeping loading state', () => {
    const migrated = migrateAuthStoreState(
      {
        user: {
          id: 'did:privy:test-user',
          displayName: 'Test User',
          username: 'test-user',
        },
        wallet: {
          address: '0x123',
          chainId: 'eip155:8453',
        },
        loadedUserId: 'did:privy:test-user',
        isLoadingProfile: true,
        needsOnboarding: true,
        needsOnchain: true,
      },
      1
    );

    expect(migrated).toEqual({
      user: {
        id: 'did:privy:test-user',
        displayName: 'Test User',
        username: 'test-user',
      },
      wallet: {
        address: '0x123',
        chainId: 'eip155:8453',
      },
      loadedUserId: 'did:privy:test-user',
      isLoadingProfile: false,
      needsOnboarding: true,
      needsOnchain: true,
    });
  });

  test('falls back to the default state for malformed persisted payloads', () => {
    expect(migrateAuthStoreState('invalid', 1)).toEqual({
      user: null,
      wallet: null,
      loadedUserId: null,
      isLoadingProfile: false,
      needsOnboarding: false,
      needsOnchain: false,
    });
  });

  test('migrates version 0 payloads (no version ever set)', () => {
    const migrated = migrateAuthStoreState(
      {
        user: {
          id: 'did:privy:test-user',
          displayName: 'Test User',
        },
        wallet: {
          address: '0xabc',
          chainId: 'eip155:1',
        },
        needsOnboarding: true,
      },
      0
    );

    expect(migrated).toEqual({
      user: {
        id: 'did:privy:test-user',
        displayName: 'Test User',
      },
      wallet: {
        address: '0xabc',
        chainId: 'eip155:1',
      },
      loadedUserId: null,
      isLoadingProfile: false,
      needsOnboarding: true,
      needsOnchain: false,
    });
  });

  test('returns null for user missing required displayName', () => {
    const migrated = migrateAuthStoreState(
      {
        user: { id: 'did:privy:test-user' },
        wallet: { address: '0x123', chainId: 'eip155:8453' },
      },
      1
    );

    expect(migrated.user).toBeNull();
    expect(migrated.wallet).toEqual({
      address: '0x123',
      chainId: 'eip155:8453',
    });
  });

  test('returns null for wallet missing required chainId', () => {
    const migrated = migrateAuthStoreState(
      {
        user: { id: 'did:privy:test-user', displayName: 'Test' },
        wallet: { address: '0x123' },
      },
      1
    );

    expect(migrated.user).toEqual({
      id: 'did:privy:test-user',
      displayName: 'Test',
    });
    expect(migrated.wallet).toBeNull();
  });

  test('drops unsupported future-version payloads instead of hydrating unknown state', () => {
    const migrated = migrateAuthStoreState(
      {
        user: {
          id: 'did:privy:test-user',
          displayName: 'Test User',
        },
        needsOnboarding: true,
      },
      3
    );

    expect(migrated).toEqual({
      user: null,
      wallet: null,
      loadedUserId: null,
      isLoadingProfile: false,
      needsOnboarding: false,
      needsOnchain: false,
    });
  });
});
