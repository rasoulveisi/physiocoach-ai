import { computed, inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize, map, take, tap } from 'rxjs';

import { OnboardingApiService } from '../onboarding/onboarding-api.service';
import {
  type DeleteCurrentPlanResponse,
  type PlanProgression,
  type ProfilePayload,
  type AssessmentPayload,
} from '../onboarding/onboarding.model';
import {
  type WorkoutExerciseView,
  type WorkoutDayView,
  type WorkoutPlanView,
} from './workout-plan.model';

@Injectable({ providedIn: 'root' })
export class WorkoutPlanStore {
  private readonly onboardingApi = inject(OnboardingApiService);
  private hasLoadedCurrentPlan = false;

  readonly loading = signal(false);
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly currentPlan = signal<WorkoutPlanView | null>(null);
  readonly jobError = signal<string | null>(null);

  readonly hasPlan = computed(() => this.currentPlan() !== null);
  readonly planDays = computed(() => this.currentPlan()?.plan.days ?? []);
  readonly planWarnings = computed(() => this.currentPlan()?.plan.warnings ?? []);

  readonly loading$ = toObservable(this.loading);
  readonly currentPlan$ = toObservable(this.currentPlan);

  setCurrentPlan(plan: unknown): void {
    this.currentPlan.set(normalizeWorkoutPlanView(plan));
    this.hasLoadedCurrentPlan = true;
  }

  ensureCurrentPlan(): void {
    if (this.hasLoadedCurrentPlan || this.loading()) {
      return;
    }

    this.loadCurrentPlan();
  }

  loadCurrentPlan(force = false): void {
    if (!force && (this.hasLoadedCurrentPlan || this.loading())) {
      return;
    }

    this.loading.set(true);
    this.onboardingApi
      .getCurrentPlan()
      .pipe(
        take(1),
        map((response) => response.data ?? null),
        tap((plan) => {
          this.currentPlan.set(plan ? normalizeWorkoutPlanView(plan) : null);
          this.hasLoadedCurrentPlan = true;
        }),
        catchError(() => {
          this.currentPlan.set(null);
          this.hasLoadedCurrentPlan = true;
          return EMPTY;
        }),
        finalize(() => {
          this.loading.set(false);
        }),
      )
      .subscribe();
  }

  deleteCurrentPlan(): void {
    if (this.deleting() || this.loading()) {
      return;
    }

    this.deleteError.set(null);
    this.deleting.set(true);

    this.onboardingApi
      .deleteCurrentPlan()
      .pipe(
        take(1),
        map((response: DeleteCurrentPlanResponse) => response.data),
        tap((result) => {
          if (result?.deleted) {
            this.currentPlan.set(null);
            this.hasLoadedCurrentPlan = true;
            return;
          }

          this.deleteError.set('Unable to delete current plan.');
        }),
        catchError(() => {
          this.deleteError.set('Unable to delete current plan.');
          return EMPTY;
        }),
        finalize(() => {
          this.deleting.set(false);
        }),
      )
      .subscribe();
  }

  generatePlan(profile: ProfilePayload, assessment: AssessmentPayload) {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    this.jobError.set(null);

    this.onboardingApi
      .generatePlan(profile, assessment)
      .pipe(
        take(1),
        map((response) => response.data),
        tap((plan) => {
          this.setCurrentPlan(plan);
        }),
        catchError((err) => {
          console.error('Plan generation failed:', err);
          this.jobError.set('Failed to generate workout plan. Please try again.');
          return EMPTY;
        }),
        finalize(() => {
          this.loading.set(false);
        }),
      )
      .subscribe();
  }
}

type UnknownRecord = Record<string, unknown>;

function normalizeWorkoutPlanView(payload: unknown): WorkoutPlanView {
  const record = asRecord(payload);
  const rawPlan = asRecord(record['plan']);
  const rawDays = Array.isArray(rawPlan['days']) ? rawPlan['days'] : [];
  const days = rawDays.map((day, index) => normalizeDay(day, index));
  const warnings = normalizeStringList(record['warnings']).length
    ? normalizeStringList(record['warnings'])
    : normalizeStringList(rawPlan['warnings']);

  return {
    id: asString(record['id'], asString(rawPlan['planId'], '')),
    source: (record['source'] === 'fallback'
      ? 'fallback'
      : record['source'] === 'repaired'
        ? 'repaired'
        : 'ai') as 'ai' | 'fallback' | 'repaired',
    model: asString(record['model'], ''),
    createdAt: asString(record['createdAt'], ''),
    cached: record['cached'] === true,
    inputHash: asString(record['inputHash'], ''),
    plan: {
      schemaVersion: '1.0',
      source: (rawPlan['source'] === 'fallback'
        ? 'fallback'
        : rawPlan['source'] === 'repaired'
          ? 'repaired'
          : 'ai') as 'ai' | 'fallback' | 'repaired',
      days,
      progression: normalizeProgression(rawPlan['progression']) || {
        baselineIntensity: 'low-moderate',
        progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
        increasePercent: 10,
        conditions: [],
      },
      safetyNotes: normalizeStringList(rawPlan['safetyNotes']).length
        ? normalizeStringList(rawPlan['safetyNotes'])
        : normalizeStringList(asRecord(rawPlan['safety'])['guidance'] || rawPlan['safetyNotes']),
      warnings,
    },
  };
}

function normalizeDay(value: unknown, index: number): WorkoutDayView {
  const day = asRecord(value);
  const rawExercises = Array.isArray(day['exercises']) ? day['exercises'] : [];

  return {
    dayNumber: asNumber(day['dayNumber'], index + 1),
    name: asString(day['name'], `Day ${index + 1}`),
    focus: asString(day['focus'], 'General'),
    exercises: rawExercises
      .map(normalizeExercise)
      .filter((exercise): exercise is WorkoutExerciseView => {
        if (exercise) {
          return true;
        }
        console.warn('workout_plan.invalid_exercise_omitted', { day: index + 1 });
        return false;
      }),
  };
}

function normalizeExercise(value: unknown): WorkoutExerciseView | null {
  const exercise = asRecord(value);
  const masterExerciseId = optionalString(exercise['masterExerciseId']);
  if (!masterExerciseId || !/^ex_catalog_[a-z0-9_]+_\d{4}$/i.test(masterExerciseId)) {
    return null;
  }

  return {
    id: asString(exercise['id'], masterExerciseId),
    masterExerciseId,
    name: asString(exercise['name'], 'Exercise'),
    muscleGroup: asString(exercise['muscleGroup'], ''),
    movementPattern: asString(exercise['movementPattern'], ''),
    sets: asNumber(exercise['sets'], 0),
    reps: asString(exercise['reps'], ''),
    rpe: optionalNumber(exercise['rpe']),
    notes: optionalString(exercise['notes']),
    restSeconds: asNumber(exercise['restSeconds'], 60),
  };
}

function normalizeProgression(value: unknown): PlanProgression | undefined {
  const progression = asRecord(value);
  if (!Object.keys(progression).length) {
    return undefined;
  }

  return {
    baselineIntensity: asString(progression['baselineIntensity'], 'low-moderate') as 'low-moderate',
    progressionRule: asString(
      progression['progressionRule'],
      'Increase load or reps by +10% after 2 pain-free sessions.',
    ),
    increasePercent: asNumber(progression['increasePercent'], 10),
    conditions: normalizeStringList(progression['conditions']),
  };
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asString(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return fallback;
}

function optionalString(value: unknown): string | undefined {
  const text = asString(value, '');
  return text ? text : undefined;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item, '')).filter(Boolean);
  }

  const item = asString(value, '');
  return item ? [item] : [];
}
