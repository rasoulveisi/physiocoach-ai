import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { ProfileStateService } from './profile-state.service';

export const profileGuard: CanActivateFn = () => {
  const profileState = inject(ProfileStateService);
  const router = inject(Router);

  return profileState.getProfileOnce().pipe(
    map((profile) => (profile ? true : router.createUrlTree(['/onboarding']))),
    catchError(() => of(router.createUrlTree(['/onboarding']))),
  );
};
