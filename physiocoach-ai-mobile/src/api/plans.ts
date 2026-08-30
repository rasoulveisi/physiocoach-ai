/**
 * PhysioCoach AI — Workout Plans API methods.
 * Typed wrappers over the HTTP client for the /workout-plans surface:
 * current plan, plans library, activation and rating.
 */

import { request } from './client';

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

/** One prescribed set inside an exercise (targets + AI overload coaching). */
export interface PlanSet {
  id: string;
  /** Ordinal of the set within the exercise (1-based). */
  setNumber: number;
  /** Prescribed target load in kilograms (may be null for bodyweight). */
  targetWeightKg?: number | null;
  /** Prescribed rep range for this set. */
  targetRepsMin?: number | null;
  targetRepsMax?: number | null;
  /** Reps-In-Reserve target (0 = failure, 3 = 3 reps left in the tank). */
  targetRir?: number | null;
  /** Lifting tempo, e.g. "3-0-1-0" (eccentric-pause-concentric-pause). */
  tempo?: string | null;
  /** Rest after this set in seconds. */
  restSeconds?: number | null;
  /** AI progressive-overload increment vs. last performance, in kg. */
  overloadIncrementKg?: number | null;
  /** Whether the AI has flagged this set with an overload target. */
  isProgressiveOverload?: boolean;
}

/** A single exercise inside a training day. */
export interface Exercise {
  id: string;
  name: string;
  /** Ordered position within the day (1-based). */
  orderIndex: number;
  /** Optional coaching cue (e.g. "brace before each rep"). */
  notes?: string | null;
  /** Muscle group or movement pattern tag. */
  muscleGroup?: string | null;
  /** Prescribed sets for this exercise. */
  sets: PlanSet[];
}

/** One scheduled training day inside a plan (Day 1: Push, …). */
export interface WorkoutDay {
  id: string;
  /** Ordinal within the plan rotation (1-based). */
  dayIndex: number;
  /** Display name, e.g. "Push" / "Pull" / "Legs". */
  name: string;
  exercises: Exercise[];
}

/** A full training plan / routine. */
export interface WorkoutPlan {
  id: string;
  title: string;
  /** Split layout, e.g. "PPL", "Upper/Lower", "Full Body". */
  split: string;
  /** Human-readable block goal, e.g. "Hypertrophy". */
  goal?: string | null;
  /** 1-based index of the day scheduled today. */
  currentDayIndex?: number | null;
  /** Current week within the block (1-based), when provided by the AI. */
  currentWeek?: number | null;
  totalWeeks?: number | null;
  /** Whether this plan is the athlete's currently active plan. */
  isActive: boolean;
  /** Aggregate rating (1-5) and number of ratings, when available. */
  averageRating?: number | null;
  ratingCount?: number | null;
  days: WorkoutDay[];
}

/** Body for POST /workout-plans/:id/rate. */
export interface RatingPayload {
  /** 1-5 star rating. */
  rating: number;
  /** Optional free-text review. */
  review?: string;
}

// ---------------------------------------------------------------------------
// Normalization Helpers
// ---------------------------------------------------------------------------

export function normalizePlanRecord(raw: unknown): WorkoutPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const payload = (raw as { data?: unknown }).data !== undefined ? (raw as { data?: unknown }).data : raw;
  if (!payload || typeof payload !== 'object') return null;

  const data = payload as Record<string, unknown>;
  const id = (data.id as string) || 'plan-1';
  const rawPlan = (typeof data.plan === 'object' && data.plan !== null ? data.plan : data) as Record<string, unknown>;
  const title = (rawPlan.name as string) || (rawPlan.title as string) || (data.title as string) || 'Active Workout Plan';
  const rawSplit = (rawPlan.scheduleType as string) || (rawPlan.split as string) || (data.split as string) || 'Custom';
  const split =
    rawSplit === 'push_pull_legs'
      ? 'PPL'
      : rawSplit === 'upper_lower'
        ? 'Upper/Lower'
        : rawSplit === 'full_body'
          ? 'Full Body'
          : rawSplit;
  const goal = (rawPlan.summary as string) || (rawPlan.description as string) || (data.description as string) || null;
  const status = (data.status as string) ?? 'active';

  const rawDays = Array.isArray(rawPlan.days) ? rawPlan.days : [];
  const days: WorkoutDay[] = rawDays.map((d: any, dayIdx: number) => {
    const dayIndex = d.dayNumber ?? d.dayIndex ?? dayIdx + 1;
    const name = d.name || `Day ${dayIndex}`;
    const rawExercises = Array.isArray(d.exercises) ? d.exercises : [];

    const exercises: Exercise[] = rawExercises.map((ex: any, exIdx: number) => {
      const exId = ex.id || `ex-${dayIndex}-${exIdx + 1}`;
      const exName = ex.name || 'Exercise';
      const orderIndex = ex.orderIndex ?? exIdx + 1;
      const notes = ex.notes || null;
      const muscleGroup = ex.muscleGroup || ex.movementPattern || null;

      let sets: PlanSet[] = [];
      if (Array.isArray(ex.sets)) {
        sets = ex.sets.map((s: any, sIdx: number) => ({
          id: s.id || `${exId}-set-${sIdx + 1}`,
          setNumber: s.setNumber ?? sIdx + 1,
          targetWeightKg: s.targetWeightKg ?? null,
          targetRepsMin: s.targetRepsMin ?? null,
          targetRepsMax: s.targetRepsMax ?? null,
          targetRir: s.targetRir ?? null,
          tempo: s.tempo ?? null,
          restSeconds: s.restSeconds ?? ex.restSeconds ?? 90,
          overloadIncrementKg: s.overloadIncrementKg ?? null,
          isProgressiveOverload: s.isProgressiveOverload ?? false,
        }));
      } else {
        const setCount = typeof ex.sets === 'number' && ex.sets > 0 ? ex.sets : 3;
        let targetRepsMin = 8;
        let targetRepsMax = 10;
        if (typeof ex.reps === 'string') {
          const parts = ex.reps.split('-').map((p: string) => parseInt(p.trim(), 10));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            targetRepsMin = parts[0];
            targetRepsMax = parts[1];
          } else if (parts.length === 1 && !isNaN(parts[0])) {
            targetRepsMin = parts[0];
            targetRepsMax = parts[0];
          }
        }
        for (let i = 1; i <= setCount; i++) {
          sets.push({
            id: `${exId}-set-${i}`,
            setNumber: i,
            targetRepsMin,
            targetRepsMax,
            targetRir: ex.rpe ? 10 - ex.rpe : 2,
            tempo: ex.tempo ?? '3-0-1-0',
            restSeconds: ex.restSeconds ?? 90,
            isProgressiveOverload: i === 1,
            overloadIncrementKg: 2.5,
          });
        }
      }

      return {
        id: exId,
        name: exName,
        orderIndex,
        notes,
        muscleGroup,
        sets,
      };
    });

    return {
      id: d.id || `day-${dayIndex}`,
      dayIndex,
      name,
      exercises,
    };
  });

  return {
    id,
    title,
    split,
    goal,
    currentDayIndex: 1,
    isActive: status === 'active',
    days,
  };
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** GET /workout-plans/current (fallback: /workout-plans/active). */
export async function getCurrentPlan(): Promise<{ plan: WorkoutPlan | null }> {
  try {
    const raw = await request<unknown>('/workout-plans/current');
    return { plan: normalizePlanRecord(raw) };
  } catch (error) {
    if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) {
      try {
        const fallback = await request<unknown>('/workout-plans/active');
        return { plan: normalizePlanRecord(fallback) };
      } catch {
        return { plan: null };
      }
    }
    return { plan: null };
  }
}

/** GET /workout-plans/my-plans — the athlete's saved routines ("My Plans Library"). */
export async function getMyPlans(): Promise<{ plans: WorkoutPlan[] }> {
  try {
    const raw = await request<{ data?: unknown[] }>('/workout-plans/my-plans');
    const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
    return {
      plans: list
        .map((item) => normalizePlanRecord(item))
        .filter((p): p is WorkoutPlan => p !== null),
    };
  } catch {
    return { plans: [] };
  }
}

/** POST /workout-plans/:id/activate — 1-click plan switcher. */
export async function activatePlan(planId: string): Promise<{ success: boolean; plan: WorkoutPlan }> {
  const result = await request<unknown>(
    `/workout-plans/${encodeURIComponent(planId)}/activate`,
    { method: 'POST', body: {} },
  );
  const plan = normalizePlanRecord(result) ?? {
    id: planId,
    title: 'Active Plan',
    split: 'Custom',
    days: [],
    isActive: true,
  };
  return { success: true, plan };
}

/** POST /workout-plans/:id/rate — 5-star rating + optional review. */
export async function ratePlan(
  planId: string,
  rating: number,
  review?: string,
): Promise<{ success: boolean }> {
  const payload: RatingPayload = review && review.trim() ? { rating, review: review.trim() } : { rating };
  return request<{ success: boolean }>(`/workout-plans/${encodeURIComponent(planId)}/rate`, {
    method: 'POST',
    body: payload,
  });
}
