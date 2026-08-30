/**
 * PhysioCoach AI — Workout Sessions API methods.
 *
 * Typed wrappers over the HTTP client for the /workout-sessions surface.
 * This module owns the translation between the mobile-facing contracts
 * (LoggedSet / WorkoutSession with kg + NORMAL|WARMUP|DROP|FAILURE set types)
 * and the production API contract (strict zod schemas, `working|warmup|drop|
 * failure` set types, {data: ...} envelopes).
 */

import { request, ApiError } from './client';

// ---------------------------------------------------------------------------
// Mobile-facing contracts
// ---------------------------------------------------------------------------

/** Which kind of set was performed (mobile UI enum). */
export type SetType = 'NORMAL' | 'WARMUP' | 'DROP' | 'FAILURE';

/** A single logged set within a session. */
export interface LoggedSet {
  id?: string;
  planSetId?: string | null;
  exerciseId?: string | null;
  exerciseName?: string | null;
  setNumber?: number | null;
  setType: SetType;
  /** Actual load used (kg). */
  weightKg?: number | null;
  /** Actual reps performed. */
  reps?: number | null;
  /** Epoch ms when the set was completed. */
  completedAt?: string | null;
}

/** An in-progress or completed workout session. */
export interface WorkoutSession {
  id: string;
  planId?: string | null;
  planDayId?: string | null;
  planDayName?: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  startedAt: string;
  completedAt?: string | null;
  /** Duration in seconds, once finished. */
  durationSeconds?: number | null;
  loggedSets: LoggedSet[];
  /** Pre-computed server-side totals, when available. */
  totalSets?: number | null;
  totalVolumeKg?: number | null;
}

/** Body for POST /workout-sessions/:id/pain-alert (mobile-facing). */
export interface PainAlertPayload {
  /** Body part selected on the pain modal (mapped to jointRegion). */
  bodyPart: string;
  /** 0 (none) - 10 (unbearable); mapped to painScore. */
  painLevel: number;
  exerciseName?: string;
}

/** Server response to a pain alert: instant AI advice + deload flag. */
export interface PainAlertResponse {
  advice: string;
  deloadRecommended: boolean;
}

// ---------------------------------------------------------------------------
// Production API DTOs (private)
// ---------------------------------------------------------------------------

/** Row returned by GET/POST workout-sessions (buildExerciseLogDto server-side). */
interface ApiExerciseLogDto {
  id: string;
  exerciseName: string;
  movementPattern?: string | null;
  muscleGroups?: string[] | null;
  setIndex: number;
  targetReps?: string | null;
  masterExerciseId?: string | null;
  reps: number;
  weightKg?: number | null;
  rpe?: number | null;
  completed: boolean;
  notes?: string | null;
  setType?: string | null;
}

/** Session DTO returned by the API (buildSessionDto server-side). */
interface ApiSessionDto {
  id: string;
  workoutPlanId?: string | null;
  dayIndex?: number | null;
  status?: 'active' | 'completed' | string;
  scheduledDate?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  progress?: { completedSets?: number | null; totalSets?: number | null } | null;
  logs?: ApiExerciseLogDto[] | null;
}

const SET_TYPE_TO_API: Record<SetType, string> = {
  NORMAL: 'working',
  WARMUP: 'warmup',
  DROP: 'drop',
  FAILURE: 'failure',
};

const API_TO_SET_TYPE: Record<string, SetType> = {
  working: 'NORMAL',
  warmup: 'WARMUP',
  drop: 'DROP',
  failure: 'FAILURE',
};

function mapLogDto(dto: ApiExerciseLogDto): LoggedSet {
  return {
    id: dto.id,
    planSetId: null,
    exerciseId: null,
    exerciseName: dto.exerciseName,
    setNumber: dto.setIndex,
    setType: API_TO_SET_TYPE[dto.setType ?? 'working'] ?? 'NORMAL',
    weightKg: dto.weightKg ?? null,
    reps: dto.reps ?? null,
    completedAt: null,
  };
}

function mapSessionDto(dto: ApiSessionDto): WorkoutSession {
  return {
    id: dto.id,
    planId: dto.workoutPlanId ?? null,
    planDayId: null,
    planDayName: null,
    status: dto.status === 'completed' ? 'COMPLETED' : 'IN_PROGRESS',
    startedAt: dto.startedAt ?? new Date().toISOString(),
    completedAt: dto.completedAt ?? null,
    durationSeconds: null,
    loggedSets: (dto.logs ?? []).map(mapLogDto),
    totalSets: dto.progress?.totalSets ?? null,
    totalVolumeKg: null,
  };
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/**
 * GET /workout-sessions — history for the dashboard feed (mapped from the
 * `{data: [...]}` envelope).
 */
export async function getRecentSessions(): Promise<{ sessions: WorkoutSession[] }> {
  const result = await request<{ data?: ApiSessionDto[] | null }>('/workout-sessions');
  return { sessions: (Array.isArray(result?.data) ? result.data : []).map(mapSessionDto) };
}

/**
 * POST /workout-sessions — open a new live session.
 * Requires the athlete's plan (freestyle sessions run purely locally).
 * `dayIndex` is 1-based on mobile and 0-based on the API.
 */
export async function createSession(input: {
  planId?: string | null;
  dayIndex?: number | null;
}): Promise<{ session: WorkoutSession | null }> {
  if (!input.planId) {
    // Freestyle session: no plan to bind server-side; local-only logging.
    return { session: null };
  }
  const body = {
    workoutPlanId: input.planId,
    dayIndex: Math.max(0, (input.dayIndex ?? 1) - 1),
    scheduledDate: new Date().toISOString().slice(0, 10),
  };
  const result = await request<{ data?: ApiSessionDto | null }>('/workout-sessions', {
    method: 'POST',
    body,
  });
  return { session: result?.data ? mapSessionDto(result.data) : null };
}

/**
 * PATCH /exercise-logs/:exerciseLogId — sync one completed set into the
 * placeholder row the server pre-created for the session. Body matches the
 * strict exerciseLogPatchSchema.
 */
export async function updateExerciseLog(
  exerciseLogId: string,
  set: { reps: number; weightKg: number; setType: SetType },
): Promise<void> {
  await request(`/exercise-logs/${encodeURIComponent(exerciseLogId)}`, {
    method: 'PATCH',
    body: {
      reps: Math.max(0, Math.round(set.reps)),
      weightKg: Math.max(0, set.weightKg),
      completed: true,
      setType: SET_TYPE_TO_API[set.setType] ?? 'working',
    },
  });
}

/**
 * API body for the pain-alert route (strict recordPainAlertSchema). Shared
 * between the live call and the offline queue replay so both stay in sync.
 */
export function buildPainAlertApiBody(
  sessionId: string | null | undefined,
  payload: PainAlertPayload,
): Record<string, unknown> {
  return {
    ...(sessionId && sessionId !== 'local' ? { sessionId } : {}),
    painScore: Math.max(0, Math.min(10, Math.round(payload.painLevel))),
    jointRegion: payload.bodyPart,
    ...(payload.exerciseName ? { exerciseName: payload.exerciseName } : {}),
  };
}

/**
 * POST /workout-sessions/pain-alert — report joint pain, get instant advice.
 * The production route returns {success, alertTriggered, alert, message};
 * mapped to the mobile {advice, deloadRecommended} contract.
 */
export async function sendPainAlert(
  sessionId: string,
  payload: PainAlertPayload,
): Promise<PainAlertResponse> {
  const result = await request<{
    success?: boolean;
    alertTriggered?: boolean;
    message?: string;
    alert?: { recommendations?: string[] | string } | null;
  }>('/workout-sessions/pain-alert', {
    method: 'POST',
    body: buildPainAlertApiBody(sessionId, payload),
  });
  const alertAdvice = Array.isArray(result?.alert?.recommendations)
    ? result.alert!.recommendations!.join(' ')
    : typeof result?.alert?.recommendations === 'string'
      ? result.alert!.recommendations
      : '';
  return {
    advice: [result?.message, alertAdvice].filter(Boolean).join(' ') || 'Pain report recorded.',
    deloadRecommended: Boolean(result?.alertTriggered),
  };
}

/**
 * POST /workout-sessions/:id/complete — mark the session completed. The
 * production body is a strict {painScore?, jointRegion?, notes?, sessionRpe?,
 * durationSeconds?} — totals/logs live in the exercise_logs table, not here.
 * Failures never throw: `networkError` distinguishes transport failures
 * (status 0 — the caller queues the action for offline sync) from
 * server-side rejections, so the celebration flow can always complete.
 */
export async function completeSession(
  sessionId: string,
  summary?: { durationSeconds?: number },
): Promise<{ success: boolean; networkError?: boolean; summary?: undefined }> {
  if (sessionId === 'local') {
    // Nothing to complete server-side; the offline queue handles durability.
    return { success: false, networkError: true };
  }
  const body: Record<string, unknown> = {};
  if (typeof summary?.durationSeconds === 'number' && summary.durationSeconds > 0) {
    body.durationSeconds = Math.round(summary.durationSeconds);
  }
  try {
    await request(`/workout-sessions/${encodeURIComponent(sessionId)}/complete`, {
      method: 'POST',
      body,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      networkError: error instanceof ApiError && error.status === 0,
    };
  }
}
