import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, of, shareReplay, tap } from 'rxjs';
import { map, Observable } from 'rxjs';

import { ApiClient } from '../api/api-client';
import { AuthStore } from './auth.store';

export interface CurrentUser {
  id: string;
  email: string;
  displayName?: string | null;
  imageUrl?: string | null;
  role?: string;
  roles: string[];
}

interface ApiEnvelope {
  user: CurrentUser | null;
}

@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly api = inject(ApiClient);
  private readonly authStore = inject(AuthStore);
  private readonly userState = signal<CurrentUser | null | undefined>(undefined);

  private userRequest$?: Observable<CurrentUser | null>;

  readonly isAdmin = computed(() => this.hasAdminRole(this.userState()));

  loadCurrentUser(): Observable<CurrentUser | null> {
    const existing = this.userState();
    if (existing !== undefined) {
      return of(existing);
    }

    if (!this.userRequest$) {
      this.userRequest$ = this.api.get<ApiEnvelope>('/auth/me').pipe(
        map((response) => response.user),
        map((user) => this.normalizeCurrentUser(user)),
        tap((user) => {
          this.userState.set(user);
          this.authStore.setUser(user);
          this.userRequest$ = undefined;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
        catchError(() => {
          this.userState.set(null);
          this.userRequest$ = undefined;
          return of(null);
        }),
      );
    }

    return this.userRequest$;
  }

  clearCurrentUser(): void {
    this.userState.set(undefined);
    this.userRequest$ = undefined;
  }

  getCurrentUserSnapshot(): CurrentUser | null | undefined {
    return this.userState();
  }

  hasAdminRole(value: CurrentUser | null | undefined): boolean {
    const user = value ?? this.userState();
    if (!user) {
      return false;
    }

    const roles = new Set([...(user.roles ?? []), ...(user.role ? [user.role] : [])].map((role) =>
      role.toLowerCase(),
    ));

    return roles.has('admin') || roles.has('super_admin') || roles.has('internal');
  }

  private normalizeCurrentUser(value: CurrentUser | null): CurrentUser | null {
    if (!value) {
      return null;
    }

    return {
      id: value.id,
      email: value.email,
      ...(value.displayName === undefined ? {} : { displayName: value.displayName }),
      ...(value.imageUrl === undefined ? {} : { imageUrl: value.imageUrl }),
      ...(value.role === undefined ? {} : { role: value.role }),
      roles: Array.isArray(value.roles) ? value.roles : [],
    };
  }
}
