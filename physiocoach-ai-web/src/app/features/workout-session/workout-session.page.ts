import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { catchError, EMPTY, take } from 'rxjs';

import { WorkoutPlanStore } from '../workout-plan/workout-plan.store';
import { WorkoutSessionStore } from './workout-session.store';
import type { ExerciseLogDto, ExerciseLogGroup } from './workout-session.model';
import { ExerciseCatalogApiService } from '../exercise-catalog/exercise-catalog-api.service';
import type { ExerciseCatalogMediaDto } from '../exercise-catalog/exercise-catalog.model';
import { PageStateComponent } from '../../shared/ui/page-state.component';
import { ExerciseVisualComponent } from '../../shared/ui/exercise-visual.component';

@Component({
  standalone: true,
  imports: [AsyncPipe, ButtonModule, FormsModule, PageStateComponent, ExerciseVisualComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workout-session.page.html',
})
export class WorkoutSessionPage {
  private readonly router = inject(Router);
  private readonly exerciseCatalogApi = inject(ExerciseCatalogApiService);
  protected readonly planStore = inject(WorkoutPlanStore);
  protected readonly sessionStore = inject(WorkoutSessionStore);
  protected readonly exerciseMedia = signal<Record<string, ExerciseCatalogMediaDto>>({});
  protected readonly exerciseMediaLoadingState = signal<Record<string, boolean>>({});
  protected readonly activeSession = toSignal(this.sessionStore.activeSession$, { initialValue: null });
  protected readonly currentPlan = toSignal(this.planStore.currentPlan$, { initialValue: null });

  protected readonly currentLogs = computed(() => this.activeSession()?.logs ?? []);
  protected readonly activeGroupedLogs = computed(() => this.groupedLogs(this.currentLogs()));
  protected readonly nextIncompleteLogSignal = computed(
    () => this.currentLogs().find((log) => !log.completed) ?? null,
  );
  protected readonly completionPercentage = computed(() => {
    const session = this.activeSession();
    if (!session || !session.progress.totalSets) {
      return 0;
    }
    const percent = Math.round((session.progress.completedSets / session.progress.totalSets) * 100);
    return Math.min(100, Math.max(0, percent));
  });

  private exerciseMediaLookupVersion = 0;

  constructor() {
    this.planStore.ensureCurrentPlan();
    this.sessionStore.ensureActiveSession();
    effect(() => {
      const session = this.activeSession();
      if (!session) {
        this.exerciseMediaLookupVersion += 1;
        this.exerciseMedia.set({});
        this.exerciseMediaLoadingState.set({});
        return;
      }

      const lookupVersion = (this.exerciseMediaLookupVersion += 1);
      const previousMedia = untracked(() => this.exerciseMedia());
      const previousLoading = untracked(() => this.exerciseMediaLoadingState());
      const nextMedia: Record<string, ExerciseCatalogMediaDto> = {};
      const nextLoading: Record<string, boolean> = {};
      const missingGroups: ExerciseLogGroup[] = [];

      for (const group of this.groupedLogs(session.logs)) {
        nextLoading[group.key] = previousLoading[group.key] ?? true;
        const existing = previousMedia[group.key];
        if (existing) {
          nextMedia[group.key] = existing;
          nextLoading[group.key] = false;
          continue;
        }

        missingGroups.push(group);
      }

      this.exerciseMedia.set(nextMedia);
      this.exerciseMediaLoadingState.set(nextLoading);

      if (missingGroups.length) {
        this.exerciseCatalogApi
          .loadExerciseMediaBatch(
            missingGroups.map((group) => ({
              key: group.key,
              exerciseId: group.masterExerciseId ?? undefined,
              name: group.name,
              movementPattern: group.movementPattern,
              muscleGroup: group.muscleGroups[0] ?? undefined,
            })),
          )
          .pipe(
            take(1),
            catchError(() => {
              if (lookupVersion !== this.exerciseMediaLookupVersion) {
                return EMPTY;
              }
              for (const group of missingGroups) {
                this.setExerciseMediaLoadingState(group.key, false);
              }
              return EMPTY;
            }),
          )
          .subscribe((mediaByKey) => {
            if (lookupVersion !== this.exerciseMediaLookupVersion) {
              return;
            }
            const resolvedMedia: Record<string, ExerciseCatalogMediaDto> = {};
            for (const group of missingGroups) {
              const media = mediaByKey[group.key];
              if (media) {
                resolvedMedia[group.key] = media;
              }
              this.setExerciseMediaLoadingState(group.key, false);
            }
            if (Object.keys(resolvedMedia).length) {
              this.exerciseMedia.update((current) => ({ ...current, ...resolvedMedia }));
            }
          });
      }
    });
  }

  protected groupedLogs(logs: ExerciseLogDto[]): ExerciseLogGroup[] {
    const validLogs = logs.filter((log) => {
      const id = log.masterExerciseId?.trim() ?? '';
      if (/^ex_catalog_[a-z0-9_]+_\d{4}$/i.test(id)) {
        return true;
      }
      console.warn('workout_session.invalid_exercise_omitted', {
        logId: log.id,
        masterExerciseId: log.masterExerciseId,
        exerciseName: log.exerciseName,
      });
      return false;
    });

    const groups = validLogs.reduce<Record<string, ExerciseLogGroup>>(
      (acc, log) => {
        const key = this.exerciseGroupKey(log);
        acc[key] ??= {
          key,
          name: log.exerciseName,
          masterExerciseId: log.masterExerciseId,
          movementPattern: log.movementPattern,
          muscleGroups: [],
          targetReps: log.targetReps,
          notes: log.notes,
          logs: [],
        };
        acc[key].logs.push(log);
        acc[key].muscleGroups = Array.from(
          new Set([...acc[key].muscleGroups, ...log.muscleGroups]),
        );
        acc[key].targetReps ??= log.targetReps;
        acc[key].notes ??= log.notes;
        return acc;
      },
      {},
    );

    return Object.values(groups);
  }

  protected groupForLog(logs: ExerciseLogDto[], targetLog: ExerciseLogDto): ExerciseLogGroup | null {
    return this.groupedLogs(logs).find((group) => group.logs.some((log) => log.id === targetLog.id)) ?? null;
  }

  protected completionPercent(session: { progress: { completedSets: number; totalSets: number } }): number {
    if (!session.progress.totalSets) {
      return 0;
    }

    const percent = Math.round((session.progress.completedSets / session.progress.totalSets) * 100);
    return Math.min(100, Math.max(0, percent));
  }

  protected nextIncompleteLog(logs: ExerciseLogDto[]): ExerciseLogDto | null {
    return logs.find((log) => !log.completed) ?? null;
  }

  protected exerciseMediaFor(group: ExerciseLogGroup): ExerciseCatalogMediaDto | null {
    return this.exerciseMedia()[group.key] ?? null;
  }

  protected isExerciseMediaLoading(group: ExerciseLogGroup): boolean {
    return this.exerciseMediaLoadingState()[group.key] ?? false;
  }

  protected secondaryMuscles(group: ExerciseLogGroup): string[] {
    return group.muscleGroups.slice(1);
  }

  protected start(workoutPlanId: string, dayIndex: number): void {
    const scheduledDate = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `${workoutPlanId}:${dayIndex}:${scheduledDate}`;

    this.sessionStore.createSession(
      {
        workoutPlanId,
        dayIndex,
        scheduledDate,
      },
      idempotencyKey,
    );
  }

  protected saveSet(
    logId: string,
    reps: string,
    weightKg: string,
    rpe: string,
    completed: boolean,
  ): void {
    this.sessionStore.saveSetLog(logId, {
      reps: Number(reps) || 0,
      weightKg: Number(weightKg) || 0,
      rpe: rpe ? Number(rpe) : undefined,
      completed,
    });
  }

  protected complete(): void {
    this.sessionStore.completeSession();
    void this.router.navigate(['/dashboard']);
  }

  protected startAssessment(): void {
    void this.router.navigate(['/onboarding']);
  }

  private exerciseGroupKey(log: ExerciseLogDto): string {
    return (log.masterExerciseId || log.exerciseName).trim().toLowerCase();
  }

  private setExerciseMediaLoadingState(key: string, loading: boolean): void {
    this.exerciseMediaLoadingState.update((current) => ({ ...current, [key]: loading }));
  }
}
