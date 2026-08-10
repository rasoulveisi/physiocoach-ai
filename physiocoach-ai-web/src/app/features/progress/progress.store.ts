import { inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize, map, of, take, tap } from 'rxjs';

import { ProgressApiService } from './progress-api.service';
import {
  type BodyMeasurement,
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
  private bodyMeasurementsLoading = signal(false);

  readonly loading = signal(false);
  readonly latestBodyMeasurementLoading = this.bodyMeasurementsLoading.asReadonly();
  readonly summary = signal<ProgressSummary>(emptySummary);
  readonly latestBodyMeasurement = signal<BodyMeasurement | null>(null);
  readonly latestBodyMeasurementError = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly loading$ = toObservable(this.loading);
  readonly summary$ = toObservable(this.summary);
  readonly latestBodyMeasurement$ = toObservable(this.latestBodyMeasurement);
  readonly latestBodyMeasurementLoading$ = toObservable(this.bodyMeasurementsLoading);
  readonly latestBodyMeasurementError$ = toObservable(this.latestBodyMeasurementError);
  readonly error$ = toObservable(this.error);

  ensureProgressData(): void {
    this.ensureProgressSummary();
    this.ensureBodyMeasurements();
  }

  loadProgressData(force = false): void {
    this.loadProgressSummary(force);
    this.loadBodyMeasurements(force);
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
}
