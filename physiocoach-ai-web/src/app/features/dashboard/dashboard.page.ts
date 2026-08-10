import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

import { DisclaimerComponent } from '../../shared/ui/disclaimer.component';
import { MetricTileComponent } from '../../shared/ui/metric-tile.component';
import { WorkoutPlanStore } from '../workout-plan/workout-plan.store';
import { WorkoutSessionStore } from '../workout-session/workout-session.store';

@Component({
  standalone: true,
  imports: [AsyncPipe, ButtonModule, DisclaimerComponent, MetricTileComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  protected readonly planStore = inject(WorkoutPlanStore);
  protected readonly sessionStore = inject(WorkoutSessionStore);

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  get todayLabel(): string {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  constructor() {
    this.planStore.ensureCurrentPlan();
    this.sessionStore.ensureActiveSession();
    this.sessionStore.ensureRecentSessions();
  }
}
