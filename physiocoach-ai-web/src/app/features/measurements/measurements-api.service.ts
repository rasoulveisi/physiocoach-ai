import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';
import type { BodyMeasurement } from '../progress/progress.model';

interface ApiResponse<T> {
  data: T;
}

@Injectable({ providedIn: 'root' })
export class MeasurementsApiService {
  private readonly api = inject(ApiClient);

  listBodyMeasurements(): Observable<BodyMeasurement[]> {
    return this.api.get<ApiResponse<BodyMeasurement[]>>('/body-measurements').pipe(map((response) => response.data));
  }
}
