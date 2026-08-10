import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { APP_CONFIG } from '../config/app-config';

const excludedAuthPaths = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/me',
  '/auth/google/start',
]);

export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const authStore = inject(AuthStore);
  const config = inject(APP_CONFIG);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || !shouldRefresh(req.url, config.apiUrl)) {
        return throwError(() => error);
      }

      return from(auth.refresh()).pipe(
        switchMap(() => {
          const accessToken = authStore.token();
          if (!accessToken) {
            throw new Error('Session refresh did not return an access token.');
          }

          return next(
            req.clone({
              setHeaders: {
                Authorization: `Bearer ${accessToken}`,
              },
            }),
          );
        }),
        catchError((refreshError) => {
          auth.clearSession();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

function shouldRefresh(requestUrl: string, apiUrl: string): boolean {
  try {
    const request = new URL(requestUrl, typeof window === 'undefined' ? undefined : window.location.origin);
    const api = new URL(apiUrl);
    const normalizedApiPath = api.pathname.replace(/\/$/, '');

    if (request.origin !== api.origin || !request.pathname.startsWith(normalizedApiPath)) {
      return false;
    }

    const authPath = request.pathname.slice(normalizedApiPath.length) || '/';
    return !excludedAuthPaths.has(authPath);
  } catch {
    return false;
  }
}
