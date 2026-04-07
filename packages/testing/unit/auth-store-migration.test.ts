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
  test('migrates persisted auth data from legacy versions, strips ephemeral fields', () => {
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
      },
      1
    );

    // isLoadingProfile and needsOnboarding are ephemeral — not persisted
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
    });
  });

  test('falls back to the default state for malformed persisted payloads', () => {
    expect(migrateAuthStoreState('invalid', 1)).toEqual({
      user: null,
      wallet: null,
      loadedUserId: null,
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
    });
  });

  test('migrates version 2 and 3 payloads and strips ephemeral fields', () => {
    for (const version of [2, 3]) {
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
        },
        version
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
      });
    }
  });

  test('drops partial user objects that do not satisfy the persisted user guard', () => {
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

  test('drops partial wallet objects that do not satisfy the persisted wallet guard', () => {
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
      5
    );

    expect(migrated).toEqual({
      user: null,
      wallet: null,
      loadedUserId: null,
    });
  });
});
