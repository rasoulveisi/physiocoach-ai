import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';

import {
  AssessmentPayload,
  ProfilePayload,
  ProfileResponse,
  GeneratePlanResponse,
  CurrentPlanResponse,
  DeleteCurrentPlanResponse,
  BodyConsiderationOption,
} from './onboarding.model';

@Injectable({ providedIn: 'root' })
export class OnboardingApiService {
  private readonly api = inject(ApiClient);

  getProfile() {
    return this.api.get<ProfileResponse>('/profile');
  }

  saveProfile(payload: ProfilePayload) {
    return this.api.patch<ProfileResponse, ProfilePayload>('/profile', payload);
  }

  createAssessment(payload: AssessmentPayload): Observable<unknown> {
    return this.api.post('/assessments', payload);
  }

  getLatestAssessment(): Observable<{ data: AssessmentPayload | null }> {
    return this.api.get<{ data: AssessmentPayload | null }>('/assessments/latest');
  }

  getConsiderations(): Observable<{ data: BodyConsiderationOption[] }> {
    return this.api.get<{ data: BodyConsiderationOption[] }>('/considerations');
  }

  generatePlan(
    profile: ProfilePayload,
    assessment: AssessmentPayload,
  ): Observable<GeneratePlanResponse> {
    return this.api.post('/workout-plans/generate', { profile, assessment });
  }

  getCurrentPlan(): Observable<CurrentPlanResponse> {
    return this.api.get('/workout-plans/current');
  }

  deleteCurrentPlan(): Observable<DeleteCurrentPlanResponse> {
    return this.api.delete('/workout-plans/current');
  }
}
