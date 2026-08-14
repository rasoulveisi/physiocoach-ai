import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, EMPTY, take } from 'rxjs';

import { WorkoutPlanStore } from '../workout-plan/workout-plan.store';
import { WorkoutSessionStore } from './workout-session.store';
import { WorkoutTimerService } from './services/workout-timer.service';
import type { ExerciseLogDto, ExerciseLogGroup, ExerciseSetType } from './workout-session.model';
import { ExerciseCatalogApiService } from '../exercise-catalog/exercise-catalog-api.service';
import type { ExerciseCatalogMediaDto } from '../exercise-catalog/exercise-catalog.model';
import { PageStateComponent } from '../../shared/ui/page-state.component';
import { ExerciseVisualComponent } from '../../shared/ui/exercise-visual.component';
import { resolveExerciseSafetyNotes } from '../../shared/ui/exercise-safety-notes';

interface SetDraft {
  reps: number;
  weightKg: number;
  rpe: number | null;
  setType: ExerciseSetType;
}

interface SwapCandidate {
  masterExerciseId: string;
  name: string;
  movementPattern: string;
  muscleGroups: string[];
}

interface SetCategoryOption {
  label: string;
  value: ExerciseSetType;
}

interface PlateDisc {
  weight: number;
  key: string;
}

// IWF Olympic plate colour mapping (functional, data-driven — not decorative).
const PLATE_COLORS: Record<number, string> = {
  20: '#2563eb', // IWF blue
  15: '#eab308', // IWF yellow
  10: '#16a34a', // IWF green
  5: '#f1f5f9', // IWF white
  2.5: '#111827', // IWF black
  1.25: '#94a3b8', // chrome
};

// Disc dimensions (px) — heavier plates render taller/thicker on the sleeve.
const PLATE_SIZES: Record<number, { height: number; width: number }> = {
  20: { height: 48, width: 10 },
  15: { height: 40, width: 9 },
  10: { height: 34, width: 8 },
  5: { height: 28, width: 7 },
  2.5: { height: 22, width: 6 },
  1.25: { height: 18, width: 5 },
};

@Component({
  standalone: true,
  imports: [AsyncPipe, FormsModule, PageStateComponent, ExerciseVisualComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workout-session.page.html',
})
export class WorkoutSessionPage implements OnDestroy {
  private readonly router = inject(Router);
  private readonly exerciseCatalogApi = inject(ExerciseCatalogApiService);
  protected readonly planStore = inject(WorkoutPlanStore);
  protected readonly sessionStore = inject(WorkoutSessionStore);
  protected readonly timer = inject(WorkoutTimerService);
  protected readonly exerciseMedia = signal<Record<string, ExerciseCatalogMediaDto>>({});
  protected readonly exerciseMediaLoadingState = signal<Record<string, boolean>>({});
  protected readonly setDrafts = signal<Record<string, SetDraft>>({});
  protected readonly restAutoStart = signal(true);
  protected readonly swapModalOpen = signal(false);
  protected readonly swapTargetGroupKey = signal<string | null>(null);
  protected readonly plateCalculatorOpen = signal(false);
  protected readonly plateCalculatorLogId = signal<string | null>(null);
  protected readonly plateCalculatorBarWeight = signal(20);
  protected readonly plateCalculatorTargetWeight = signal<number | null>(null);
  protected readonly activeSession = toSignal(this.sessionStore.activeSession$, { initialValue: null });
  protected readonly currentPlan = toSignal(this.planStore.currentPlan$, { initialValue: null });

  protected readonly plateDenominations: readonly number[] = [20, 15, 10, 5, 2.5, 1.25];
  protected readonly platePresets: readonly number[] = [5, 10, 20];
  protected readonly rpeOptions: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  protected readonly setCategoryOptions: readonly SetCategoryOption[] = [
    { label: 'W', value: 'warmup' },
    { label: '1', value: 'working' },
    { label: '2', value: 'working' },
    { label: '3', value: 'working' },
    { label: 'D', value: 'drop' },
    { label: 'F', value: 'failure' },
  ];

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

  protected readonly alternativeExercises = computed<SwapCandidate[]>(() => {
    const plan = this.currentPlan();
    const targetKey = this.swapTargetGroupKey();
    if (!plan) {
      return [];
    }

    const seen = new Set<string>();
    const candidates: SwapCandidate[] = [];
    for (const day of plan.plan.days) {
      for (const exercise of day.exercises) {
        const masterExerciseId = (exercise.masterExerciseId ?? exercise.id).trim();
        if (!masterExerciseId || seen.has(masterExerciseId)) {
          continue;
        }
        if (targetKey && masterExerciseId.toLowerCase() === targetKey) {
          continue;
        }
        seen.add(masterExerciseId);
        candidates.push({
          masterExerciseId,
          name: exercise.name,
          movementPattern: exercise.movementPattern,
          muscleGroups: exercise.muscleGroup ? [exercise.muscleGroup] : [],
        });
      }
    }

    return candidates;
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
        this.setDrafts.set({});
        return;
      }

      this.seedDrafts(session.logs);

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

  ngOnDestroy(): void {
    this.timer.stop();
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
          previousPerformance: log.previousPerformance ?? null,
          logs: [],
        };
        acc[key].logs.push(log);
        acc[key].muscleGroups = Array.from(
          new Set([...acc[key].muscleGroups, ...log.muscleGroups]),
        );
        acc[key].targetReps ??= log.targetReps;
        acc[key].notes ??= log.notes;
        acc[key].previousPerformance ??= log.previousPerformance ?? null;
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

  protected exerciseSafetyChips(group: ExerciseLogGroup): string[] {
    return resolveExerciseSafetyNotes(group.name).tips;
  }

  protected draftFor(log: ExerciseLogDto): SetDraft {
    return this.setDrafts()[log.id] ?? {
      reps: log.reps,
      weightKg: log.weightKg,
      rpe: log.rpe ?? null,
      setType: log.setType ?? 'working',
    };
  }

  protected formatTime(totalSeconds: number): string {
    const clamped = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(clamped / 60);
    const seconds = clamped % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  protected timerProgressPercent(): number {
    const total = this.timer.totalSeconds();
    if (total <= 0) {
      return 0;
    }
    const percent = Math.round((this.timer.remainingSeconds() / total) * 100);
    return Math.min(100, Math.max(0, percent));
  }

  protected readonly timerRingCircumference = 2 * Math.PI * 16;

  protected timerRingOffset(): number {
    const percent = this.timerProgressPercent();
    return this.timerRingCircumference * (1 - percent / 100);
  }

  protected formatWeight(value: number): string {
    if (Number.isInteger(value)) {
      return String(value);
    }
    return value.toFixed(1).replace(/\.0$/, '');
  }

  protected previousBenchmarkLabel(log: ExerciseLogDto): string | null {
    const previous = log.previousPerformance;
    if (!previous || previous.weight <= 0) {
      return null;
    }
    return `Prev: ${this.formatWeight(previous.weight)}kg x ${previous.reps}`;
  }

  protected activeCategoryLabel(group: ExerciseLogGroup, log: ExerciseLogDto): string {
    switch (this.draftFor(log).setType) {
      case 'warmup':
        return 'W';
      case 'drop':
        return 'D';
      case 'failure':
        return 'F';
      case 'working':
        return String(Math.min(this.workingSetNumber(group, log), 3));
    }
  }

  protected categoryActive(group: ExerciseLogGroup, log: ExerciseLogDto, option: SetCategoryOption): boolean {
    return this.activeCategoryLabel(group, log) === option.label;
  }

  protected setRowClass(group: ExerciseLogGroup, log: ExerciseLogDto): string {
    const isNext = log.id === this.nextIncompleteLog(group.logs)?.id;
    const base = 'grid min-w-0 gap-3 rounded-lg border p-3 transition-colors';
    if (isNext) {
      return `${base} border-volt/50 bg-success-surface`;
    }
    if (log.completed) {
      return `${base} border-surface-border bg-surface-0 opacity-75`;
    }
    return `${base} border-surface-border bg-surface-0`;
  }

  protected setCategoryClass(
    group: ExerciseLogGroup,
    log: ExerciseLogDto,
    option: SetCategoryOption,
  ): string {
    const base = 'h-9 min-w-9 rounded-md border px-2 font-mono text-sm font-bold tabular-nums transition-colors pc-no-tap-highlight';
    if (this.categoryActive(group, log, option)) {
      return `${base} border-volt bg-volt text-brand-950`;
    }
    return `${base} border-surface-border bg-surface-raised text-secondary hover:border-surface-border hover:text-primary active:scale-95`;
  }

  protected soundButtonClass(): string {
    const base = 'inline-flex h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors pc-no-tap-highlight active:scale-95';
    return this.timer.soundEnabled()
      ? `${base} border-volt/40 bg-success-surface text-volt`
      : `${base} border-surface-border bg-surface-raised text-muted hover:text-secondary`;
  }

  protected setSetType(log: ExerciseLogDto, type: ExerciseSetType): void {
    this.updateDraft(log.id, { setType: type });
  }

  protected adjustWeight(log: ExerciseLogDto, delta: number): void {
    const draft = this.draftFor(log);
    const next = Math.max(0, Math.round((draft.weightKg + delta) * 10) / 10);
    this.updateDraft(log.id, { weightKg: next });
  }

  protected adjustReps(log: ExerciseLogDto, delta: number): void {
    const draft = this.draftFor(log);
    const next = Math.max(0, draft.reps + delta);
    this.updateDraft(log.id, { reps: next });
  }

  protected setWeight(log: ExerciseLogDto, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateDraft(log.id, { weightKg: Number(value) || 0 });
  }

  protected setReps(log: ExerciseLogDto, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateDraft(log.id, { reps: Math.max(0, Math.trunc(Number(value) || 0)) });
  }

  protected setRpeValue(log: ExerciseLogDto, value: number): void {
    this.updateDraft(log.id, { rpe: value });
  }

  /** Tactile Volt checkmark: toggles the set and starts the rest timer on completion. */
  protected toggleSetCompleteVolt(log: ExerciseLogDto): void {
    const draft = this.draftFor(log);
    const group = this.groupForLog(this.currentLogs(), log);
    const completed = !log.completed;

    this.sessionStore.saveSetLog(log.id, {
      reps: draft.reps,
      weightKg: draft.weightKg,
      rpe: draft.rpe ?? undefined,
      completed,
      setType: draft.setType,
    });

    if (completed && this.restAutoStart()) {
      this.timer.start(group ? this.restSecondsFor(group) : this.defaultRestSeconds);
    }
  }

  protected pauseTimer(): void {
    this.timer.pause();
  }

  protected playTimer(): void {
    if (this.timer.isPaused()) {
      this.timer.resume();
      return;
    }

    if (this.timer.remainingSeconds() > 0) {
      this.timer.start();
      return;
    }

    this.timer.start(this.defaultRestSeconds);
  }

  protected addTime(seconds: number): void {
    this.timer.addTime(seconds);
  }

  protected skipTimer(): void {
    this.timer.skip();
  }

  protected toggleSound(): void {
    this.timer.toggleSound();
  }

  protected toggleAutoStart(event: Event): void {
    this.restAutoStart.set((event.target as HTMLInputElement).checked);
  }

  protected toggleAutoStartChip(): void {
    this.restAutoStart.update((value) => !value);
  }

  protected openSwapModal(groupKey: string): void {
    this.swapTargetGroupKey.set(groupKey);
    this.swapModalOpen.set(true);
  }

  protected swapTargetGroupName(): string {
    const key = this.swapTargetGroupKey();
    if (!key) {
      return '';
    }
    return this.activeGroupedLogs().find((group) => group.key === key)?.name ?? '';
  }

  protected closeSwapModal(): void {
    this.swapModalOpen.set(false);
    this.swapTargetGroupKey.set(null);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeSwapModal();
    }
  }

  protected confirmSwap(candidate: SwapCandidate): void {
    const session = this.activeSession();
    const groupKey = this.swapTargetGroupKey();
    if (!session || !groupKey) {
      return;
    }

    this.sessionStore.swapExercise(session.id, {
      logGroupKey: groupKey,
      newMasterExerciseId: candidate.masterExerciseId,
      newExerciseName: candidate.name,
      newMovementPattern: candidate.movementPattern,
      newMuscleGroups: candidate.muscleGroups,
    });
    this.closeSwapModal();
  }

  protected voltButtonClass(log: ExerciseLogDto): string {
    const base =
      'grid size-12 shrink-0 place-items-center rounded-full border-2 transition-all duration-150 active:scale-90 pc-no-tap-highlight';
    if (log.completed) {
      return `${base} border-volt bg-volt text-brand-950 shadow-volt`;
    }
    return `${base} border-surface-border bg-surface-raised text-muted hover:border-volt hover:text-volt active:border-volt active:text-volt`;
  }

  // ── Barbell plate calculator ────────────────────────────────
  protected openPlateCalculator(log: ExerciseLogDto): void {
    this.plateCalculatorLogId.set(log.id);
    this.plateCalculatorBarWeight.set(20);
    this.plateCalculatorTargetWeight.set(this.draftFor(log).weightKg || null);
    this.plateCalculatorOpen.set(true);
  }

  protected closePlateCalculator(): void {
    this.plateCalculatorOpen.set(false);
    this.plateCalculatorLogId.set(null);
  }

  protected plateCalculatorExerciseName(): string {
    const logId = this.plateCalculatorLogId();
    if (!logId) {
      return '';
    }
    const session = this.activeSession();
    return session?.logs.find((log) => log.id === logId)?.exerciseName ?? '';
  }

  protected setPlateTargetWeight(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const parsed = Number(value);
    this.plateCalculatorTargetWeight.set(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
  }

  protected setPlateBarWeight(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const parsed = Number(value);
    this.plateCalculatorBarWeight.set(Number.isFinite(parsed) && parsed >= 0 ? parsed : 20);
  }

  protected plateCalculatorBreakdown(): {
    sideWeight: number;
    plates: { weight: number; count: number }[];
    remainder: number;
  } | null {
    const target = this.plateCalculatorTargetWeight();
    const bar = this.plateCalculatorBarWeight();
    if (target === null || !Number.isFinite(target) || target <= bar) {
      return null;
    }

    const sideWeight = (target - bar) / 2;
    let remaining = Math.round(sideWeight * 100) / 100;
    const plates: { weight: number; count: number }[] = [];
    for (const denomination of this.plateDenominations) {
      const count = Math.floor(remaining / denomination + 1e-9);
      if (count > 0) {
        plates.push({ weight: denomination, count });
        remaining = Math.round((remaining - count * denomination) * 100) / 100;
      }
    }

    return { sideWeight, plates, remainder: remaining };
  }

  protected plateColor(weight: number): string {
    return PLATE_COLORS[weight] ?? '#94a3b8';
  }

  protected plateHeight(weight: number): number {
    return PLATE_SIZES[weight]?.height ?? 24;
  }

  protected plateWidth(weight: number): number {
    return PLATE_SIZES[weight]?.width ?? 8;
  }

  /** Flatten the per-side plate summary into individual discs for the sleeve graphic. */
  protected plateDiscs(plates: readonly { weight: number; count: number }[]): PlateDisc[] {
    const discs: PlateDisc[] = [];
    for (const plate of plates) {
      for (let i = 0; i < plate.count; i += 1) {
        discs.push({ weight: plate.weight, key: `${plate.weight}-${i}` });
      }
    }
    return discs;
  }

  protected applyPlatePreset(delta: number): void {
    const bar = this.plateCalculatorBarWeight();
    const current = this.plateCalculatorTargetWeight();
    const base = current !== null && current > bar ? current : bar;
    this.plateCalculatorTargetWeight.set(Math.max(bar, Math.round((base + delta) * 10) / 10));
  }

  protected applyPlateTarget(): void {
    const logId = this.plateCalculatorLogId();
    const target = this.plateCalculatorTargetWeight();
    if (logId && target !== null && Number.isFinite(target) && target > 0) {
      this.updateDraft(logId, { weightKg: Math.round(target * 10) / 10 });
    }
    this.closePlateCalculator();
  }

  protected formatPlateWeight(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
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

  protected complete(): void {
    this.sessionStore.completeSession();
    void this.router.navigate(['/dashboard']);
  }

  protected startAssessment(): void {
    void this.router.navigate(['/onboarding']);
  }

  private readonly defaultRestSeconds = 90;

  private restSecondsFor(group: ExerciseLogGroup): number {
    const plan = this.currentPlan();
    if (!plan) {
      return this.defaultRestSeconds;
    }

    for (const day of plan.plan.days) {
      const exercise = day.exercises.find(
        (candidate) => (candidate.masterExerciseId ?? candidate.id) === group.masterExerciseId,
      );
      if (exercise?.restSeconds && exercise.restSeconds > 0) {
        return exercise.restSeconds;
      }
    }

    return this.defaultRestSeconds;
  }

  private workingSetNumber(group: ExerciseLogGroup, log: ExerciseLogDto): number {
    let count = 0;
    for (const candidate of group.logs) {
      if (this.draftFor(candidate).setType === 'working') {
        count += 1;
      }
      if (candidate.id === log.id) {
        return count;
      }
    }
    return Math.max(1, count);
  }

  private updateDraft(logId: string, patch: Partial<SetDraft>): void {
    this.setDrafts.update((current) => {
      const existing = current[logId] ?? {
        reps: 0,
        weightKg: 0,
        rpe: null,
        setType: 'working' as ExerciseSetType,
      };
      return { ...current, [logId]: { ...existing, ...patch } };
    });
  }

  private seedDrafts(logs: ExerciseLogDto[]): void {
    this.setDrafts.update((current) => {
      let changed = false;
      const next = { ...current };
      for (const log of logs) {
        if (!next[log.id]) {
          next[log.id] = {
            reps: log.reps,
            weightKg: log.weightKg,
            rpe: log.rpe ?? null,
            setType: log.setType ?? 'working',
          };
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }

  private exerciseGroupKey(log: ExerciseLogDto): string {
    return (log.masterExerciseId || log.exerciseName).trim().toLowerCase();
  }

  private setExerciseMediaLoadingState(key: string, loading: boolean): void {
    this.exerciseMediaLoadingState.update((current) => ({ ...current, [key]: loading }));
  }
}
