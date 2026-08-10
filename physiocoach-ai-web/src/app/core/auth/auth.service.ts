import { computed, inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { CurrentUserService } from './current-user.service';
import { ProfileStateService } from './profile-state.service';
import { AuthSession, AuthStore, AuthUser } from './auth.store';
import type { components, paths } from '../api/generated/schema';

type AuthApiPath = Extract<keyof paths, `/api/v1/auth/${string}`>;
type AuthLoginInput = components['schemas']['AuthLoginInput'];
type AuthRegisterInput = components['schemas']['AuthRegisterInput'];
type AuthRefreshInput = components['schemas']['AuthRefreshInput'];
type AuthOAuthExchangeInput = components['schemas']['AuthOAuthExchangeInput'];
type AuthOAuthStartResponse = components['schemas']['AuthOAuthStartResponse'];
type AuthTokenEnvelope = components['schemas']['AuthTokenEnvelope'];

const authApiPaths = {
  register: '/api/v1/auth/register',
  login: '/api/v1/auth/login',
  refresh: '/api/v1/auth/refresh',
  logout: '/api/v1/auth/logout',
  oauthExchange: '/api/v1/auth/oauth/exchange',
  googleStart: '/api/v1/auth/google/start',
} as const satisfies Record<string, AuthApiPath>;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly config = inject(APP_CONFIG);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly profileState = inject(ProfileStateService);
  private readonly currentUser = inject(CurrentUserService);

  private refreshPromise: Promise<void> | null = null;
  private readonly oauthStateStorageKey = 'physiocoach_oauth_state';

  readonly userDisplayName = computed(() => this.resolveUserDisplayName(this.authStore.user()));
  readonly userInitials = computed(() =>
    this.resolveUserInitials(this.authStore.user(), this.userDisplayName()),
  );
  readonly userImageUrl = computed(() => this.normalizeString(this.authStore.user()?.imageUrl));
  readonly userEmail = computed(() => this.normalizeString(this.authStore.user()?.email));
  readonly isUserAuthenticated = computed(() => this.authStore.isAuthenticated());

  async initialize(navigateOnSignIn = false): Promise<void> {
    if (this.authStore.token()) {
      if (navigateOnSignIn) {
        await this.router.navigate(['/dashboard']);
      }
      return;
    }

    if (!this.authStore.refreshToken()) {
      return;
    }

    await this.refresh();
    if (navigateOnSignIn && this.authStore.isAuthenticated()) {
      await this.router.navigate(['/dashboard']);
    }
  }

  async signInWithEmailAndPassword(email: string, password: string): Promise<void> {
    const body: AuthLoginInput = { email, password };
    const session = await this.postSession(authApiPaths.login, body);
    this.storeSession(session);
    await this.router.navigate(['/dashboard']);
  }

  async signUpWithEmailAndPassword(email: string, password: string): Promise<void> {
    const body: AuthRegisterInput = { email, password };
    const session = await this.postSession(authApiPaths.register, body);
    this.storeSession(session);
    await this.router.navigate(['/dashboard']);
  }

  async refresh(): Promise<void> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.authStore.refreshToken();
    if (!refreshToken) {
      this.clearSession();
      throw new Error('No refresh token is available.');
    }

    const body: AuthRefreshInput = { refreshToken };

    this.refreshPromise = this.postSession(authApiPaths.refresh, body)
      .then((session) => {
        this.storeSession(session);
      })
      .catch((error) => {
        this.clearSession();
        throw this.toUserFacingError(error, 'Session expired. Please sign in again.');
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  async signOut(): Promise<void> {
    const accessToken = this.authStore.token();
    if (accessToken) {
      try {
        await firstValueFrom(
          this.http.post(
            this.url(authApiPaths.logout),
            {},
            {
              headers: new HttpHeaders({ Authorization: `Bearer ${accessToken}` }),
            },
          ),
        );
      } catch {
        // Logout is best-effort. Local session state is authoritative for the UI.
      }
    }

    this.clearSession();
    await this.router.navigate(['/auth']);
  }

  async signInWithGoogle(): Promise<void> {
    const start = await firstValueFrom(
      this.http.get<AuthOAuthStartResponse>(this.url(authApiPaths.googleStart), {
        params: { returnTo: this.oauthReturnToUrl() },
      }),
    );
    this.storeOAuthState(start.state);
    if (this.isAndroidNativePlatform()) {
      await Browser.open({ url: start.authorizationUrl });
      return;
    }

    window.location.assign(start.authorizationUrl);
  }

  async completeNativeRedirect(url: string): Promise<void> {
    const code = this.readOAuthCode(url);
    const state = this.readOAuthState(url);
    if (!code) {
      throw new Error('OAuth callback is missing an authorization code.');
    }
    if (!state || !this.isExpectedOAuthState(state)) {
      throw new Error('OAuth callback state is invalid. Please start sign-in again.');
    }

    try {
      const body: AuthOAuthExchangeInput = { code, state };
      const session = await this.postSession(authApiPaths.oauthExchange, body);
      this.storeSession(session);
      this.clearOAuthState();
      await this.router.navigate(['/dashboard']);
    } catch {
      throw new Error('Google sign-in could not be completed. Please use email sign-in.');
    }
  }

  clearSession(): void {
    this.authStore.clear();
    this.profileState.clear();
    this.currentUser.clearCurrentUser();
  }

  private storeSession(session: AuthSession): void {
    this.authStore.setSession(session);
    this.currentUser.clearCurrentUser();
  }

  private postSession<TBody extends object>(
    path: AuthApiPath,
    body: TBody,
  ): Promise<AuthTokenEnvelope> {
    return firstValueFrom(this.http.post<AuthTokenEnvelope>(this.url(path), body));
  }

  private url(path: AuthApiPath): string {
    const baseUrl = this.config.apiUrl.replace(/\/$/, '');
    const normalizedPath = path.replace(/^\/api\/v1/, '');
    return `${baseUrl}${normalizedPath}`;
  }

  private readOAuthCode(url: string): string | null {
    try {
      return new URL(url).searchParams.get('code');
    } catch {
      return null;
    }
  }

  private readOAuthState(url: string): string | null {
    try {
      return new URL(url).searchParams.get('state');
    } catch {
      return null;
    }
  }

  private isExpectedOAuthState(state: string): boolean {
    if (typeof sessionStorage === 'undefined') {
      return false;
    }

    try {
      return sessionStorage.getItem(this.oauthStateStorageKey) === state;
    } catch {
      return false;
    }
  }

  private clearOAuthState(): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    try {
      sessionStorage.removeItem(this.oauthStateStorageKey);
    } catch {
      // best effort
    }
  }

  private storeOAuthState(state: string): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    try {
      sessionStorage.setItem(this.oauthStateStorageKey, state);
    } catch {
      // best effort
    }
  }

  private oauthReturnToUrl(): string {
    if (typeof window === 'undefined') {
      return '/oauth-callback';
    }

    const url = new URL('/oauth-callback', window.location.origin);
    if (this.isAndroidNativePlatform()) {
      url.searchParams.set('native', 'true');
      url.searchParams.set('source', 'android');
    }

    return url.toString();
  }

  private isAndroidNativePlatform(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  private toUserFacingError(error: unknown, fallback: string): Error {
    if (error instanceof HttpErrorResponse) {
      const message =
        (error.error?.error?.message as string | undefined) ??
        (error.error?.message as string | undefined);
      return new Error(message || fallback);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error(fallback);
  }

  private resolveUserDisplayName(user: AuthUser | null): string {
    if (!user) {
      return 'PhysioCoach User';
    }

    const displayName = this.normalizeString(user.displayName);
    if (displayName) {
      return displayName;
    }

    const email = this.normalizeString(user.email);
    return email ? this.extractLocalPart(email) : 'PhysioCoach User';
  }

  private resolveUserInitials(user: AuthUser | null, displayName: string): string {
    const fromName = this.initialsFromText(displayName);
    if (fromName) {
      return fromName;
    }

    const fromEmail = this.initialsFromText(this.extractLocalPart(user?.email ?? ''));
    if (fromEmail) {
      return fromEmail;
    }

    return this.initialsFromText(user?.id ?? 'user');
  }

  private initialsFromText(value: string): string {
    const letters = value.match(/[A-Za-z0-9]/g) ?? [];
    if (!letters.length) {
      return '';
    }

    if (letters.length === 1) {
      return letters[0]?.toUpperCase() ?? '';
    }

    return `${letters[0]?.toUpperCase()}${letters[1]?.toUpperCase()}`;
  }

  private extractLocalPart(email: string): string {
    return this.normalizeString(email).split('@')[0] ?? '';
  }

  private normalizeString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value.trim() : fallback;
  }
}
