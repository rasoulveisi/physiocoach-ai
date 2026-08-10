import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { authRefreshInterceptor } from './auth-refresh.interceptor';

const config: AppConfig = {
  apiUrl: 'https://api.example.test/api/v1',
  environment: 'local',
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

describe('authRefreshInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let refresh: ReturnType<typeof vi.fn>;
  let clearSession: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    installLocalStorage();
    localStorage.clear();
    refresh = vi.fn();
    clearSession = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        provideHttpClient(withInterceptors([authRefreshInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: config },
        {
          provide: AuthService,
          useValue: {
            refresh,
            clearSession,
          },
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock?.verify();
  });

  it('refreshes once and retries API requests that fail with 401', async () => {
    const store = TestBed.inject(AuthStore);
    store.setSession({
      accessToken: 'old-access',
      refreshToken: 'refresh-1',
      user: { id: 'user-1', email: 'user@example.com' },
    });
    refresh.mockImplementation(async () => {
      store.setSession({
        accessToken: 'new-access',
        refreshToken: 'refresh-2',
        user: { id: 'user-1', email: 'user@example.com' },
      });
    });

    const responsePromise = firstValueFrom(http.get('https://api.example.test/api/v1/profile'));

    const failedRequest = httpMock.expectOne('https://api.example.test/api/v1/profile');
    expect(failedRequest.request.headers.get('Authorization')).toBeNull();
    failedRequest.flush({ error: { message: 'expired' } }, { status: 401, statusText: 'Unauthorized' });

    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    const retryRequest = httpMock.expectOne('https://api.example.test/api/v1/profile');
    expect(retryRequest.request.headers.get('Authorization')).toBe('Bearer new-access');
    retryRequest.flush({ data: { id: 'profile-1' } });

    await expect(responsePromise).resolves.toEqual({ data: { id: 'profile-1' } });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('does not refresh first-party auth endpoint failures', async () => {
    const responsePromise = firstValueFrom(
      http.get('https://api.example.test/api/v1/auth/google/start'),
    );

    const request = httpMock.expectOne('https://api.example.test/api/v1/auth/google/start');
    request.flush({ error: { message: 'bad credentials' } }, { status: 401, statusText: 'Unauthorized' });

    await expect(responsePromise).rejects.toMatchObject({ status: 401 });
    expect(refresh).not.toHaveBeenCalled();
  });
});
