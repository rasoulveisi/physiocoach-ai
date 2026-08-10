import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string | null;
  imageUrl?: string | null;
  role?: string | null;
  roles?: string[];
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  sessionId?: string;
  accessExpiresAt?: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly refreshTokenStorageKey = 'physiocoach_refresh_token';
  private readonly legacyAccessTokenStorageKey = 'physiocoach_auth_token';

  private readonly tokenState = signal<string | null>(null);
  private readonly refreshTokenState = signal<string | null>(this.initialRefreshToken());
  private readonly userState = signal<AuthUser | null>(null);

  readonly token = this.tokenState.asReadonly();
  readonly refreshToken = this.refreshTokenState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => this.token() !== null);

  setToken(token: string): void {
    this.tokenState.set(token);
    this.clearLegacyAccessToken();
  }

  setRefreshToken(refreshToken: string): void {
    this.refreshTokenState.set(refreshToken);
    this.persistRefreshToken(refreshToken);
  }

  setUser(user: AuthUser | null): void {
    this.userState.set(user ? this.normalizeUser(user) : null);
  }

  setSession(session: AuthSession): void {
    this.clearLegacyAccessToken();
    this.tokenState.set(session.accessToken);
    this.setRefreshToken(session.refreshToken);
    this.setUser(session.user);
  }

  clear(): void {
    this.tokenState.set(null);
    this.refreshTokenState.set(null);
    this.userState.set(null);
    this.clearRefreshToken();
    this.clearLegacyAccessToken();
  }

  private initialRefreshToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    try {
      localStorage.removeItem(this.legacyAccessTokenStorageKey);
      return localStorage.getItem(this.refreshTokenStorageKey);
    } catch {
      return null;
    }
  }

  private persistRefreshToken(refreshToken: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      localStorage.setItem(this.refreshTokenStorageKey, refreshToken);
    } catch {
      // storage is unavailable in restricted contexts; continue with in-memory auth only.
    }
  }

  private clearRefreshToken(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      localStorage.removeItem(this.refreshTokenStorageKey);
    } catch {
      // best effort
    }
  }

  private clearLegacyAccessToken(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      localStorage.removeItem(this.legacyAccessTokenStorageKey);
    } catch {
      // best effort
    }
  }

  private normalizeUser(user: AuthUser): AuthUser {
    return {
      id: String(user.id),
      email: String(user.email),
      ...(user.displayName === undefined ? {} : { displayName: user.displayName }),
      ...(user.imageUrl === undefined ? {} : { imageUrl: user.imageUrl }),
      ...(user.role === undefined ? {} : { role: user.role }),
      roles: Array.isArray(user.roles) ? user.roles : [],
    };
  }
}
