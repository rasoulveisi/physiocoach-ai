import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';

import { SkeletonBlockComponent } from '../../shared/ui/skeleton-block.component';
import { MeasurementsStore } from './measurements.store';

@Component({
  standalone: true,
  imports: [ButtonModule, SkeletonBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './measurements.page.html',
})
export class MeasurementsPage {
  protected readonly store = inject(MeasurementsStore);

  constructor() {
    this.store.ensureMeasurements();
  }
}
