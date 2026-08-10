import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';

interface ApiResponse<T> {
  data: T;
}

import { type LatestAssessment } from './posture-assessment.model';

@Injectable({ providedIn: 'root' })
export class PostureAssessmentApiService {
  private readonly api = inject(ApiClient);

  getLatestAssessment(): Observable<LatestAssessment | null> {
    return this.api
      .get<ApiResponse<LatestAssessment | null>>('/assessments/latest')
      .pipe(map((response) => response.data));
  }
}
