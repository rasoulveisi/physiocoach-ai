import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';

interface ApiResponse<T> {
  data: T;
}

import {
  type ProgressSummary,
  type BodyMeasurement,
  type PersonalRecordGroup,
  type MuscleVolumeEntry,
} from './progress.model';

@Injectable({ providedIn: 'root' })
export class ProgressApiService {
  private readonly api = inject(ApiClient);

  getSummary(): Observable<ProgressSummary> {
    return this.api
      .get<ApiResponse<ProgressSummary>>('/progress/summary')
      .pipe(map((response) => response.data));
  }

  getPersonalRecords(): Observable<PersonalRecordGroup[]> {
    return this.api
      .get<ApiResponse<PersonalRecordGroup[]>>('/progress/prs')
      .pipe(map((response) => response.data));
  }

  getMuscleVolume(): Observable<MuscleVolumeEntry[]> {
    return this.api
      .get<ApiResponse<MuscleVolumeEntry[]>>('/progress/muscle-volume')
      .pipe(map((response) => response.data));
  }

  listBodyMeasurements(): Observable<BodyMeasurement[]> {
    return this.api
      .get<ApiResponse<BodyMeasurement[]>>('/body-measurements')
      .pipe(map((response) => response.data));
  }
}
