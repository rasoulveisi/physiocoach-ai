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
// Endpoints
// ---------------------------------------------------------------------------

/** GET /workout-plans/current (fallback: /workout-plans/active). */
export async function getCurrentPlan(): Promise<{ plan: WorkoutPlan | null }> {
  try {
    return await request<{ plan: WorkoutPlan | null }>('/workout-plans/current');
  } catch (error) {
    // Some deployments expose the active plan under /active — fall back once.
    if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) {
      return request<{ plan: WorkoutPlan | null }>('/workout-plans/active');
    }
    throw error;
  }
}

/** GET /workout-plans — the athlete's saved routines ("My Plans Library"). */
export async function getMyPlans(): Promise<{ plans: WorkoutPlan[] }> {
  return request<{ plans: WorkoutPlan[] }>('/workout-plans');
}

/** POST /workout-plans/:id/activate — 1-click plan switcher. */
export async function activatePlan(planId: string): Promise<{ success: boolean; plan: WorkoutPlan }> {
  return request<{ success: boolean; plan: WorkoutPlan }>(
    `/workout-plans/${encodeURIComponent(planId)}/activate`,
    { method: 'POST', body: {} },
  );
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
