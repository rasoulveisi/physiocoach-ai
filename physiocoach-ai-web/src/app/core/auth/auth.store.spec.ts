import { TestBed } from '@angular/core/testing';

import { AuthStore } from './auth.store';

function installLocalStorage(): Storage {
  const storage = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
    key: (index: number) => Array.from(storage.keys())[index] ?? null,
    get length() {
      return storage.size;
    },
  } as Storage;

  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
  });

  return localStorageMock;
}

describe('AuthStore', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    installLocalStorage();
    localStorage.clear();
  });

  it('starts unauthenticated', () => {
    const store = TestBed.inject(AuthStore);

    expect(store.isAuthenticated()).toBe(false);
    expect(store.token()).toBeNull();
    expect(store.refreshToken()).toBeNull();
    expect(store.user()).toBeNull();
  });

  it('keeps access tokens in memory, persists only refresh tokens, and purges legacy access tokens', () => {
    localStorage.setItem('physiocoach_auth_token', 'stale-access-token');

    const store = TestBed.inject(AuthStore);
    store.setSession({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: { id: 'user-1', email: 'user@example.com', displayName: 'User One', roles: ['user'] },
    });

    expect(store.token()).toBe('access-1');
    expect(store.refreshToken()).toBe('refresh-1');
    expect(store.user()?.email).toBe('user@example.com');
    expect(localStorage.getItem('physiocoach_auth_token')).toBeNull();
    expect(localStorage.getItem('physiocoach_refresh_token')).toBe('refresh-1');
  });

  it('restores refresh tokens without restoring access tokens', () => {
    localStorage.setItem('physiocoach_refresh_token', 'refresh-1');
    localStorage.setItem('physiocoach_auth_token', 'stale-access-token');

    const store = TestBed.inject(AuthStore);

    expect(store.token()).toBeNull();
    expect(store.refreshToken()).toBe('refresh-1');
    expect(localStorage.getItem('physiocoach_auth_token')).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('clears in-memory auth and persisted refresh state', () => {
    const store = TestBed.inject(AuthStore);
    store.setSession({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: { id: 'user-1', email: 'user@example.com' },
    });

    store.clear();

    expect(store.token()).toBeNull();
    expect(store.refreshToken()).toBeNull();
    expect(store.user()).toBeNull();
    expect(localStorage.getItem('physiocoach_refresh_token')).toBeNull();
    expect(localStorage.getItem('physiocoach_auth_token')).toBeNull();
  });
});
