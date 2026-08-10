import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi, type Mock } from 'vitest';

import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { CurrentUserService } from './current-user.service';
import { ProfileStateService } from './profile-state.service';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';

const capacitorMock = vi.hoisted(() => ({
  getPlatform: vi.fn(),
  isNativePlatform: vi.fn(),
}));

const browserMock = vi.hoisted(() => ({
  open: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitorMock,
}));

vi.mock('@capacitor/browser', () => ({
  Browser: browserMock,
}));

const config: AppConfig = {
  apiUrl: 'https://api.example.test/api/v1',
  environment: 'local',
};

const authEnvelope = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  sessionId: 'session-1',
  accessExpiresAt: '2026-06-25T12:00:00.000Z',
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'user@example.com',
    displayName: 'User One',
    roles: ['user'],
  },
};

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

function installSessionStorage(): Storage {
  const storage = new Map<string, string>();
  const sessionStorageMock = {
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

  Object.defineProperty(globalThis, 'sessionStorage', {
    value: sessionStorageMock,
    configurable: true,
  });

  return sessionStorageMock;
}

describe('AuthService', () => {
  let http: HttpTestingController;
  let router: { navigate: Mock<(commands: string[]) => Promise<boolean>> };
  let profileState: { clear: Mock<() => void> };
  let currentUser: { clearCurrentUser: Mock<() => void> };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    installLocalStorage();
    installSessionStorage();
    localStorage.clear();
    sessionStorage.clear();
    capacitorMock.getPlatform.mockReturnValue('web');
    capacitorMock.isNativePlatform.mockReturnValue(false);
    browserMock.open.mockResolvedValue(undefined);
    router = { navigate: vi.fn().mockResolvedValue(true) };
    profileState = { clear: vi.fn() };
    currentUser = { clearCurrentUser: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        AuthStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: config },
        { provide: Router, useValue: router },
        { provide: ProfileStateService, useValue: profileState },
        { provide: CurrentUserService, useValue: currentUser },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http?.verify();
  });

  it('signs in with email and stores first-party session tokens', async () => {
    const service = TestBed.inject(AuthService);
    const store = TestBed.inject(AuthStore);

    const promise = service.signInWithEmailAndPassword('user@example.com', 'correct-password');

    const request = http.expectOne('https://api.example.test/api/v1/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'user@example.com',
      password: 'correct-password',
    });
    request.flush(authEnvelope);
    await promise;

    expect(store.token()).toBe('access-1');
    expect(store.refreshToken()).toBe('refresh-1');
    expect(store.user()?.displayName).toBe('User One');
    expect(localStorage.getItem('physiocoach_refresh_token')).toBe('refresh-1');
    expect(localStorage.getItem('physiocoach_auth_token')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('registers with email and does not enter an email-verification state', async () => {
    const service = TestBed.inject(AuthService);

    const promise = service.signUpWithEmailAndPassword('new@example.com', 'new-password');

    const request = http.expectOne('https://api.example.test/api/v1/auth/register');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'new@example.com',
      password: 'new-password',
    });
    request.flush({ ...authEnvelope, user: { ...authEnvelope.user, email: 'new@example.com' } });
    await promise;

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('restores a session from the persisted refresh token during initialization', async () => {
    localStorage.setItem('physiocoach_refresh_token', 'refresh-1');
    const service = TestBed.inject(AuthService);
    const store = TestBed.inject(AuthStore);

    const promise = service.initialize(true);

    const request = http.expectOne('https://api.example.test/api/v1/auth/refresh');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ refreshToken: 'refresh-1' });
    request.flush({ ...authEnvelope, accessToken: 'access-2', refreshToken: 'refresh-2' });
    await promise;

    expect(store.token()).toBe('access-2');
    expect(store.refreshToken()).toBe('refresh-2');
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('logs out best-effort and clears local session state', async () => {
    const service = TestBed.inject(AuthService);
    const store = TestBed.inject(AuthStore);
    store.setSession(authEnvelope);

    const promise = service.signOut();

    const request = http.expectOne('https://api.example.test/api/v1/auth/logout');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    request.flush({ success: true });
    await promise;

    expect(store.token()).toBeNull();
    expect(store.refreshToken()).toBeNull();
    expect(profileState.clear).toHaveBeenCalledOnce();
    expect(currentUser.clearCurrentUser).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/auth']);
  });

  it('starts Google OAuth and stores callback state', async () => {
    const service = TestBed.inject(AuthService);
    const originalLocation = window.location;
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, assign },
      configurable: true,
    });

    const promise = service.signInWithGoogle();

    const request = http.expectOne(
      (candidate) => candidate.url === 'https://api.example.test/api/v1/auth/google/start',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('returnTo')).toBe('http://localhost:3000/oauth-callback');
    request.flush({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=state-123',
      state: 'state-123',
    });
    await promise;

    expect(sessionStorage.getItem('physiocoach_oauth_state')).toBe('state-123');
    expect(assign).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/v2/auth?state=state-123',
    );
    expect(browserMock.open).not.toHaveBeenCalled();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
    });
  });

  it('starts Google OAuth through the Capacitor browser when running on Android', async () => {
    capacitorMock.getPlatform.mockReturnValue('android');
    capacitorMock.isNativePlatform.mockReturnValue(true);
    const service = TestBed.inject(AuthService);
    const originalLocation = window.location;
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, assign },
      configurable: true,
    });

    const promise = service.signInWithGoogle();

    const request = http.expectOne(
      (candidate) => candidate.url === 'https://api.example.test/api/v1/auth/google/start',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('returnTo')).toContain('http://localhost:3000/oauth-callback');
    request.flush({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=state-android',
      state: 'state-android',
    });
    await promise;

    expect(sessionStorage.getItem('physiocoach_oauth_state')).toBe('state-android');
    expect(browserMock.open).toHaveBeenCalledWith({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?state=state-android',
    });
    expect(assign).not.toHaveBeenCalled();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
    });
  });

  it('exchanges OAuth callback codes through the first-party backend when state matches', async () => {
    const service = TestBed.inject(AuthService);
    sessionStorage.setItem('physiocoach_oauth_state', 'state-123');

    const promise = service.completeNativeRedirect(
      'ir.otconnect.physiocoach://oauth-callback?code=abc123&state=state-123',
    );

    const request = http.expectOne('https://api.example.test/api/v1/auth/oauth/exchange');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ code: 'abc123', state: 'state-123' });
    request.flush(authEnvelope);
    await promise;

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(sessionStorage.getItem('physiocoach_oauth_state')).toBeNull();
  });

  it('rejects OAuth callback codes when state does not match', async () => {
    const service = TestBed.inject(AuthService);
    sessionStorage.setItem('physiocoach_oauth_state', 'state-123');

    await expect(
      service.completeNativeRedirect(
        'ir.otconnect.physiocoach://oauth-callback?code=abc123&state=wrong-state',
      ),
    ).rejects.toThrow('OAuth callback state is invalid.');
  });
});
