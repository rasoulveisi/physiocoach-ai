import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthStore } from './auth.store';
import { CurrentUserService } from './current-user.service';

export const adminGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const currentUser = inject(CurrentUserService);
  const router = inject(Router);

  if (!authStore.isAuthenticated()) {
    return of(router.createUrlTree(['/auth']));
  }

  return currentUser.loadCurrentUser().pipe(
    map((user) => (currentUser.hasAdminRole(user) ? true : router.createUrlTree(['/dashboard']))),
    catchError(() => of(router.createUrlTree(['/dashboard']))),
  );
};
