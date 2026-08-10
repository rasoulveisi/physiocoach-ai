import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CardModule } from 'primeng/card';

import { DisclaimerComponent } from '../../shared/ui/disclaimer.component';
import { PostureAssessmentStore } from './posture-assessment.store';
import { SkeletonBlockComponent } from '../../shared/ui/skeleton-block.component';

@Component({
  standalone: true,
  imports: [AsyncPipe, CardModule, DisclaimerComponent, SkeletonBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './posture-assessment.page.html',
})
export class PostureAssessmentPage {
  protected readonly store = inject(PostureAssessmentStore);

  constructor() {
    this.store.loadLatestAssessment();
  }
}
