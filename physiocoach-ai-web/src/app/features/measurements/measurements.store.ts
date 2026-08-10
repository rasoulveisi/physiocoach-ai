import { inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { catchError, finalize, of, take, tap } from 'rxjs';

import { BodyMeasurement } from '../progress/progress.model';
import { MeasurementsApiService } from './measurements-api.service';

@Injectable({ providedIn: 'root' })
export class MeasurementsStore {
  private readonly api = inject(MeasurementsApiService);
  private hasLoaded = false;

  readonly loading = signal(false);
  readonly measurements = signal<BodyMeasurement[]>([]);
  readonly error = signal<string | null>(null);

  readonly loading$ = toObservable(this.loading);
  readonly measurements$ = toObservable(this.measurements);

  ensureMeasurements(): void {
    if (this.hasLoaded || this.loading()) {
      return;
    }

    this.loadMeasurements();
  }

  loadMeasurements(force = false): void {
    if (!force && (this.hasLoaded || this.loading())) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.api
      .listBodyMeasurements()
      .pipe(
        take(1),
        tap((rows) => {
          this.measurements.set(rows);
          this.hasLoaded = true;
        }),
        catchError((error) => {
          this.error.set(error instanceof Error ? error.message : 'Could not load measurements.');
          this.measurements.set([]);
          this.hasLoaded = true;
          return of([]);
        }),
        finalize(() => {
          this.loading.set(false);
        }),
      )
      .subscribe();
  }
}
