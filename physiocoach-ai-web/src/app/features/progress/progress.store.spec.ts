import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ProgressApiService } from './progress-api.service';
import {
  type BodyMeasurement,
  type ProgressSummary,
} from './progress.model';
import { ProgressStore } from './progress.store';

class FakeProgressApiService {
  getSummary() {
    return of<ProgressSummary>({
      workoutsCompletedThisWeek: 3,
      streakDays: 2,
      personalRecords: 1,
      totalVolumeThisWeek: 1200,
      plateauDetected: false,
      complianceScore: 75,
      warnings: [],
    });
  }

  listBodyMeasurements() {
    return of<BodyMeasurement[]>([
      {
        id: 'measurement_1',
        measuredAt: '2026-06-04T10:00:00.000Z',
        bodyWeightKg: 74,
        waistCm: 82,
      } as BodyMeasurement,
    ]);
  }

  getPersonalRecords() {
    return of([]);
  }

  getMuscleVolume() {
    return of([]);
  }
}

describe('ProgressStore', () => {
  it('loads summary and latest measurement', () => {
    TestBed.configureTestingModule({
      providers: [ProgressStore, { provide: ProgressApiService, useClass: FakeProgressApiService }],
    });

    const store = TestBed.inject(ProgressStore);

    store.loadProgressData();

    expect(store.summary().workoutsCompletedThisWeek).toBe(3);
    expect(store.latestBodyMeasurement()?.waistCm).toBe(82);
  });

  it('keeps summary and latest body measurement errors separate', () => {
    class SummaryErrorApiService {
      getSummary() {
        return throwError(() => new Error('summary unavailable'));
      }

      listBodyMeasurements() {
        return throwError(() => new Error('measurement unavailable'));
      }

      getPersonalRecords() {
        return of([]);
      }

      getMuscleVolume() {
        return of([]);
      }
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ProgressStore,
        { provide: ProgressApiService, useClass: SummaryErrorApiService },
      ],
    });

    const store = TestBed.inject(ProgressStore);

    store.loadProgressData();

    expect(store.error()).toBe('summary unavailable');
    expect(store.latestBodyMeasurementError()).toBe('measurement unavailable');
    expect(store.latestBodyMeasurement()).toBeNull();
    expect(store.summary().workoutsCompletedThisWeek).toBe(0);
  });

  it('keeps successful body measurement load independent of summary state', () => {
    class SummaryErrorBodySuccessApiService {
      getSummary() {
        return throwError(() => new Error('summary unavailable'));
      }

      listBodyMeasurements() {
        return of<BodyMeasurement[]>([
          {
            id: 'measurement_2',
            measuredAt: '2026-06-10T10:00:00.000Z',
            bodyWeightKg: 78,
            waistCm: 82,
          } as BodyMeasurement,
        ]);
      }

      getPersonalRecords() {
        return of([]);
      }

      getMuscleVolume() {
        return of([]);
      }
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ProgressStore,
        { provide: ProgressApiService, useClass: SummaryErrorBodySuccessApiService },
      ],
    });

    const store = TestBed.inject(ProgressStore);

    store.loadProgressData();

    expect(store.error()).toBe('summary unavailable');
    expect(store.latestBodyMeasurementError()).toBeNull();
    expect(store.latestBodyMeasurement()!.id).toBe('measurement_2');
  });
});
