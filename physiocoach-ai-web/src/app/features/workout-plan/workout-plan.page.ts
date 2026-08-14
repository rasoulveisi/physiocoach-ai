import { AsyncPipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, EMPTY, take } from 'rxjs';
import { MessageService } from 'primeng/api';

import { WorkoutPlanStore } from './workout-plan.store';
import { type WorkoutExerciseView, type WorkoutDayView } from './workout-plan.model';
import { WorkoutSessionStore } from '../workout-session/workout-session.store';
import { ExerciseCatalogApiService } from '../exercise-catalog/exercise-catalog-api.service';
import { type ExerciseCatalogMediaDto } from '../exercise-catalog/exercise-catalog.model';
import { PageStateComponent } from '../../shared/ui/page-state.component';
import { SkeletonBlockComponent } from '../../shared/ui/skeleton-block.component';
import { resolveExerciseSafetyNotes } from '../../shared/ui/exercise-safety-notes';
import { ExerciseVisualComponent } from '../../shared/ui/exercise-visual.component';

type StoredFeedbackMap = Record<string, string>;
type ExerciseOpenKey = `${number}-${number}`;

@Component({
  standalone: true,
  imports: [
    AsyncPipe,
    RouterLink,
    PageStateComponent,
    SkeletonBlockComponent,
    ExerciseVisualComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workout-plan.page.html',
})
export class WorkoutPlanPage {
  protected readonly planStore = inject(WorkoutPlanStore);
  private readonly messageService = inject(MessageService);
  private readonly exerciseCatalogApi = inject(ExerciseCatalogApiService);
  private readonly router = inject(Router);
  protected readonly sessionStore = inject(WorkoutSessionStore);
  protected readonly planFeedback = signal<string | null>(null);
  protected readonly expandedDayIndex = signal<number | null>(null);
  protected readonly expandedExerciseKeys = signal<Set<ExerciseOpenKey>>(new Set());
  protected readonly exerciseMedia = signal<Record<string, ExerciseCatalogMediaDto>>({});
  protected readonly exerciseImageLoadingState = signal<Record<string, boolean>>({});
  private readonly platformId = inject(PLATFORM_ID);
  private readonly feedbackStorageKey = 'physiocoach_plan_feedback_v1';
  private readonly feedbacks = signal<StoredFeedbackMap>({});
  private previousDeleting = this.planStore.deleting();
  private deleteRequestedFromPage = false;
  private exerciseMediaLookupVersion = 0;

  protected readonly feedbackOptions = [
    { value: 'clear', label: 'Clear' },
    { value: 'unclear', label: 'Unclear' },
    { value: 'too_easy', label: 'Too easy' },
    { value: 'too_hard', label: 'Too hard' },
  ];

  constructor() {
    this.planStore.ensureCurrentPlan();
    this.feedbacks.set(this.readFeedbackState());
    this.configurePlanDeleteToasts();
    effect(() => {
      const current = this.planStore.currentPlan();
      if (!current || !isPlatformBrowser(this.platformId)) {
        this.planFeedback.set(null);
        return;
      }

      this.planFeedback.set(this.feedbacks()[current.id] ?? null);
    });
    effect(() => {
      const current = this.planStore.currentPlan();
      if (!current) {
        this.exerciseMediaLookupVersion += 1;
        this.exerciseMedia.set({});
        this.exerciseImageLoadingState.set({});
        return;
      }

      const lookupVersion = (this.exerciseMediaLookupVersion += 1);
      const nextMedia: Record<string, ExerciseCatalogMediaDto> = {};
      const previousMedia = untracked(() => this.exerciseMedia());
      const previousLoadingState = untracked(() => this.exerciseImageLoadingState());
      const nextLoadingState: Record<string, boolean> = {};
      const exercises = current.plan.days.flatMap((day) => day.exercises);
      const missingExercises: WorkoutExerciseView[] = [];
      const missingKeys = new Set<string>();
      for (const exercise of exercises) {
        const key = this.exerciseMediaKey(exercise);
        nextLoadingState[key] = previousLoadingState[key] ?? true;
        const existing = previousMedia[key];
        if (existing) {
          nextMedia[key] = existing;
          continue;
        }

        if (!missingKeys.has(key)) {
          missingKeys.add(key);
          missingExercises.push(exercise);
        }
      }

      if (!this.shallowEqualRecords(previousLoadingState, nextLoadingState)) {
        this.exerciseImageLoadingState.set(nextLoadingState);
      }

      if (!this.shallowEqualRecords(previousMedia, nextMedia)) {
        this.exerciseMedia.set(nextMedia);
      }

      if (missingExercises.length) {
        this.exerciseCatalogApi
          .loadExerciseMediaBatch(
            missingExercises.map((exercise) => ({
              key: this.exerciseMediaKey(exercise),
            exerciseId: exercise.masterExerciseId ?? undefined,
            name: exercise.name,
            movementPattern: exercise.movementPattern,
            muscleGroup: exercise.muscleGroup,
            })),
          )
          .pipe(
            take(1),
            catchError(() => {
              if (lookupVersion !== this.exerciseMediaLookupVersion) {
                return EMPTY;
              }
              for (const exercise of missingExercises) {
                this.setExerciseImageLoadingState(exercise, false);
              }
              return EMPTY;
            }),
          )
          .subscribe((mediaByKey) => {
            if (lookupVersion !== this.exerciseMediaLookupVersion) {
              return;
            }
            const resolvedMedia: Record<string, ExerciseCatalogMediaDto> = {};
            for (const exercise of missingExercises) {
              const key = this.exerciseMediaKey(exercise);
              this.setExerciseImageLoadingState(exercise, false);
              const media = mediaByKey[key];
              if (media) {
                resolvedMedia[key] = media;
              }
            }
            if (Object.keys(resolvedMedia).length) {
              this.exerciseMedia.update((currentMedia) => ({ ...currentMedia, ...resolvedMedia }));
            }
          });
      }
    });
  }

  protected configurePlanDeleteToasts(): void {
    effect(() => {
      const deleting = this.planStore.deleting();
      const deleteError = this.planStore.deleteError();
      const hasCurrentPlan = !!this.planStore.currentPlan();

      if (!this.previousDeleting && deleting) {
        this.deleteRequestedFromPage = true;
        this.messageService.add({
          severity: 'info',
          summary: 'Deleting plan',
          detail: 'Request sent',
          life: 2000,
        });
      }

      if (this.previousDeleting && !deleting && this.deleteRequestedFromPage) {
        if (deleteError) {
          this.messageService.add({
            severity: 'error',
            summary: 'Plan not deleted',
            detail: deleteError,
            life: 3000,
          });
        } else if (!hasCurrentPlan) {
          this.messageService.add({
            severity: 'success',
            summary: 'Plan deleted',
            detail: 'Current plan removed.',
            life: 2500,
          });
        }
        this.deleteRequestedFromPage = false;
      }

      this.previousDeleting = deleting;
    });
  }

  private shallowEqualRecords<TValue>(left: Record<string, TValue>, right: Record<string, TValue>): boolean {
    if (Object.keys(left).length !== Object.keys(right).length) {
      return false;
    }

    for (const [key, value] of Object.entries(right)) {
      if (left[key] !== value) {
        return false;
      }
    }

    return true;
  }

  protected recordFeedback(value: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const current = this.planStore.currentPlan();
    if (!current) {
      return;
    }

    const updated: StoredFeedbackMap = {
      ...this.feedbacks(),
      [current.id]: value,
    };

    this.feedbacks.set(updated);
    this.planFeedback.set(value);
    let persisted = false;
    try {
      localStorage.setItem(this.feedbackStorageKey, JSON.stringify(updated));
      persisted = true;
    } catch {
      this.messageService.add({
        severity: 'info',
        summary: 'Feedback saved',
        detail: 'Saved in memory only; local storage is unavailable.',
        life: 3000,
      });
    }

    if (persisted) {
      this.messageService.add({
        severity: 'success',
        summary: 'Feedback saved',
        detail: 'Your plan feedback was saved.',
        life: 2200,
      });
    } else {
      // Keep best-effort in-memory feedback when localStorage is unavailable.
    }
  }

  protected totalExercises(current: { plan: { days: { exercises: unknown[] }[] } }): number {
    return current.plan.days.reduce((total, day) => total + day.exercises.length, 0);
  }

  protected estimatedMinutes(current: {
    plan: { days: { exercises: { sets: number; restSeconds?: number }[] }[] };
  }): number {
    const dayCount = current.plan.days.length;
    if (!dayCount) {
      return 25;
    }

    const totalSets = current.plan.days.reduce(
      (sum, day) => sum + day.exercises.reduce((daySum, exercise) => daySum + exercise.sets, 0),
      0,
    );
    const averageSets = totalSets / dayCount;

    return Math.max(25, Math.round(averageSets * 2.5));
  }

  protected dayMuscles(day: WorkoutDayView): string[] {
    return Array.from(
      new Set(
        day.exercises
          .map((exercise) => exercise.muscleGroup.trim())
          .filter(Boolean),
      ),
    ).slice(0, 4);
  }

  protected dayVolume(day: WorkoutDayView): number {
    return day.exercises.reduce((total, exercise) => total + exercise.sets, 0);
  }

  protected startDay(dayIndex: number): void {
    const plan = this.planStore.currentPlan();
    if (!plan) {
      return;
    }

    const scheduledDate = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `${plan.id}:${dayIndex}:${scheduledDate}`;
    this.sessionStore.createSession(
      {
        workoutPlanId: plan.id,
        dayIndex,
        scheduledDate,
      },
      idempotencyKey,
    );
    void this.router.navigate(['/session']);
  }

  protected isExerciseImageLoading(exercise: WorkoutExerciseView): boolean {
    return this.exerciseImageLoadingState()[this.exerciseMediaKey(exercise)] ?? true;
  }

  protected hasMovementPattern(value?: string): boolean {
    return !!(value && value.trim());
  }

  protected hasMuscleGroup(value?: string): boolean {
    return !!(value && value.trim());
  }

  protected formatSetRepLabel(sets: number, reps: string): string {
    return `${sets} × ${reps}`;
  }

  protected rpeValue(rpe?: number): number | null {
    if (typeof rpe !== 'number' || !Number.isFinite(rpe)) {
      return null;
    }

    return Math.min(10, Math.max(1, Math.round(rpe)));
  }

  protected rpeLabel(rpe?: number): string {
    const value = this.rpeValue(rpe);
    return value === null ? 'RPE' : `RPE ${value}`;
  }

  protected isHighRpe(rpe?: number): boolean {
    return (this.rpeValue(rpe) ?? 0) >= 8;
  }

  protected rpeRingGradient(rpe?: number): string {
    const normalized = this.rpeValue(rpe);
    if (normalized === null) {
      return '';
    }

    const percent = Math.min(100, Math.max(0, (normalized / 10) * 100));
    return `conic-gradient(var(--color-brand-500) ${percent}%, var(--color-surface-border) ${percent}%)`;
  }

  protected exerciseMediaFor(exercise: WorkoutExerciseView): ExerciseCatalogMediaDto | null {
    return this.exerciseMedia()[this.exerciseMediaKey(exercise)] ?? null;
  }

  protected isDayExpanded(dayIndex: number): boolean {
    return this.expandedDayIndex() === dayIndex;
  }

  protected isExerciseExpanded(dayIndex: number, exerciseIndex: number): boolean {
    const key = `${dayIndex}-${exerciseIndex}`;
    return this.expandedExerciseKeys().has(key as ExerciseOpenKey);
  }

  protected toggleDay(dayIndex: number): void {
    this.expandedDayIndex.set(this.expandedDayIndex() === dayIndex ? null : dayIndex);
  }

  protected toggleExercise(dayIndex: number, exerciseIndex: number): void {
    const key = `${dayIndex}-${exerciseIndex}` as ExerciseOpenKey;
    const next = new Set(this.expandedExerciseKeys());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.expandedExerciseKeys.set(next);
  }

  protected onExerciseCardKeydown(
    event: KeyboardEvent,
    dayIndex: number,
    exerciseIndex: number,
  ): void {
    const isSpace = event.key === ' ' || event.code === 'Space' || event.key === 'Spacebar';
    if (!isSpace) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.toggleExercise(dayIndex, exerciseIndex);
  }

  protected exerciseSafetyTips(name: string): string[] {
    const tips = resolveExerciseSafetyNotes(name).tips;
    return Array.isArray(tips) && tips.length
      ? tips
      : ['Use a weight you can control from start to finish.'];
  }

  protected safetyItems(items: readonly string[] | null | undefined): readonly string[] {
    return Array.isArray(items) ? items : [];
  }

  private exerciseMediaKey(exercise: WorkoutExerciseView): string {
    return [
      exercise.masterExerciseId || '',
      exercise.name,
      exercise.movementPattern,
      exercise.muscleGroup,
    ].join('|');
  }

  protected deleteCurrentPlan(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (!this.planStore.currentPlan()) {
      return;
    }

    const confirmDelete = window.confirm('Delete the current plan? This action cannot be undone.');
    if (!confirmDelete) {
      return;
    }

    this.planStore.deleteCurrentPlan();
  }

  private setExerciseImageLoadingState(exercise: WorkoutExerciseView | null, isLoading: boolean): void {
    if (!exercise) {
      return;
    }

    const key = this.exerciseMediaKey(exercise);
    const current = this.exerciseImageLoadingState();
    if (current[key] === isLoading) {
      return;
    }

    this.exerciseImageLoadingState.set({
      ...current,
      [key]: isLoading,
    });
  }

  private readFeedbackState(): StoredFeedbackMap {
    if (!isPlatformBrowser(this.platformId)) {
      return {};
    }

    try {
      const raw = localStorage.getItem(this.feedbackStorageKey);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as StoredFeedbackMap;
      }
    } catch {
      // Ignore and treat as an empty map.
    }

    return {};
  }
}
