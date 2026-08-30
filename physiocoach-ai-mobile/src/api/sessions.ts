/**
 * PhysioCoach AI — Workout Sessions API methods.
 * Typed wrappers over the HTTP client for the /workout-sessions surface:
 * history, session lifecycle and the joint-pain alert / deload flow.
 */

import { request } from './client';

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

/** Which kind of set was performed. */
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

/** Body sent with completeSession — the celebrated summary. */
export interface SessionSummary {
  sessionId?: string;
  totalSets?: number;
  totalReps?: number;
  totalVolumeKg?: number;
  durationSeconds?: number;
  /** Exercises completed end-to-end. */
  completedExercises?: number;
  /** Personal records achieved during the session. */
  personalRecords?: number;
  /** AI-graded session quality (0-100). */
  performanceScore?: number;
  [key: string]: unknown;
}

/** Body for POST /workout-sessions/:id/pain-alert. */
export interface PainAlertPayload {
  bodyPart: string;
  /** 0 (none) - 10 (unbearable). */
  painLevel: number;
  exerciseName?: string;
}

/** Server response to a pain alert: instant AI advice + deload flag. */
export interface PainAlertResponse {
  advice: string;
  deloadRecommended: boolean;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** GET /workout-sessions/recent — history for the dashboard feed. */
export async function getRecentSessions(): Promise<{ sessions: WorkoutSession[] }> {
  return request<{ sessions: WorkoutSession[] }>('/workout-sessions/recent');
}

/** POST /workout-sessions — open a new live session. */
export async function createSession(payload: any): Promise<{ session: WorkoutSession }> {
  return request<{ session: WorkoutSession }>('/workout-sessions', {
    method: 'POST',
    body: payload,
  });
}

/**
 * POST /workout-sessions/:id/complete — finish the session with an optional
 * summary. Network failures degrade gracefully so the local celebration flow
 * can still complete.
 */
export async function completeSession(
  sessionId: string,
  summary?: any,
): Promise<{ success: boolean; summary?: any }> {
  try {
    return await request<{ success: boolean; summary?: any }>(
      `/workout-sessions/${encodeURIComponent(sessionId)}/complete`,
      { method: 'POST', body: summary ?? {} },
    );
  } catch {
    return { success: false, summary };
  }
}

/** POST /workout-sessions/:id/pain-alert — report joint pain, get AI advice. */
export async function sendPainAlert(
  sessionId: string,
  payload: PainAlertPayload,
): Promise<PainAlertResponse> {
  return request<PainAlertResponse>(
    `/workout-sessions/${encodeURIComponent(sessionId)}/pain-alert`,
    { method: 'POST', body: payload },
  );
}
