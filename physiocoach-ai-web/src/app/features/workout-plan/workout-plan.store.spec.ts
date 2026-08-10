import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { WorkoutPlanStore } from './workout-plan.store';
import { OnboardingApiService } from '../onboarding/onboarding-api.service';
import {
  type CurrentPlanResponse,
  type DeleteCurrentPlanResponse,
  type GeneratePlanResponse,
} from '../onboarding/onboarding.model';

class FakeOnboardingApiService {
  getCurrentPlan(): Observable<CurrentPlanResponse> {
    return of({ data: null });
  }

  deleteCurrentPlan(): Observable<DeleteCurrentPlanResponse> {
    return of({ data: { id: 'plan_1', deleted: true } });
  }

  generatePlan(): Observable<GeneratePlanResponse> {
    return of({
      data: {
        id: 'plan_1',
        source: 'ai',
        model: 'openrouter/model',
        plan: {
          schemaVersion: '1.0',
          source: 'ai',
          warnings: [],
          safetyNotes: [],
          progression: {
            baselineIntensity: 'low-moderate',
            progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
            increasePercent: 10,
            conditions: [],
          },
          days: [],
        },
        warnings: [],
        createdAt: '2026-06-01T10:00:00.000Z',
        cached: false,
        inputHash: 'hash-generated',
      },
    });
  }
}

describe('WorkoutPlanStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: OnboardingApiService, useClass: FakeOnboardingApiService }],
    });
  });

  it('tracks loading and current plan', () => {
    const store = TestBed.inject(WorkoutPlanStore);
    expect(store.loading()).toBe(false);
    expect(store.currentPlan()).toBeNull();

    store.setCurrentPlan({
      id: 'plan_1',
      source: 'fallback',
      model: 'deterministic-fallback',
      createdAt: '2026-06-01T10:00:00.000Z',
      cached: false,
      inputHash: 'hash-1',
      plan: {
        schemaVersion: '1.0',
        source: 'fallback',
        warnings: ['Educational fitness recommendations only. Not medical advice.'],
        safetyNotes: ['Keep exercises controlled.'],
        progression: {
          baselineIntensity: 'low-moderate',
          progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
          increasePercent: 10,
          conditions: [],
        },
        days: [
          {
            dayNumber: 1,
            name: 'Day 1',
            focus: 'Full body',
            exercises: [
              {
                id: 'ex_catalog_exercises_dataset_0001',
                masterExerciseId: 'ex_catalog_exercises_dataset_0001',
                name: 'Goblet squat',
                muscleGroup: 'legs',
                movementPattern: 'squat',
                sets: 3,
                reps: '8-10',
                restSeconds: 60,
              },
            ],
          },
        ],
      },
    });

    expect(store.currentPlan()).toMatchObject({
      id: 'plan_1',
      source: 'fallback',
      model: 'deterministic-fallback',
      createdAt: '2026-06-01T10:00:00.000Z',
      cached: false,
      inputHash: 'hash-1',
      plan: {
        schemaVersion: '1.0',
        source: 'fallback',
        warnings: ['Educational fitness recommendations only. Not medical advice.'],
        safetyNotes: ['Keep exercises controlled.'],
        progression: {
          baselineIntensity: 'low-moderate',
          progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
          increasePercent: 10,
          conditions: [],
        },
        days: [
          {
            dayNumber: 1,
            name: 'Day 1',
            focus: 'Full body',
            exercises: [
              {
                id: 'ex_catalog_exercises_dataset_0001',
                masterExerciseId: 'ex_catalog_exercises_dataset_0001',
                name: 'Goblet squat',
                muscleGroup: 'legs',
                movementPattern: 'squat',
                sets: 3,
                reps: '8-10',
                restSeconds: 60,
              },
            ],
          },
        ],
      },
    });
  });

  it('loads current plan from API', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: OnboardingApiService,
          useValue: {
            getCurrentPlan() {
              return of({
                data: {
                  id: 'plan_2',
                  source: 'fallback',
                  model: 'deterministic',
                  plan: {
                    schemaVersion: '1.0',
                    source: 'fallback',
                    warnings: [],
                    safetyNotes: [],
                    progression: {
                      baselineIntensity: 'low-moderate',
                      progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
                      increasePercent: 10,
                      conditions: [],
                    },
                    days: [],
                  },
                  warnings: ['Educational fitness recommendations only. Not medical advice.'],
                  createdAt: '2026-06-01T10:00:00.000Z',
                  cached: true,
                  inputHash: 'hash-api-2',
                },
              } as CurrentPlanResponse);
            },
          },
        },
      ],
    });

    const store = TestBed.inject(WorkoutPlanStore);
    store.loadCurrentPlan();

    expect(store.currentPlan()?.id).toBe('plan_2');
    expect(store.currentPlan()?.model).toBe('deterministic');
  });

  it('sets the generated plan from the generate response', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: OnboardingApiService,
          useValue: {
            generatePlan() {
              return of({
                data: {
                  id: 'plan_generated',
                  source: 'ai',
                  model: 'openrouter/model',
                  plan: {
                    schemaVersion: '1.0',
                    source: 'ai',
                    warnings: [],
                    safetyNotes: [],
                    progression: {
                      baselineIntensity: 'low-moderate',
                      progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
                      increasePercent: 10,
                      conditions: [],
                    },
                    days: [],
                  },
                  warnings: [],
                  createdAt: '2026-06-01T10:01:00.000Z',
                  cached: false,
                  inputHash: 'hash-generated',
                },
              } satisfies GeneratePlanResponse);
            },
          },
        },
      ],
    });
    const store = TestBed.inject(WorkoutPlanStore);

    store.generatePlan(
      {
        age: 32,
        sex: 'male',
        heightCm: 180,
        weightKg: 80,
        lifestyle: 'desk_job',
        experienceLevel: 'beginner',
      },
      {
        goals: ['posture_improvement'],
        frequencyDays: 3,
        equipment: ['full_gym'],
        considerations: [],
        limitations: [],
        postureFlags: ['rounded_shoulders'],
      },
    );

    expect(store.currentPlan()?.id).toBe('plan_generated');
    expect(store.jobError()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('normalizes progression, rest, rpe, and safety data for the premium plan UI', () => {
    const store = TestBed.inject(WorkoutPlanStore);

    store.setCurrentPlan({
      id: 'plan_ux',
      source: 'ai',
      model: 'internal-model',
      createdAt: '2026-06-01T10:00:00.000Z',
      cached: false,
      inputHash: 'internal-hash',
      plan: {
        schemaVersion: '1.0',
        source: 'ai',
        warnings: ['Keep rows pain-free.'],
        safetyNotes: ['Stop if shoulder is painful.'],
        progression: {
          baselineIntensity: 'low-moderate',
          progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
          increasePercent: 10,
          conditions: ['2 pain-free sessions'],
        },
        days: [
          {
            dayNumber: 1,
            name: 'Day 1',
            focus: 'Posture strength',
            exercises: [
              {
                id: 'ex_catalog_exercises_dataset_0001',
                masterExerciseId: 'ex_catalog_exercises_dataset_0001',
                name: 'Chest-supported row',
                muscleGroup: 'back',
                movementPattern: 'pull',
                sets: 4,
                reps: '8-10',
                restSeconds: 90,
                rpe: 7,
              },
            ],
          },
        ],
      },
    });

    const current = store.currentPlan();
    expect(current?.plan.days[0].exercises[0].restSeconds).toBe(90);
    expect(current?.plan.days[0].exercises[0].rpe).toBe(7);
    expect(current?.plan.safetyNotes).toEqual(['Stop if shoulder is painful.']);
    expect(current?.plan.progression?.progressionRule).toBe(
      'Increase load or reps by +10% after 2 pain-free sessions.',
    );
    expect(current?.plan.progression?.baselineIntensity).toBe('low-moderate');
  });

  it('sets a delete error when the API does not confirm deletion', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: OnboardingApiService,
          useValue: {
            getCurrentPlan() {
              return of({ data: null });
            },
            deleteCurrentPlan() {
              return of({ data: null } satisfies DeleteCurrentPlanResponse);
            },
          },
        },
      ],
    });

    const store = TestBed.inject(WorkoutPlanStore);
    store.setCurrentPlan({
      id: 'plan_delete',
      source: 'fallback',
      model: 'deterministic',
      plan: {
        schemaVersion: '1.0',
        source: 'fallback',
        warnings: [],
        safetyNotes: [],
        progression: {
          baselineIntensity: 'low-moderate',
          progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
          increasePercent: 10,
          conditions: [],
        },
        days: [],
      },
      warnings: [],
      createdAt: '2026-06-01T10:00:00.000Z',
      cached: true,
      inputHash: 'hash-delete',
    });

    store.deleteCurrentPlan();

    expect(store.currentPlan()?.id).toBe('plan_delete');
    expect(store.deleteError()).toBe('Unable to delete current plan.');
    expect(store.deleting()).toBe(false);
  });
});
