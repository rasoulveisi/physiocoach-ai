import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { OnboardingStore } from './onboarding.store';
import { OnboardingApiService } from './onboarding-api.service';
import { type AssessmentConsideration } from './onboarding.model';

describe('OnboardingStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: OnboardingApiService,
          useValue: {
            getProfile: () => of({ data: null }),
            getLatestAssessment: () => of({ data: null }),
            getConsiderations: () => of({ data: [] }),
          },
        },
      ],
    });
  });

  it('builds an assessment payload from form state', () => {
    const store = TestBed.inject(OnboardingStore);
    store.update({
      age: 34,
      sex: 'male',
      heightCm: 178,
      weightKg: 82,
      lifestyle: 'desk_job',
      experienceLevel: 'beginner',
      goals: ['posture_improvement'],
      frequencyDays: 3,
      equipment: ['full_gym'],
      considerations: [],
      limitations: ['shoulder_pain'],
      postureFlags: ['rounded_shoulders'],
    });

    expect(store.assessmentPayload()).toEqual({
      goals: ['posture_improvement'],
      frequencyDays: 3,
      equipment: ['full_gym'],
      considerations: [],
      limitations: ['shoulder_pain'],
      postureFlags: ['rounded_shoulders'],
    });

    expect(store.profilePayload()).toEqual({
      age: 34,
      sex: 'male',
      heightCm: 178,
      weightKg: 82,
      lifestyle: 'desk_job',
      experienceLevel: 'beginner',
    });
    expect(store.profilePayload()).not.toHaveProperty('bodyFatEstimate');
  });

  it('normalizes payload fields to the backend contract', () => {
    const store = TestBed.inject(OnboardingStore);
    const goals = ['posture_improvement'];
    const equipment = ['full_gym'];
    const limitations = ['shoulder_pain'];
    const postureFlags = ['rounded_shoulders'];
    const considerations: AssessmentConsideration[] = [];

    store.update({
      age: 8,
      heightCm: 280,
      weightKg: 15,
      bodyFatEstimate: 100,
      goals,
      frequencyDays: 99,
      equipment,
      considerations,
      limitations,
      postureFlags,
    });

    const assessment = store.assessmentPayload();
    const profile = store.profilePayload();

    expect(assessment).toEqual({
      goals: ['posture_improvement'],
      frequencyDays: 5,
      equipment: ['full_gym'],
      considerations: [],
      limitations: ['shoulder_pain'],
      postureFlags: ['rounded_shoulders'],
    });
    expect(profile).toMatchObject({
      age: 13,
      heightCm: 250,
      weightKg: 30,
      bodyFatEstimate: 70,
    });

    goals.push('strength');
    equipment.push('home_gym');
    limitations.push('knee_pain');
    postureFlags.push('forward_head');

    expect(assessment.goals).toEqual(['posture_improvement']);
    expect(assessment.equipment).toEqual(['full_gym']);
    expect(assessment.limitations).toEqual(['shoulder_pain']);
    expect(assessment.postureFlags).toEqual(['rounded_shoulders']);
  });

  it('serializes selected consideration severity', () => {
    const store = TestBed.inject(OnboardingStore);

    store.update({
      considerations: [
        { code: 'knee_pain', severity: 'moderate', side: 'bilateral', inferred: false },
      ],
    });

    expect(store.assessmentPayload().considerations).toEqual([
      { code: 'knee_pain', severity: 'moderate', side: 'bilateral', inferred: false },
    ]);
  });

  it('keeps default selections usable when the consideration catalog fails', () => {
    TestBed.overrideProvider(OnboardingApiService, {
      useValue: {
        getProfile: () => of({ data: null }),
        getLatestAssessment: () => of({ data: null }),
        getConsiderations: () => throwError(() => new Error('catalog unavailable')),
      },
    });

    const store = TestBed.inject(OnboardingStore);

    expect(store.considerationOptionsError()).toBe(
      'Body considerations could not be loaded. Retry to see all available options.',
    );
    expect(store.state().considerations).toEqual([
      { code: 'rounded_shoulders', severity: 'mild', side: 'unspecified', inferred: false },
    ]);
    expect(store.assessmentPayload().goals).toEqual(['posture_improvement']);
  });

  it('keeps defaults usable when the latest assessment fails', () => {
    TestBed.overrideProvider(OnboardingApiService, {
      useValue: {
        getProfile: () => of({ data: null }),
        getLatestAssessment: () => throwError(() => new Error('assessment unavailable')),
        getConsiderations: () => of({ data: [] }),
      },
    });

    const store = TestBed.inject(OnboardingStore);

    expect(store.latestAssessmentError()).toBe(
      'Your previous assessment could not be loaded. Continue with these defaults or retry.',
    );
    expect(store.state().goals).toEqual(['posture_improvement']);
    expect(store.state().considerations).toEqual([
      { code: 'rounded_shoulders', severity: 'mild', side: 'unspecified', inferred: false },
    ]);
  });
});
