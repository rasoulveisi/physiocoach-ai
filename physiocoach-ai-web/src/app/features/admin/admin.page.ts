import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CardModule } from 'primeng/card';

import { SkeletonBlockComponent } from '../../shared/ui/skeleton-block.component';
import { AdminStore } from './admin.store';

@Component({
  standalone: true,
  imports: [CardModule, SkeletonBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin.page.html',
})
export class AdminPage {
  protected readonly admin = inject(AdminStore);

  constructor() {
    this.admin.load();
  }
}
