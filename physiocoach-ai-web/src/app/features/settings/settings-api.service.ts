import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';

interface ApiResponse<T> {
  data: T;
}

import { type UserSettings } from './settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsApiService {
  private readonly api = inject(ApiClient);

  getSettings(): Observable<UserSettings> {
    return this.api
      .get<ApiResponse<UserSettings>>('/settings')
      .pipe(map((response) => response.data));
  }

  patchSettings(payload: Partial<UserSettings>): Observable<UserSettings> {
    return this.api
      .patch<ApiResponse<UserSettings>, Partial<UserSettings>>('/settings', payload)
      .pipe(map((response) => response.data));
  }
}
