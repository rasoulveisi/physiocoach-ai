/**
 * PhysioCoach AI — Resilient offline sync queue (AsyncStorage-backed).
 *
 * Workout data is too valuable to lose in a gym with dead zones. Any write the
 * API cannot accept is persisted to '@physiocoach/offline_queue' and replayed
 * FIFO when connectivity returns (NetInfo reconnect or app focus).
 *
 * Replay semantics:
 *  - Network failure (ApiError.status === 0) pauses the drain; the item and
 *    everything after it stay queued for the next pass.
 *  - Workout-critical actions (LOG_SET / COMPLETE_SESSION / PAIN_ALERT) are
 *    never dropped: they retry on every drain until the backend accepts them.
 *  - Feedback actions (RATE_PLAN / CLONE_PLAN) retry up to MAX_ATTEMPTS and
 *    are then counted as `errors` so one poisoned item cannot wedge the queue.
 *  - LOG_SET captured without a real remote session (offline start) is
 *    repaired on replay: a real session is created server-side (using the
 *    athlete's current plan when available) and the queued payloads are
 *    rewritten to reference it, satisfying the exercise_logs foreign key.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { request, ApiError } from '../api/client';
import { buildPainAlertApiBody } from '../api/sessions';

export const OFFLINE_QUEUE_STORAGE_KEY = '@physiocoach/offline_queue';

/** Placeholder session id used while a session runs fully offline. */
export const OFFLINE_SESSION_ID = 'local';

/** Actions the engine can persist offline and replay later. */
export type QueueActionType =
  | 'LOG_SET'
  | 'COMPLETE_SESSION'
  | 'PAIN_ALERT'
  | 'RATE_PLAN'
  | 'CLONE_PLAN';

/** Internal (non-transport) marker: a real session backing offline captures. */
export type InternalActionType = 'SESSION_REPAIR';

export type AnyQueueActionType = QueueActionType | InternalActionType;

/** One durable, replayable offline action. */
export interface QueueItem {
  id: string;
  type: AnyQueueActionType;
  /** API path (relative to BASE_URL). Empty for internal markers. */
  endpoint: string;
  method: 'POST' | 'PATCH';
  payload: unknown;
  /** ISO timestamp of when the action was captured. */
  createdAt: string;
  /** Replays attempted so far (bounded for droppable types). */
  retryCount: number;
  /** Last failure message, for the Settings diagnostics view. */
  lastError?: string;
}

const MAX_ATTEMPTS = 5;

/** Workout-critical actions are never discarded. */
function isNeverDrop(type: AnyQueueActionType): boolean {
  return type === 'LOG_SET' || type === 'COMPLETE_SESSION' || type === 'PAIN_ALERT';
}

function makeItemId(): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoRef?.randomUUID === 'function') return cryptoRef.randomUUID();
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Storage (JSON array in AsyncStorage)
// ---------------------------------------------------------------------------

/** Read the full queue from storage. Corrupt blobs resolve to []. */
export async function getQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is QueueItem =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as QueueItem).id === 'string' &&
        typeof (item as QueueItem).type === 'string' &&
        typeof (item as QueueItem).endpoint === 'string' &&
        typeof (item as QueueItem).method === 'string' &&
        typeof (item as QueueItem).createdAt === 'string',
    );
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

/** Wipe the queue (used by "Clear Local Cache"). */
export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_STORAGE_KEY);
  } catch {
    // Best-effort.
  }
}

// ---------------------------------------------------------------------------
// Payload normalization (server contract: strict zod on /exercise-logs)
// ---------------------------------------------------------------------------

const MOVEMENT_PATTERNS = [
  'squat',
  'hinge',
  'push',
  'pull',
  'lunge',
  'carry',
  'core',
  'mobility',
] as const;
type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

/** Server-side setType enum for /exercise-logs. */
function toApiSetType(setType: unknown): string {
  const value = typeof setType === 'string' ? setType.toLowerCase() : 'working';
  if (value === 'warmup' || value === 'drop' || value === 'failure') return value;
  return 'working'; // NORMAL and anything unrecognized.
}

/** Best-effort movement-pattern inference from a muscle-group label. */
function inferMovementPattern(muscleGroup: unknown): MovementPattern {
  const label = typeof muscleGroup === 'string' ? muscleGroup.toLowerCase() : '';
  if (/(chest|pec|shoulder|delt|triceps|press)/.test(label)) return 'push';
  if (/(back|lat|bicep|row|pull)/.test(label)) return 'pull';
  if (/(quad|glute|hamstring|leg|calf|squat|lunge)/.test(label)) return 'squat';
  if (/(hinge|deadlift|hip)/.test(label)) return 'hinge';
  if (/(core|ab|oblique|plank)/.test(label)) return 'core';
  if (/(mobility|stretch|warm)/.test(label)) return 'mobility';
  return 'core';
}

/**
 * Map a captured LOG_SET payload to the server contract.
 *
 *  - With a `exerciseLogId` (a server pre-created placeholder row from a real
 *    session): PATCH body for /exercise-logs/:id — updates the prescribed row
 *    and preserves its previous-performance AI pipeline.
 *  - Without one (freestyle / extra set / offline start): POST body for the
 *    strict exerciseLogInputSchema; the session id may be the offline
 *    placeholder and is rewritten to a real session during replay.
 */
function normalizeLogSetPayload(raw: unknown): { body: Record<string, unknown>; patchLogId: string | null } {
  const input = (raw ?? {}) as Record<string, unknown>;
  const reps = Number.isFinite(input.reps as number) ? Math.max(0, input.reps as number) : 0;
  const weightKg = Number.isFinite(input.weightKg as number) ? Math.max(0, input.weightKg as number) : 0;
  const apiSetType = toApiSetType(input.setType);
  const patchLogId =
    typeof input.exerciseLogId === 'string' && input.exerciseLogId.trim()
      ? input.exerciseLogId.trim()
      : null;

  if (patchLogId) {
    return {
      body: { reps: Math.round(reps), weightKg, completed: true, setType: apiSetType },
      patchLogId,
    };
  }

  const exerciseName =
    typeof input.exerciseName === 'string' && input.exerciseName.trim()
      ? input.exerciseName.trim()
      : 'Logged Exercise';
  const setNumber = Number.isFinite(input.setNumber as number) ? (input.setNumber as number) : 1;

  return {
    patchLogId: null,
    body: {
      workoutSessionId:
        typeof input.workoutSessionId === 'string' && input.workoutSessionId.trim()
          ? input.workoutSessionId
          : OFFLINE_SESSION_ID,
      exerciseName,
      movementPattern:
        typeof input.movementPattern === 'string' &&
        (MOVEMENT_PATTERNS as readonly string[]).includes(input.movementPattern)
          ? input.movementPattern
          : inferMovementPattern(input.muscleGroup),
      muscleGroups:
        typeof input.muscleGroup === 'string' && input.muscleGroup.trim()
          ? [input.muscleGroup.trim()]
          : ['general'],
      setIndex: Math.max(1, Math.round(setNumber)),
      reps: Math.round(reps),
      weightKg,
      completed: true,
      setType: apiSetType,
    },
  };
}

/**
 * Persist an action for later replay. Returns the created item so callers can
 * show accurate "pending" counts without re-reading storage.
 */
export async function enqueueAction(
  type: QueueActionType,
  payload: unknown,
  endpoint?: string,
  method: QueueItem['method'] = 'POST',
): Promise<QueueItem> {
  let itemEndpoint = endpoint;
  let itemMethod: QueueItem['method'] = method;
  let itemPayload: unknown = payload;

  switch (type) {
    case 'LOG_SET': {
      // PATCH the server pre-created placeholder row when known; else POST.
      const normalized = normalizeLogSetPayload(payload);
      if (normalized.patchLogId) {
        itemEndpoint = `/exercise-logs/${encodeURIComponent(normalized.patchLogId)}`;
        itemMethod = 'PATCH';
        itemPayload = normalized.body;
      } else {
        itemEndpoint = '/exercise-logs';
        itemMethod = 'POST';
        itemPayload = normalized.body;
      }
      break;
    }
    case 'PAIN_ALERT':
      itemEndpoint = '/workout-sessions/pain-alert';
      itemMethod = 'POST';
      itemPayload = buildPainAlertApiBody(
        (payload as { sessionId?: string } | null)?.sessionId ?? null,
        payload as { bodyPart: string; painLevel: number; exerciseName?: string },
      );
      break;
    case 'COMPLETE_SESSION':
      itemEndpoint = endpoint ?? endpointForType(type, payload);
      itemMethod = 'POST';
      itemPayload = normalizeCompletePayload(payload);
      break;
    case 'RATE_PLAN':
      itemEndpoint = endpoint ?? endpointForType(type, payload);
      itemMethod = 'POST';
      itemPayload = normalizeRatePayload(payload);
      break;
    case 'CLONE_PLAN':
      itemEndpoint = endpoint ?? endpointForType(type, payload);
      itemMethod = 'POST';
      itemPayload = { planId: (payload as { planId?: string } | null)?.planId };
      break;
  }

  const item: QueueItem = {
    id: makeItemId(),
    type,
    endpoint: itemEndpoint ?? '/exercise-logs',
    method: itemMethod,
    payload: itemPayload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  const queue = await getQueue();
  queue.push(item);
  await saveQueue(queue);
  return item;
}

/**
 * Map a captured COMPLETE_SESSION payload to the strict workoutSessionComplete
 * body ({painScore?, jointRegion?, notes?, sessionRpe?, durationSeconds?}).
 */
function normalizeCompletePayload(raw: unknown): Record<string, unknown> {
  const input = (raw ?? {}) as { durationSeconds?: unknown };
  const body: Record<string, unknown> = {};
  if (
    typeof input.durationSeconds === 'number' &&
    Number.isFinite(input.durationSeconds) &&
    input.durationSeconds > 0
  ) {
    body.durationSeconds = Math.round(input.durationSeconds);
  }
  return body;
}

/** Map a captured RATE_PLAN payload to the strict ratePlanSchema body. */
function normalizeRatePayload(raw: unknown): Record<string, unknown> {
  const input = (raw ?? {}) as { rating?: unknown; review?: unknown };
  const rating = Math.max(1, Math.min(5, Math.round(Number(input.rating) || 0)));
  const body: Record<string, unknown> = { rating: rating || 1 };
  if (typeof input.review === 'string' && input.review.trim()) {
    body.review = input.review.trim().slice(0, 1000);
  }
  return body;
}

/** Default endpoint per action type; callers may override per call. */
function endpointForType(type: QueueActionType, payload: unknown): string {
  const payloadRef = (payload ?? {}) as { sessionId?: string; planId?: string };
  switch (type) {
    case 'LOG_SET':
      return '/exercise-logs';
    case 'COMPLETE_SESSION':
      return `/workout-sessions/${encodeURIComponent(payloadRef.sessionId ?? OFFLINE_SESSION_ID)}/complete`;
    case 'PAIN_ALERT':
      return '/workout-sessions/pain-alert';
    case 'RATE_PLAN':
      return `/workout-plans/${encodeURIComponent(payloadRef.planId ?? '')}/rate`;
    case 'CLONE_PLAN':
      return `/workout-plans/${encodeURIComponent(payloadRef.planId ?? '')}/clone`;
    default:
      return '/exercise-logs';
  }
}

// ---------------------------------------------------------------------------
// Offline session repair
// ---------------------------------------------------------------------------

/** True when a payload references the offline placeholder session. */
function referencesOfflineSession(payload: unknown): boolean {
  const sessionRef = (payload ?? {}) as { workoutSessionId?: unknown; sessionId?: unknown };
  const id = sessionRef.workoutSessionId ?? sessionRef.sessionId;
  return typeof id !== 'string' || id.trim() === '' || id === OFFLINE_SESSION_ID;
}

/**
 * Create a real workout session server-side so offline-captured exercise logs
 * can satisfy the workout_sessions foreign key. Uses the athlete's current
 * plan when one exists; pauses the drain (ApiError status 0) when it cannot.
 */
async function createRepairSession(): Promise<string> {
  let plan: { id?: string; currentDayIndex?: number | null } | null = null;
  try {
    plan = await request<{ plan?: { id?: string; currentDayIndex?: number | null } | null }>(
      '/workout-plans/current',
      { method: 'GET', timeoutMs: 15_000 },
    ).then((result) => result?.plan ?? null);
  } catch (error) {
    // No plan reachable — treat like a network pause; logs stay queued.
    throw new ApiError(0, `Cannot resolve current plan for offline session: ${String(error)}`);
  }
  if (!plan?.id) {
    throw new ApiError(0, 'No active workout plan; offline session creation deferred.');
  }

  const body = {
    workoutPlanId: plan.id,
    dayIndex: Math.max(0, (plan.currentDayIndex ?? 1) - 1),
    scheduledDate: new Date().toISOString().slice(0, 10),
  };
  const result = await request<{
    session?: { id?: string };
    data?: { session?: { id?: string } | null } | null;
  }>('/workout-sessions', { method: 'POST', body, timeoutMs: 15_000 });
  const sessionId = result?.session?.id ?? result?.data?.session?.id;
  if (typeof sessionId === 'string' && sessionId) return sessionId;
  throw new ApiError(0, 'Session create returned no id; offline session deferred.');
}

/** Point a queued action's payload/endpoint at a real session id. */
function rewriteItemForSession(item: QueueItem, sessionId: string): QueueItem {
  const payload = { ...((item.payload as Record<string, unknown>) ?? {}) };
  if (item.type === 'LOG_SET') {
    payload.workoutSessionId = sessionId;
    return { ...item, payload };
  }
  if (item.type === 'COMPLETE_SESSION') {
    payload.sessionId = sessionId;
    return {
      ...item,
      payload,
      endpoint: `/workout-sessions/${encodeURIComponent(sessionId)}/complete`,
    };
  }
  return item;
}

// ---------------------------------------------------------------------------
// Replay engine (single-flight)
// ---------------------------------------------------------------------------

let syncInFlight: Promise<ProcessResult> | null = null;

export interface ProcessResult {
  syncedCount: number;
  errors: number;
  /** Items still queued after this run. */
  remaining: number;
}

/** True for transport-level failures (offline / timeout) — keep + retry. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

/**
 * Drain the queue FIFO. Single-flight: concurrent callers share one run.
 *
 * Network failure → pause and keep everything from the failed item on.
 * Workout-critical items retry forever; feedback items are dropped after
 * MAX_ATTEMPTS. LOG_SET items referencing the offline placeholder session get
 * a real session created (repair marker) and are rewritten before replay.
 */
export async function processQueue(): Promise<ProcessResult> {
  if (syncInFlight) return syncInFlight;

  const run = (async (): Promise<ProcessResult> => {
    const queue = await getQueue();
    if (queue.length === 0) return { syncedCount: 0, errors: 0, remaining: 0 };

    let syncedCount = 0;
    let errors = 0;
    const remaining: QueueItem[] = [];
    // In-flight repair marker: the real session backing offline captures.
    let repairMarker: { sessionKey: string; sessionId: string } | null = null;

    for (let index = 0; index < queue.length; index += 1) {
      let item = queue[index];

      // Persisted repair marker from a previous paused drain — restore it.
      if (item.type === 'SESSION_REPAIR') {
        const payloadRef = (item.payload ?? {}) as { sessionKey?: string; sessionId?: string };
        if (payloadRef.sessionKey && payloadRef.sessionId && !repairMarker) {
          repairMarker = { sessionKey: payloadRef.sessionKey, sessionId: payloadRef.sessionId };
        }
        continue; // Internal bookkeeping item — never hits the transport.
      }

      try {
        // Ensure a real session exists for actions captured fully offline.
        // COMPLETE_SESSION repair is detected via its endpoint (computed from
        // the raw capture): the normalized strict body omits the session id.
        const needsRepair =
          (item.type === 'LOG_SET' && referencesOfflineSession(item.payload)) ||
          (item.type === 'COMPLETE_SESSION' &&
            item.endpoint.includes(`/${OFFLINE_SESSION_ID}/complete`));
        if (needsRepair) {
          const sessionKey = OFFLINE_SESSION_ID;
          if (repairMarker && repairMarker.sessionKey === sessionKey) {
            item = rewriteItemForSession(item, repairMarker.sessionId);
          } else {
            const sessionId = await createRepairSession();
            repairMarker = { sessionKey, sessionId };
            item = rewriteItemForSession(item, sessionId);
          }
        }

        await request(item.endpoint, {
          method: item.method,
          body: item.payload,
          timeoutMs: 15_000,
        });
        syncedCount += 1;

        // Completing a session closes its repair window; later offline
        // captures (a newer session) must get a fresh repair session.
        if (item.type === 'COMPLETE_SESSION') {
          repairMarker = null;
        }
      } catch (error) {
        if (isNetworkError(error)) {
          // Connectivity lost (or repair deferred) mid-drain: stop, keep this
          // item + the rest for the next pass.
          remaining.push(item, ...queue.slice(index + 1));
          break;
        }
        const retryCount = item.retryCount + 1;
        if (!isNeverDrop(item.type) && retryCount >= MAX_ATTEMPTS) {
          errors += 1; // Poisoned feedback item — drop it, count the failure.
        } else {
          remaining.push({
            ...item,
            retryCount,
            lastError: error instanceof Error ? error.message : 'Sync failed',
          });
        }
      }
    }

    // Persist an active repair marker so the next drain reuses the same
    // session instead of creating duplicates across pauses.
    if (repairMarker) {
      remaining.unshift({
        id: makeItemId(),
        type: 'SESSION_REPAIR',
        endpoint: '',
        method: 'POST',
        payload: repairMarker,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });
    }

    await saveQueue(remaining);
    return { syncedCount, errors, remaining: remaining.length };
  })();

  syncInFlight = run.finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

/** Queue length without loading full item objects into React state. */
export async function getQueueCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

export const offlineSync = {
  enqueueAction,
  processQueue,
  getQueue,
  clearQueue,
  getQueueCount,
  isNetworkError,
};
