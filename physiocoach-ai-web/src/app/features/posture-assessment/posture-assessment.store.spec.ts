import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PostureAssessmentApiService } from './posture-assessment-api.service';
import { type LatestAssessment } from './posture-assessment.model';
import { PostureAssessmentStore } from './posture-assessment.store';

class FakePostureAssessmentApiService {
  getLatestAssessment() {
    return of<LatestAssessment | null>({
      goals: ['posture_improvement'],
      frequencyDays: 3,
      equipment: ['dumbbells_only'],
      limitations: [],
      postureFlags: ['rounded_shoulders', 'knee_pain'],
      considerations: [
        { code: 'knee_pain', severity: 'moderate', side: 'bilateral', inferred: false },
      ],
      completedAt: '2026-06-04T10:00:00.000Z',
      inputHash: 'hash-1',
    });
  }
}

describe('PostureAssessmentStore', () => {
  it('builds recommendations from persisted considerations', () => {
    TestBed.configureTestingModule({
      providers: [
        PostureAssessmentStore,
        { provide: PostureAssessmentApiService, useClass: FakePostureAssessmentApiService },
      ],
    });

    const store = TestBed.inject(PostureAssessmentStore);
    store.loadLatestAssessment();

    expect(store.assessment()?.considerations[0]?.code).toBe('knee_pain');
    expect(store.recommendations()).toEqual([
      {
        risk: 'Knee Pain',
        recommendation: 'Use moderate-severity, bilateral modifications for this consideration.',
      },
    ]);
    expect(store.latestState().status).toContain('Potential posture patterns detected');
  });
});
