import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';

interface ApiEnvelope<T> {
  data: T;
}

import {
  type AdminSummary,
  type AdminHealth,
} from './admin.model';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly api = inject(ApiClient);

  getSummary(): Observable<AdminSummary> {
    return this.api
      .get<ApiEnvelope<AdminSummary>>('/admin')
      .pipe(map((response) => response.data));
  }

  getHealth(): Observable<AdminHealth> {
    return this.api
      .get<ApiEnvelope<AdminHealth>>('/admin/health')
      .pipe(map((response) => response.data));
  }
}
