import { inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize, map, of, take, tap } from 'rxjs';

import { ProgressApiService } from './progress-api.service';
import {
  type BodyMeasurement,
  type MuscleVolumeEntry,
  type PersonalRecordGroup,
  type ProgressSummary,
} from './progress.model';

const emptySummary: ProgressSummary = {
  workoutsCompletedThisWeek: 0,
  streakDays: 0,
  personalRecords: 0,
  totalVolumeThisWeek: 0,
  plateauDetected: false,
  complianceScore: 0,
  warnings: ['No tracked sessions yet.'],
};

@Injectable({ providedIn: 'root' })
export class ProgressStore {
  private readonly api = inject(ProgressApiService);
  private hasLoadedSummary = false;
  private hasLoadedBodyMeasurements = false;
  private hasLoadedPersonalRecords = false;
  private hasLoadedMuscleVolume = false;
  private bodyMeasurementsLoading = signal(false);
  private personalRecordsLoading = signal(false);
  private muscleVolumeLoading = signal(false);

  readonly loading = signal(false);
  readonly latestBodyMeasurementLoading = this.bodyMeasurementsLoading.asReadonly();
  readonly personalRecordsLoadingState = this.personalRecordsLoading.asReadonly();
  readonly muscleVolumeLoadingState = this.muscleVolumeLoading.asReadonly();
  readonly summary = signal<ProgressSummary>(emptySummary);
  readonly latestBodyMeasurement = signal<BodyMeasurement | null>(null);
  readonly personalRecords = signal<PersonalRecordGroup[]>([]);
  readonly muscleVolume = signal<MuscleVolumeEntry[]>([]);
  readonly latestBodyMeasurementError = signal<string | null>(null);
  readonly personalRecordsError = signal<string | null>(null);
  readonly muscleVolumeError = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly loading$ = toObservable(this.loading);
  readonly summary$ = toObservable(this.summary);
  readonly latestBodyMeasurement$ = toObservable(this.latestBodyMeasurement);
  readonly latestBodyMeasurementLoading$ = toObservable(this.bodyMeasurementsLoading);
  readonly latestBodyMeasurementError$ = toObservable(this.latestBodyMeasurementError);
  readonly personalRecords$ = toObservable(this.personalRecords);
  readonly personalRecordsLoading$ = toObservable(this.personalRecordsLoading);
  readonly personalRecordsError$ = toObservable(this.personalRecordsError);
  readonly muscleVolume$ = toObservable(this.muscleVolume);
  readonly muscleVolumeLoading$ = toObservable(this.muscleVolumeLoading);
  readonly muscleVolumeError$ = toObservable(this.muscleVolumeError);
  readonly error$ = toObservable(this.error);

  ensureProgressData(): void {
    this.ensureProgressSummary();
    this.ensureBodyMeasurements();
    this.ensurePersonalRecords();
    this.ensureMuscleVolume();
  }

  loadProgressData(force = false): void {
    this.loadProgressSummary(force);
    this.loadBodyMeasurements(force);
    this.loadPersonalRecords(force);
    this.loadMuscleVolume(force);
  }

  ensureProgressSummary(): void {
    if (this.hasLoadedSummary || this.loading()) {
      return;
    }

    this.loadProgressSummary();
  }

  ensureBodyMeasurements(): void {
    if (this.hasLoadedBodyMeasurements || this.bodyMeasurementsLoading()) {
      return;
    }

    this.loadBodyMeasurements();
  }

  ensurePersonalRecords(): void {
    if (this.hasLoadedPersonalRecords || this.personalRecordsLoading()) {
      return;
    }

    this.loadPersonalRecords();
  }

  ensureMuscleVolume(): void {
    if (this.hasLoadedMuscleVolume || this.muscleVolumeLoading()) {
      return;
    }

    this.loadMuscleVolume();
  }

  loadProgressSummary(force = false): void {
    if (!force && (this.hasLoadedSummary || this.loading())) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.api
      .getSummary()
      .pipe(
        map((summary) => ({
          ...summary,
          warnings: summary.warnings.length ? summary.warnings : [],
        })),
        take(1),
        tap((summary) => {
          this.summary.set(summary);
          this.hasLoadedSummary = true;
        }),
        catchError((error) => {
          this.error.set(
            error instanceof Error ? error.message : 'Could not load progress summary.',
          );
          this.summary.set(emptySummary);
          this.hasLoadedSummary = true;
          return EMPTY;
        }),
        finalize(() => {
          this.loading.set(false);
        }),
      )
      .subscribe();
  }

  loadBodyMeasurements(force = false): void {
    if (!force && (this.hasLoadedBodyMeasurements || this.bodyMeasurementsLoading())) {
      return;
    }

    this.bodyMeasurementsLoading.set(true);
    this.latestBodyMeasurementError.set(null);

    this.api
      .listBodyMeasurements()
      .pipe(
        take(1),
        map(
          (measurements) =>
            measurements.slice().sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0],
        ),
        tap((latest) => {
          this.latestBodyMeasurement.set(latest ?? null);
          this.hasLoadedBodyMeasurements = true;
        }),
        catchError((error) => {
          this.latestBodyMeasurementError.set(
            error instanceof Error ? error.message : 'Could not load body measurements.',
          );
          this.latestBodyMeasurement.set(null);
          this.hasLoadedBodyMeasurements = true;
          return of(null);
        }),
        finalize(() => {
          this.bodyMeasurementsLoading.set(false);
        }),
      )
      .subscribe();
  }

  loadPersonalRecords(force = false): void {
    if (!force && (this.hasLoadedPersonalRecords || this.personalRecordsLoading())) {
      return;
    }

    this.personalRecordsLoading.set(true);
    this.personalRecordsError.set(null);

    this.api
      .getPersonalRecords()
      .pipe(
        take(1),
        tap((records) => {
          this.personalRecords.set(records ?? []);
          this.hasLoadedPersonalRecords = true;
        }),
        catchError((error) => {
          this.personalRecordsError.set(
            error instanceof Error ? error.message : 'Could not load personal records.',
          );
          this.personalRecords.set([]);
          this.hasLoadedPersonalRecords = true;
          return of([]);
        }),
        finalize(() => {
          this.personalRecordsLoading.set(false);
        }),
      )
      .subscribe();
  }

  loadMuscleVolume(force = false): void {
    if (!force && (this.hasLoadedMuscleVolume || this.muscleVolumeLoading())) {
      return;
    }

    this.muscleVolumeLoading.set(true);
    this.muscleVolumeError.set(null);

    this.api
      .getMuscleVolume()
      .pipe(
        take(1),
        tap((entries) => {
          this.muscleVolume.set(entries ?? []);
          this.hasLoadedMuscleVolume = true;
        }),
        catchError((error) => {
          this.muscleVolumeError.set(
            error instanceof Error ? error.message : 'Could not load muscle volume.',
          );
          this.muscleVolume.set([]);
          this.hasLoadedMuscleVolume = true;
          return of([]);
        }),
        finalize(() => {
          this.muscleVolumeLoading.set(false);
        }),
      )
      .subscribe();
  }
}
