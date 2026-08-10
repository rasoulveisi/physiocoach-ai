import { Injectable, inject } from '@angular/core';
import { Observable, map, of, shareReplay, tap } from 'rxjs';

import { OnboardingApiService } from '../../features/onboarding/onboarding-api.service';
import { type ProfilePayload } from '../../features/onboarding/onboarding.model';

@Injectable({ providedIn: 'root' })
export class ProfileStateService {
  private readonly onboardingApi = inject(OnboardingApiService);
  private profile: ProfilePayload | null | undefined;
  private profileRequest$: Observable<ProfilePayload | null> | null = null;

  getProfileOnce(): Observable<ProfilePayload | null> {
    if (this.profile !== undefined) {
      return of(this.profile ?? null);
    }

    if (!this.profileRequest$) {
      this.profileRequest$ = this.onboardingApi.getProfile().pipe(
        map((response) => response.data ?? null),
        tap((profile) => {
          this.profile = profile;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
        tap({
          error: () => {
            this.profileRequest$ = null;
          },
        }),
      );
    }

    return this.profileRequest$;
  }

  setProfile(profile: ProfilePayload): void {
    this.profile = profile;
    this.profileRequest$ = null;
  }

  clear(): void {
    this.profile = undefined;
    this.profileRequest$ = null;
  }
}
