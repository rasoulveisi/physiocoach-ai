/**
 * PhysioCoach AI — Explore Marketplace & Prehab API methods.
 * Typed wrappers over the HTTP client for:
 *  - GET  /explore/plans          (community routine marketplace)
 *  - GET  /explore/plans/:id      (full multi-day routine preview)
 *  - POST /workout-plans/:id/clone (save/activate a community routine)
 *  - POST /workout-sessions/prehab (smart warm-up / prehab generator)
 */

import { request, ApiError } from './client';

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

/** Split layouts used by the marketplace filters. */
export type ExploreSplit = 'push_pull_legs' | 'upper_lower' | 'full_body' | 'custom';

/** Free-form persona matching tag (e.g. "Desk Workers", "Hypertrophy Focus"). */
export type PersonaTag = string;

/** Free-form joint safeguard tag (e.g. "Knee-Friendly", "Low Spine Shear"). */
export type JointTag = string;

/** Author card on a community routine. */
export interface ExplorePlanAuthor {
  name: string;
  role: string;
  avatar?: string | null;
  verified: boolean;
}

/** One exercise inside a marketplace routine day. */
export interface ExploreExerciseItem {
  id: string;
  name: string;
  movementPattern: string;
  muscleGroup: string;
  sets: number;
  /** Rep prescription, e.g. "8-10" or "45s hold". */
  reps: string;
  restSeconds?: number | null;
  rpe?: number | null;
  /** Lifting tempo (e.g. "3-0-1-0") when provided by the author/AI. */
  tempo?: string | null;
  notes?: string | null;
  masterExerciseId?: string | null;
}

/** One scheduled day inside a marketplace routine. */
export interface ExploreDayItem {
  dayNumber: number;
  name: string;
  focus: string;
  exercises: ExploreExerciseItem[];
}

/** Progression rules attached to a clinical template. */
export interface ExploreProgression {
  baselineIntensity: string;
  progressionRule: string;
  increasePercent: number;
  conditions: string[];
}

/** Fork lineage when a routine was cloned from another community author. */
export interface ExplorePlanForkInfo {
  planId: string;
  authorName: string;
  planTitle?: string | null;
}

/** A community routine as listed on the Explore marketplace. */
export interface ExplorePlanDto {
  id: string;
  title: string;
  description: string;
  split: ExploreSplit;
  frequencyDays: number;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  equipment: string[];
  jointTags: JointTag[];
  targetPersonas: PersonaTag[];
  totalWeeklySets: number;
  author: ExplorePlanAuthor;
  cloneCount: number;
  days: ExploreDayItem[];
  summary?: string | null;
  safetyNotes?: string[] | null;
  progression?: ExploreProgression | null;
  isVerified: boolean;
  /** Aggregate rating (1-5). */
  rating: number;
  reviewsCount: number;
  createdAt: string;
}

/** One exercise of a generated prehab / warm-up routine (normalized). */
export interface PrehabItem {
  id: string;
  name: string;
  /** Primary joint region targeted (e.g. "Hips", "Shoulders & Scapulae"). */
  targetJoint: string;
  /** Human-readable dose, e.g. "10 reps" or "60s hold". */
  repsOrDuration: string;
  /** Purpose + physio movement cue combined for display. */
  instructions: string;
}

/** Normalized response of the smart warm-up / prehab generator. */
export interface PrehabResponse {
  routineName: string;
  durationMinutes: number;
  /** Joint regions the routine targets (server-detected). */
  targetJoints: string[];
  exercises: PrehabItem[];
}

/** Exercise descriptor accepted by the prehab generator. */
export interface PrehabExerciseInput {
  name: string;
  movementPattern?: string;
  muscleGroups?: string[];
}

/** Query params for GET /explore/plans. */
export interface ExplorePlansParams {
  split?: string;
  jointTag?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildQueryString(params: ExplorePlansParams | undefined): string {
  if (!params) return '';
  const pairs: string[] = [];
  if (params.split && params.split.trim()) pairs.push(`split=${encodeURIComponent(params.split.trim())}`);
  if (params.jointTag && params.jointTag.trim()) {
    // The API exposes joint safeguard filtering as `injuryFilter`.
    pairs.push(`injuryFilter=${encodeURIComponent(params.jointTag.trim())}`);
  }
  if (params.search && params.search.trim()) pairs.push(`search=${encodeURIComponent(params.search.trim())}`);
  if (typeof params.limit === 'number') pairs.push(`limit=${Math.max(1, Math.floor(params.limit))}`);
  if (typeof params.offset === 'number') pairs.push(`offset=${Math.max(0, Math.floor(params.offset))}`);
  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
}

function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

export { isNetworkError };

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/**
 * GET /explore/plans — the community routine marketplace list.
 * Filters: split, joint safeguard tag, free-text search; offset/limit paging.
 */
export async function getExplorePlans(
  params?: ExplorePlansParams,
): Promise<{ data: ExplorePlanDto[]; total: number }> {
  const result = await request<{ data?: ExplorePlanDto[] | null; total?: number | null }>(
    `/explore/plans${buildQueryString(params)}`,
  );
  return {
    data: Array.isArray(result?.data) ? result.data : [],
    total: typeof result?.total === 'number' ? result.total : Array.isArray(result?.data) ? result.data.length : 0,
  };
}

/** GET /explore/plans/:id — full multi-day schedule for the preview modal. */
export async function getExplorePlanById(id: string): Promise<{ data: ExplorePlanDto }> {
  return request<{ data: ExplorePlanDto }>(`/explore/plans/${encodeURIComponent(id)}`);
}

/**
 * POST /workout-plans/:id/clone — save a marketplace routine into the
 * athlete's library. The server activates the clone (archives the previous
 * active plan), so a successful clone is both "saved" and "active".
 */
export async function clonePlan(planId: string): Promise<{ success: boolean; planId: string }> {
  const result = await request<{ data?: { plan?: { id?: string } | null } | null }>(
    `/workout-plans/${encodeURIComponent(planId)}/clone`,
    { method: 'POST', body: {} },
  );
  const clonedId = result?.data?.plan?.id ?? planId;
  return { success: true, planId: clonedId };
}

/** Raw exercise shape returned by the server's prehab generator. */
interface PrehabApiExercise {
  id: string;
  name: string;
  targetJoint: string;
  durationSeconds?: number | null;
  reps?: number | null;
  purpose: string;
  movementCue: string;
}

interface PrehabApiOutput {
  success?: boolean;
  totalMinutes?: number | null;
  targetJoints?: string[] | null;
  routine?: PrehabApiExercise[] | null;
}

function formatDose(item: PrehabApiExercise): string {
  if (typeof item.reps === 'number' && item.reps > 0) return `${item.reps} reps`;
  if (typeof item.durationSeconds === 'number' && item.durationSeconds > 0) {
    return `${item.durationSeconds}s`;
  }
  return 'As prescribed';
}

/**
 * POST /workout-sessions/prehab — clinical warm-up / prehab routine for the
 * upcoming session's movement patterns (or explicitly selected joints via
 * `limitations`).
 */
export async function generatePrehab(
  exercises: PrehabExerciseInput[],
  limitations?: string[],
): Promise<PrehabResponse> {
  const result = await request<PrehabApiOutput>('/workout-sessions/prehab', {
    method: 'POST',
    body: {
      exercises: exercises.map((exercise) => ({
        name: exercise.name,
        ...(exercise.movementPattern ? { movementPattern: exercise.movementPattern } : {}),
        ...(exercise.muscleGroups && exercise.muscleGroups.length > 0
          ? { muscleGroups: exercise.muscleGroups }
          : {}),
      })),
      limitations: limitations ?? [],
    },
  });

  const routine = Array.isArray(result?.routine) ? result.routine : [];
  const targetJoints = Array.isArray(result?.targetJoints) ? result.targetJoints : [];
  const routineName =
    targetJoints.length > 0
      ? `Prehab & Warm-up · ${targetJoints.slice(0, 3).join(' · ')}`
      : 'Smart Warm-up Routine';

  const estimatedMinutes = routine.reduce(
    (sum, item) => sum + (item.durationSeconds ?? (item.reps ?? 10) * 4) / 60,
    0,
  );

  return {
    routineName,
    durationMinutes:
      typeof result?.totalMinutes === 'number' && result.totalMinutes > 0
        ? Math.round(result.totalMinutes)
        : Math.max(5, Math.round(estimatedMinutes)),
    targetJoints,
    exercises: routine.map((item) => ({
      id: item.id,
      name: item.name,
      targetJoint: item.targetJoint,
      repsOrDuration: formatDose(item),
      instructions: [item.purpose, item.movementCue].filter(Boolean).join(' — '),
    })),
  };
}
