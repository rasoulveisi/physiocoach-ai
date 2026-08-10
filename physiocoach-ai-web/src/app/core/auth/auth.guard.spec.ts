import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  type GuardResult,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { firstValueFrom, type Observable } from 'rxjs';

import { authGuard, unauthGuard } from './auth.guard';
import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  const createAuthStoreMock = (isAuthenticated = false) => {
    let token: string | null = isAuthenticated ? 'token' : null;
    return {
      isAuthenticated: () => token !== null,
      setToken: (value: string) => {
        token = value;
      },
      clear: () => {
        token = null;
      },
    };
  };

  it('waits for auth initialization before allowing a restored session through', async () => {
    const auth = {
      initialize: async () => {
        TestBed.inject(AuthStore).setToken('restored-token');
      },
    };

    await TestBed.configureTestingModule({
      providers: [
        { provide: AuthStore, useValue: createAuthStoreMock(true) },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: { createUrlTree: (commands: string[]) => commands } },
      ],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(
        authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Observable<GuardResult>,
      ),
    );

    expect(result).toBe(true);
  });

  it('redirects to auth when auth has no session', async () => {
    const auth = {
      initialize: async () => undefined,
    };

    await TestBed.configureTestingModule({
      providers: [
        { provide: AuthStore, useValue: createAuthStoreMock(false) },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: { createUrlTree: (commands: string[]) => commands } },
      ],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(
        authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Observable<GuardResult>,
      ),
    );

    expect(result).toEqual(['/auth']);
  });
});

describe('unauthGuard', () => {
  const createAuthStoreMock = (isAuthenticated = false) => {
    let token: string | null = isAuthenticated ? 'token' : null;
    return {
      isAuthenticated: () => token !== null,
      setToken: (value: string) => {
        token = value;
      },
      clear: () => {
        token = null;
      },
    };
  };

  it('allows access to auth page when not authenticated', async () => {
    const auth = {
      initialize: async () => undefined,
    };

    await TestBed.configureTestingModule({
      providers: [
        { provide: AuthStore, useValue: createAuthStoreMock(false) },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: { createUrlTree: (commands: string[]) => commands } },
      ],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(
        unauthGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Observable<GuardResult>,
      ),
    );

    expect(result).toBe(true);
  });

  it('redirects to dashboard when authenticated', async () => {
    const auth = {
      initialize: async () => {
        TestBed.inject(AuthStore).setToken('session-token');
      },
    };

    await TestBed.configureTestingModule({
      providers: [
        { provide: AuthStore, useValue: createAuthStoreMock(true) },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: { createUrlTree: (commands: string[]) => commands } },
      ],
    }).compileComponents();

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(
        unauthGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Observable<GuardResult>,
      ),
    );

    expect(result).toEqual(['/dashboard']);
  });
});
