import { computed, inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { catchError, finalize, map, of, take, tap } from 'rxjs';

import { PostureAssessmentApiService } from './posture-assessment-api.service';
import { type LatestAssessment, type Recommendation } from './posture-assessment.model';

const DEFAULT_MESSAGE = {
  status: 'No posture assessment data yet. Complete onboarding first.',
  recommendations: [] as Recommendation[],
};

@Injectable({ providedIn: 'root' })
export class PostureAssessmentStore {
  private readonly api = inject(PostureAssessmentApiService);

  readonly loading = signal(false);
  readonly assessment = signal<LatestAssessment | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading$ = toObservable(this.loading);
  readonly assessment$ = toObservable(this.assessment);
  readonly error$ = toObservable(this.error);

  readonly recommendations = computed(() => {
    return (this.assessment()?.considerations ?? []).map((consideration) => ({
      risk: formatConsiderationCode(consideration.code),
      recommendation: `Use ${consideration.severity}-severity, ${consideration.side} modifications for this consideration.`,
    }));
  });

  readonly recommendations$ = toObservable(this.recommendations);

  readonly latestState = computed(() => {
    if (!this.assessment()) {
      return DEFAULT_MESSAGE;
    }

    return {
      status: `Potential posture patterns detected (${this.assessment()!.completedAt}).`,
      recommendations: this.recommendations(),
    };
  });

  readonly latestState$ = toObservable(this.latestState);

  loadLatestAssessment(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .getLatestAssessment()
      .pipe(
        map((assessment) => {
          if (assessment) {
            return assessment;
          }

          return null;
        }),
        take(1),
        tap((assessment) => {
          this.assessment.set(assessment);
        }),
        catchError((error) => {
          this.error.set(
            error instanceof Error ? error.message : 'Could not load posture assessment.',
          );
          return of(null);
        }),
        finalize(() => {
          this.loading.set(false);
        }),
      )
      .subscribe((assessment) => {
        if (assessment === null) {
          this.assessment.set(null);
        }
      });
  }
}

function formatConsiderationCode(code: string): string {
  return code.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
