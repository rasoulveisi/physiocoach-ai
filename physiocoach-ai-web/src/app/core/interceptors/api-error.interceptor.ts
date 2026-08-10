import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const code = (error.error?.error?.code as string) ?? 'unknown';
      const requestId = error.error?.error?.requestId as string | undefined;
      const msg =
        (error.error?.error?.message as string) ?? error.message ?? 'Request failed. Please retry.';
      console.error(`API error [${code}]${requestId ? ` (${requestId})` : ''}: ${msg}`);

      return throwError(() => error);
    }),
  );
};
