import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, from, map, of } from 'rxjs';

import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const auth = inject(AuthService);
  const router = inject(Router);

  return from(auth.initialize()).pipe(
    map(() => (authStore.isAuthenticated() ? true : router.createUrlTree(['/auth']))),
    catchError(() => of(router.createUrlTree(['/auth']))),
  );
};

export const unauthGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const auth = inject(AuthService);
  const router = inject(Router);

  return from(auth.initialize()).pipe(
    map(() => (authStore.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true)),
    catchError(() => of(true)),
  );
};
