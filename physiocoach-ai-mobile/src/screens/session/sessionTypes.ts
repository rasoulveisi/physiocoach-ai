/**
 * PhysioCoach AI — Live session local types.
 * Shared between the LiveSessionScreen and its child components.
 */

import type { LoggedSet, SetType } from '../../api/sessions';
import type { Exercise, WorkoutDay, WorkoutPlan } from '../../api/plans';

/** Lifecycle of the floating rest timer HUD. */
export type TimerPhase = 'idle' | 'running' | 'done';

/** A day exercise enriched with live logging state for the current session. */
export interface SessionExerciseState {
  exercise: Exercise;
  /** Sets logged so far for this exercise. */
  logged: LoggedSet[];
  /** Latest applied AI overload target (kg), if the athlete applied one. */
  appliedTargetKg: number | null;
}

/** Draft of the set currently being logged (the log entry form). */
export interface SetDraft {
  setType: SetType;
  weightKg: number;
  reps: number;
}

/** Data rendered by the celebration summary modal. */
export interface SessionFinishSummary {
  totalSets: number;
  totalReps: number;
  totalVolumeKg: number;
  durationSeconds: number;
  completedExercises: number;
}

/** Normalize any plan/day params into concrete objects for the session. */
export function resolveSessionContext(params: {
  plan?: unknown;
  dayIndex?: number;
  dayName?: string;
}): { plan: WorkoutPlan | null; day: WorkoutDay | null } {
  const plan = (params.plan as WorkoutPlan | undefined) ?? null;

  let day: WorkoutDay | null = null;
  if (plan && Array.isArray(plan.days) && plan.days.length > 0) {
    day =
      plan.days.find((d) => d.dayIndex === params.dayIndex) ??
      plan.days.find((d) => d.dayIndex === plan.currentDayIndex) ??
      plan.days[0];
  }

  // Synthetic day so the session can still run with just a name param.
  if (!day && params.dayName) {
    day = {
      id: `day-${params.dayIndex ?? 0}`,
      dayIndex: params.dayIndex ?? 1,
      name: params.dayName,
      exercises: [],
    };
  }

  return { plan, day };
}
