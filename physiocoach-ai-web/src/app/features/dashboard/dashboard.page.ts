import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DisclaimerComponent } from '../../shared/ui/disclaimer.component';
import { WorkoutPlanStore } from '../workout-plan/workout-plan.store';
import { WorkoutSessionStore } from '../workout-session/workout-session.store';
import type { WorkoutSessionDto } from '../workout-session/workout-session.model';

interface WeeklyDay {
  label: string;
  dateKey: string;
  isToday: boolean;
  trained: boolean;
  muscles: string[];
}

interface MuscleRecovery {
  muscle: string;
  daysAgo: number | null;
  recovered: boolean;
  percent: number;
}

@Component({
  standalone: true,
  imports: [AsyncPipe, DisclaimerComponent, RouterLink],
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

  // ── 7-day weekly split tracker ──────────────────────────────
  protected weeklySplit(sessions: WorkoutSessionDto[] | null): WeeklyDay[] {
    const byDate = this.trainedMusclesByDate(sessions ?? []);
    const today = new Date();
    const monday = this.startOfWeek(today);
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return labels.map((label, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const key = this.dateKey(date);
      return {
        label,
        dateKey: key,
        isToday: key === this.dateKey(today),
        trained: byDate.has(key),
        muscles: byDate.get(key) ?? [],
      };
    });
  }

  protected trainedDaysThisWeek(sessions: WorkoutSessionDto[] | null): number {
    return this.weeklySplit(sessions).filter((day) => day.trained).length;
  }

  // ── Muscle recovery overview ────────────────────────────────
  protected muscleRecovery(sessions: WorkoutSessionDto[] | null): MuscleRecovery[] {
    const todayKey = this.dateKey(new Date());
    const latestByMuscle = new Map<string, string>();

    for (const session of sessions ?? []) {
      const key = session.scheduledDate?.slice(0, 10);
      if (!key) {
        continue;
      }
      for (const log of session.logs ?? []) {
        for (const muscle of log.muscleGroups ?? []) {
          const normalized = muscle.trim().toLowerCase();
          if (!normalized) {
            continue;
          }
          const existing = latestByMuscle.get(normalized);
          if (!existing || key > existing) {
            latestByMuscle.set(normalized, key);
          }
        }
      }
    }

    const result: MuscleRecovery[] = [];
    for (const [muscle, key] of latestByMuscle) {
      const daysAgo = this.daysBetween(key, todayKey);
      result.push({
        muscle: this.titleCase(muscle),
        daysAgo,
        recovered: daysAgo >= 2,
        percent: Math.min(100, Math.round((daysAgo / 2) * 100)),
      });
    }

    result.sort((a, b) => (a.daysAgo ?? 99) - (b.daysAgo ?? 99));
    return result.slice(0, 6);
  }

  // ── Streak widget ───────────────────────────────────────────
  protected streakCount(sessions: WorkoutSessionDto[] | null): number {
    const trained = new Set(
      (sessions ?? []).map((session) => session.scheduledDate?.slice(0, 10)).filter(Boolean),
    );
    const cursor = new Date();
    if (!trained.has(this.dateKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }

    let streak = 0;
    while (trained.has(this.dateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  protected recoveryReadyCount(sessions: WorkoutSessionDto[] | null): number {
    return this.muscleRecovery(sessions).filter((item) => item.recovered).length;
  }

  protected muscleRecoveryColor(recovered: boolean): string {
    return recovered ? 'bg-cyan-500' : 'bg-cyan-500/50';
  }

  // ── Internal date helpers ───────────────────────────────────
  private trainedMusclesByDate(sessions: WorkoutSessionDto[]): Map<string, string[]> {
    const byDate = new Map<string, string[]>();
    for (const session of sessions) {
      const key = session.scheduledDate?.slice(0, 10);
      if (!key) {
        continue;
      }
      const muscles = Array.from(
        new Set((session.logs ?? []).flatMap((log) => log.muscleGroups ?? [])),
      );
      byDate.set(key, muscles);
    }
    return byDate;
  }

  private startOfWeek(date: Date): Date {
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  private dateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private daysBetween(fromKey: string, toKey: string): number {
    const from = new Date(`${fromKey}T00:00:00`);
    const to = new Date(`${toKey}T00:00:00`);
    return Math.round((to.getTime() - from.getTime()) / 86_400_000);
  }

  private titleCase(value: string): string {
    return value.replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
