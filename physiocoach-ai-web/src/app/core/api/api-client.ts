import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { AuthStore } from '../auth/auth.store';
import { APP_CONFIG } from '../config/app-config';

export interface ApiClientOptions {
  headers?: HttpHeaders | Record<string, string | string[]>;
  params?:
    | HttpParams
    | Record<string, string | number | boolean | readonly (string | number | boolean)[]>;
}

export function normalizeApiRequestBody<TBody>(body: TBody): TBody | Record<string, never> {
  return body === undefined ? {} : body;
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly authStore = inject(AuthStore);
  private readonly config = inject(APP_CONFIG);
  private readonly http = inject(HttpClient);

  get<T>(path: string, options?: ApiClientOptions): Observable<T> {
    return this.http.get<T>(this.url(path), this.withAuth(options));
  }

  post<T, TBody = unknown>(path: string, body: TBody, options?: ApiClientOptions): Observable<T> {
    return this.http.post<T>(this.url(path), normalizeApiRequestBody(body), this.withAuth(options));
  }

  patch<T, TBody = unknown>(path: string, body: TBody, options?: ApiClientOptions): Observable<T> {
    return this.http.patch<T>(
      this.url(path),
      normalizeApiRequestBody(body),
      this.withAuth(options),
    );
  }

  delete<T>(path: string, options?: ApiClientOptions): Observable<T> {
    return this.http.delete<T>(this.url(path), this.withAuth(options));
  }

  private url(path: string): string {
    const baseUrl = this.config.apiUrl.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return `${baseUrl}${normalizedPath}`;
  }

  private withAuth(options: ApiClientOptions = {}): ApiClientOptions {
    const token = this.authStore.token();
    const headers =
      options.headers instanceof HttpHeaders
        ? options.headers
        : new HttpHeaders(options.headers ?? {});

    return {
      ...options,
      headers: token ? headers.set('Authorization', `Bearer ${token}`) : headers,
    };
  }
}
