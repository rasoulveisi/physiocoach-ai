import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClient } from '../../core/api/api-client';
import { OnboardingApiService } from './onboarding-api.service';

describe('OnboardingApiService', () => {
  const profile = {
    age: 30,
    sex: 'prefer_not_to_say',
    heightCm: 175,
    weightKg: 75,
    lifestyle: 'desk_job',
    experienceLevel: 'beginner',
  };
  const assessment = {
    goals: ['posture_improvement'],
    frequencyDays: 3,
    equipment: ['full_gym'],
    considerations: [],
    limitations: [],
    postureFlags: ['rounded_shoulders'],
  };

  let api: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let service: OnboardingApiService;

  beforeEach(() => {
    api = {
      get: vi.fn(() => of({})),
      post: vi.fn(() => of({})),
      patch: vi.fn(() => of({})),
      delete: vi.fn(() => of({})),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: ApiClient, useValue: api }],
    });

    service = TestBed.inject(OnboardingApiService);
  });

  it('requests workout plan generation', () => {
    service.generatePlan(profile, assessment).subscribe();

    expect(api.post).toHaveBeenCalledWith('/workout-plans/generate', { profile, assessment });
  });

  it('requests latest assessment', () => {
    service.getLatestAssessment().subscribe();

    expect(api.get).toHaveBeenCalledWith('/assessments/latest');
  });
});
