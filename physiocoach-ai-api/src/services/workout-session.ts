import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';
import { createDb } from '../db/client';
import {
  exerciseLogs,
  exerciseMuscles,
  masterExercises,
  masterMuscles,
  personalRecords,
  workoutPlans,
  workoutSessions,
} from '../db/schema';
import { MovementPatternSchema, type WorkoutDay } from '../types/workout';

export type DbClient = ReturnType<typeof createDb>;

type SessionRow = typeof workoutSessions.$inferSelect;
type SessionInsert = typeof workoutSessions.$inferInsert;
type ExerciseLogRow = typeof exerciseLogs.$inferSelect;
type ExerciseLogInsert = typeof exerciseLogs.$inferInsert;
type PlanRow = typeof workoutPlans.$inferSelect;

type ClientWithTransaction = {
  transaction: (callback: (client: unknown) => Promise<void>) => Promise<void>;
};

export interface DefaultLogInput {
  userId: string;
  workoutSessionId: string;
  day: WorkoutDay;
  previousPerformanceByExercise?: Map<string, PreviousPerformance>;
}

export interface ExerciseLogRecord {
  userId: string;
  workoutSessionId: string;
  exerciseName: string;
  masterExerciseId: string;
  movementPattern: string;
  muscleGroupsJson: string;
  setIndex: number;
  targetReps: string | null;
  reps: number;
  weight: number;
  rpe: number | null;
  completed: number;
  notes: string | null;
  previousPerformanceJson: string | null;
}

export interface ExerciseLogPatchUpdate {
  reps: number;
  weight: number;
  rpe: number;
  completed: boolean;
  notes: string;
}

export const SET_TYPE_VALUES = ['warmup', 'working', 'drop', 'failure'] as const;
export type ExerciseSetType = (typeof SET_TYPE_VALUES)[number];

export interface PreviousPerformance {
  weight: number;
  reps: number;
  date: string;
}

export const workoutSessionCreateSchema = z
  .object({
    workoutPlanId: z.string().min(1),
    dayIndex: z.number().int().min(0),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export const workoutSessionPatchSchema = z
  .object({
    notes: z.string().min(1).optional(),
  })
  .strict();

export const exerciseLogPatchSchema = z
  .object({
    reps: z.number().int().min(0),
    weightKg: z.number().min(0),
    rpe: z.number().min(1).max(10).optional(),
    completed: z.boolean(),
    notes: z.string().min(1).optional(),
    setType: z.enum(SET_TYPE_VALUES).optional(),
  })
  .strict();

export const swapExerciseSchema = z
  .object({
    logGroupKey: z.string().min(1),
    newMasterExerciseId: z.string().min(1),
    newExerciseName: z.string().min(1),
    newMovementPattern: MovementPatternSchema,
    newMuscleGroups: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type SwapExerciseInput = z.infer<typeof swapExerciseSchema>;

export const exerciseLogInputSchema = z
  .object({
    workoutSessionId: z.string().min(1),
    exerciseName: z.string().min(1),
    masterExerciseId: z.string().min(1),
    movementPattern: MovementPatternSchema,
    muscleGroups: z.array(z.string().min(1)).min(1),
    setIndex: z.number().int().min(1),
    targetReps: z.string().min(1).optional(),
    reps: z.number().int().min(0),
    weightKg: z.number().min(0),
    rpe: z.number().min(1).max(10).optional(),
    completed: z.boolean().default(false),
    notes: z.string().min(1).optional(),
    setType: z.enum(SET_TYPE_VALUES).optional(),
  })
  .strict();

export type WorkoutSessionCreateInput = z.infer<typeof workoutSessionCreateSchema>;
export type WorkoutSessionPatchInput = z.infer<typeof workoutSessionPatchSchema>;
export type ExerciseLogPatchInput = z.infer<typeof exerciseLogPatchSchema>;

const DefaultLogSchema = z.object({
  userId: z.string().min(1),
  workoutSessionId: z.string().min(1),
  exerciseName: z.string().min(1),
  masterExerciseId: z.string().min(1),
  movementPattern: MovementPatternSchema,
  muscleGroupsJson: z.string().min(2),
  setIndex: z.number().int().min(1),
  targetReps: z.string().nullable(),
  reps: z.number().int().min(0),
  weight: z.number().min(0),
  rpe: z.number().nullable(),
  completed: z.number().int().min(0).max(1),
  notes: z.string().nullable(),
  previousPerformanceJson: z.string().nullable(),
});

const DefaultLogBatchSchema = z.array(DefaultLogSchema).nonempty();

export const MISSING_MASTER_EXERCISE_ID_ERROR_MESSAGE =
  'Unable to start this workout session: this plan is missing catalog IDs. Regenerate your workout plan before starting a session so exercises can be tracked with canonical IDs.';

export const DEFAULT_SESSION_LIST_LIMIT = 10;

export const MAX_SQL_VARIABLES = 100;
export const LOG_COLUMNS_PER_ROW = 13;
export const LOG_BATCH_SIZE = Math.max(1, Math.floor(MAX_SQL_VARIABLES / LOG_COLUMNS_PER_ROW));

export interface WorkoutSessionDto {
  id: string;
  workoutPlanId: string;
  dayIndex: number;
  status: string;
  scheduledDate: string;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  progress: {
    completedSets: number;
    totalSets: number;
  };
  logs: Array<{
    id: string;
    exerciseName: string;
    movementPattern: string;
    muscleGroups: string[];
    setIndex: number;
    targetReps?: string | null;
    reps: number;
    weightKg: number;
    rpe?: number | null;
    completed: boolean;
    masterExerciseId?: string | null;
    notes: string | null;
    setType?: string | null;
    previousPerformance?: PreviousPerformance | null;
  }>;
}

export interface SessionError {
  code: 'invalid_session_data';
  message: string;
}

export type SessionBuildResult =
  | { ok: true; dto: WorkoutSessionDto }
  | { ok: false; error: SessionError };

export type SessionId = string;

export interface CanonicalExerciseForLog {
  masterExerciseId: string;
  exerciseName: string;
  movementPattern: string;
  muscleGroups: string[];
}

export function buildSessionDto(
  session: SessionRow,
  logs: ExerciseLogRow[],
  previousPerformanceByExercise?: Map<string, PreviousPerformance>,
): SessionBuildResult {
  try {
    const mappedLogs = logs.map((log) => {
      const storedPrevious = parsePreviousPerformance(log.previousPerformanceJson);
      const previousPerformance =
        storedPrevious ?? previousPerformanceByExercise?.get(log.masterExerciseId ?? '') ?? null;

      return {
        id: log.id,
        exerciseName: log.exerciseName,
        masterExerciseId: log.masterExerciseId,
        movementPattern: log.movementPattern,
        muscleGroups: parseMuscleGroups(log.muscleGroupsJson),
        setIndex: log.setIndex,
        targetReps: log.targetReps,
        reps: log.reps,
        weightKg: log.weight,
        rpe: log.rpe,
        setType: log.exerciseType,
        completed: log.completed === 1,
        notes: log.notes,
        previousPerformance,
      };
    });

    return {
      ok: true,
      dto: {
        id: session.id,
        workoutPlanId: session.workoutPlanId,
        dayIndex: session.dayIndex,
        status: session.status,
        scheduledDate: session.scheduledDate,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        notes: session.notes,
        logs: mappedLogs,
        progress: calculateSessionProgress(logs),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'invalid_session_data',
        message: `Unable to build workout session payload for session ${session.id}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      },
    };
  }
}

export function buildExerciseLogDto(row: ExerciseLogRow) {
  return {
    id: row.id,
    exerciseName: row.exerciseName,
    masterExerciseId: row.masterExerciseId,
    movementPattern: row.movementPattern,
    muscleGroups: parseMuscleGroups(row.muscleGroupsJson),
    setIndex: row.setIndex,
    targetReps: row.targetReps,
    reps: row.reps,
    weightKg: row.weight,
    rpe: row.rpe,
    setType: row.exerciseType,
    completed: row.completed === 1,
    notes: row.notes,
    previousPerformance: parsePreviousPerformance(row.previousPerformanceJson),
  };
}

export function buildDefaultExerciseLogs({
  userId,
  workoutSessionId,
  day,
  previousPerformanceByExercise,
}: DefaultLogInput): ExerciseLogRecord[] {
  return DefaultLogBatchSchema.parse(
    day.exercises.flatMap((exercise) => {
      if (!exercise.masterExerciseId || exercise.masterExerciseId.trim().length === 0) {
        throw new Error(MISSING_MASTER_EXERCISE_ID_ERROR_MESSAGE);
      }

      const previousPerformance = previousPerformanceByExercise?.get(exercise.masterExerciseId);
      const previousPerformanceJson = previousPerformance
        ? JSON.stringify(previousPerformance)
        : null;

      return Array.from({ length: exercise.sets }, (_, index) => ({
        userId,
        workoutSessionId,
        exerciseName: exercise.name,
        masterExerciseId: exercise.masterExerciseId,
        movementPattern: exercise.movementPattern,
        muscleGroupsJson: JSON.stringify([exercise.muscleGroup]),
        setIndex: index + 1,
        targetReps: exercise.reps,
        reps: 0,
        weight: 0,
        rpe: exercise.rpe ?? null,
        completed: 0,
        notes: null,
        previousPerformanceJson,
      }));
    }),
  );
}

export function calculateSessionProgress(logs: Array<{ completed: number }>): {
  completedSets: number;
  totalSets: number;
} {
  const totalSets = logs.length;
  const completedSets = logs.filter((log) => log.completed === 1).length;

  return {
    completedSets,
    totalSets,
  };
}

export async function findLatestActiveSessionForUser(
  db: DbClient,
  userId: string,
): Promise<SessionRow | undefined> {
  const rows = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.status, 'active')))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(1);

  return rows[0];
}

export async function findRecentSessionsForUser(
  db: DbClient,
  userId: string,
  limit: number,
): Promise<SessionRow[]> {
  return db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.userId, userId))
    .orderBy(desc(workoutSessions.completedAt), desc(workoutSessions.startedAt))
    .limit(limit);
}

export async function findSessionByIdempotencyKey(
  db: DbClient,
  userId: string,
  idempotencyKey: string,
): Promise<SessionRow | undefined> {
  const rows = await db
    .select()
    .from(workoutSessions)
    .where(
      and(eq(workoutSessions.userId, userId), eq(workoutSessions.idempotencyKey, idempotencyKey)),
    )
    .limit(1);

  return rows[0];
}

export async function deleteSessionByIdempotencyKey(
  db: DbClient,
  userId: string,
  idempotencyKey: string,
): Promise<void> {
  const existing = await findSessionByIdempotencyKey(db, userId, idempotencyKey);
  if (!existing) return;

  await withTransactionFallback(
    db,
    async (tx) => {
      const client = tx as DbClient;
      await client.delete(exerciseLogs).where(eq(exerciseLogs.workoutSessionId, existing.id));
      await client
        .delete(workoutSessions)
        .where(and(eq(workoutSessions.id, existing.id), eq(workoutSessions.userId, userId)));
    },
    'workout-session',
  );
}

export async function findSessionForUserById(
  db: DbClient,
  userId: string,
  sessionId: string,
): Promise<SessionRow | undefined> {
  const rows = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)))
    .limit(1);

  return rows[0];
}

export async function findPlanForUserById(
  db: DbClient,
  userId: string,
  planId: string,
): Promise<PlanRow | undefined> {
  const rows = await db
    .select()
    .from(workoutPlans)
    .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, userId)))
    .limit(1);

  return rows[0];
}

export async function findCanonicalExerciseForLog(
  db: DbClient,
  masterExerciseId: string,
): Promise<CanonicalExerciseForLog | undefined> {
  const rows = await db
    .select({
      masterExerciseId: masterExercises.canonicalId,
      exerciseName: masterExercises.name,
      movementPattern: masterExercises.movementPattern,
      muscleName: masterMuscles.name,
      isPrimary: exerciseMuscles.isPrimary,
    })
    .from(masterExercises)
    .leftJoin(exerciseMuscles, eq(exerciseMuscles.exerciseId, masterExercises.id))
    .leftJoin(masterMuscles, eq(masterMuscles.id, exerciseMuscles.muscleId))
    .where(eq(masterExercises.canonicalId, masterExerciseId));

  const first = rows[0];
  if (!first) {
    return undefined;
  }

  const primaryMuscles = rows
    .filter((row) => row.isPrimary === 1)
    .map((row) => row.muscleName)
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
  const allMuscles = rows
    .map((row) => row.muscleName)
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);

  return {
    masterExerciseId: first.masterExerciseId,
    exerciseName: first.exerciseName,
    movementPattern: first.movementPattern,
    muscleGroups: primaryMuscles.length > 0 ? primaryMuscles : allMuscles,
  };
}

export async function findLogsForSessionIds(
  db: DbClient,
  sessionIds: SessionId[],
): Promise<ExerciseLogRow[]> {
  if (sessionIds.length === 0) return [];

  const rows = await db
    .select()
    .from(exerciseLogs)
    .where(inArray(exerciseLogs.workoutSessionId, sessionIds));

  return rows;
}

export async function findLogsForSessionId(
  db: DbClient,
  sessionId: string,
): Promise<ExerciseLogRow[]> {
  return db.select().from(exerciseLogs).where(eq(exerciseLogs.workoutSessionId, sessionId));
}

export async function createSessionWithLogs(
  db: DbClient,
  session: SessionInsert,
  logs: ExerciseLogInsert[],
): Promise<void> {
  if (logs.length === 0) {
    await db.insert(workoutSessions).values(session);
    return;
  }

  await withTransactionFallback(
    db,
    async (tx) => {
      const client = tx as DbClient;
      await client.insert(workoutSessions).values(session);
      await insertExerciseLogsInBatches(client, logs);
    },
    'workout-session',
  );
}

export async function updateSessionNotes(
  db: DbClient,
  userId: string,
  sessionId: string,
  patch: { notes?: string },
): Promise<void> {
  await db
    .update(workoutSessions)
    .set(patch)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)));
}

export async function setSessionCompleted(
  db: DbClient,
  userId: string,
  sessionId: string,
  completedAt: string,
): Promise<void> {
  await db
    .update(workoutSessions)
    .set({
      status: 'completed',
      completedAt,
    })
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)));
}

export async function insertExerciseLog(db: DbClient, log: ExerciseLogInsert): Promise<void> {
  await db.insert(exerciseLogs).values(log);
}

export async function patchExerciseLog(
  db: DbClient,
  exerciseLogId: string,
  patch: {
    reps: number;
    weight: number;
    rpe?: number | null;
    completed: number;
    notes?: string | null;
    exerciseType?: string;
  },
): Promise<void> {
  await db.update(exerciseLogs).set(patch).where(eq(exerciseLogs.id, exerciseLogId));
}

export async function findExerciseLogById(
  db: DbClient,
  exerciseLogId: string,
): Promise<ExerciseLogRow | undefined> {
  const rows = await db
    .select()
    .from(exerciseLogs)
    .where(eq(exerciseLogs.id, exerciseLogId))
    .limit(1);

  return rows[0];
}

export async function deleteExerciseLogById(db: DbClient, exerciseLogId: string): Promise<void> {
  await db.delete(exerciseLogs).where(eq(exerciseLogs.id, exerciseLogId));
}

export function groupBySession(rows: ExerciseLogRow[]): Record<SessionId, ExerciseLogRow[]> {
  const grouped: Record<SessionId, ExerciseLogRow[]> = {};
  for (const row of rows) {
    const rowsForSession = grouped[row.workoutSessionId] ?? [];
    rowsForSession.push(row);
    grouped[row.workoutSessionId] = rowsForSession;
  }
  return grouped;
}

async function insertExerciseLogsInBatches(db: DbClient, logs: ExerciseLogInsert[]): Promise<void> {
  for (let index = 0; index < logs.length; index += LOG_BATCH_SIZE) {
    const batch = logs.slice(index, index + LOG_BATCH_SIZE);
    await db.insert(exerciseLogs).values(batch);
  }
}

export function parseMuscleGroups(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (group): group is string => typeof group === 'string' && group.trim().length > 0,
    );
  } catch {
    return [];
  }
}

export function parsePreviousPerformance(raw: string | null): PreviousPerformance | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const candidate = parsed as Record<string, unknown>;
    const weight = typeof candidate.weight === 'number' ? candidate.weight : null;
    const reps = typeof candidate.reps === 'number' ? candidate.reps : null;
    const date = typeof candidate.date === 'string' ? candidate.date : null;
    if (weight === null || reps === null || date === null) return null;

    return { weight, reps, date };
  } catch {
    return null;
  }
}

export function computeEpleyOneRepMax(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export async function findPreviousPerformanceByExercises(
  db: DbClient,
  userId: string,
  masterExerciseIds: string[],
  excludeSessionId?: string,
): Promise<Map<string, PreviousPerformance>> {
  const result = new Map<string, PreviousPerformance>();
  const uniqueIds = Array.from(new Set(masterExerciseIds.filter((id) => id.trim().length > 0)));
  if (uniqueIds.length === 0) return result;

  const rows = await db
    .select({
      masterExerciseId: exerciseLogs.masterExerciseId,
      weight: exerciseLogs.weight,
      reps: exerciseLogs.reps,
      completedAt: workoutSessions.completedAt,
      scheduledDate: workoutSessions.scheduledDate,
    })
    .from(exerciseLogs)
    .innerJoin(workoutSessions, eq(exerciseLogs.workoutSessionId, workoutSessions.id))
    .where(
      and(
        eq(exerciseLogs.userId, userId),
        eq(exerciseLogs.completed, 1),
        inArray(exerciseLogs.masterExerciseId, uniqueIds),
        ...(excludeSessionId ? [ne(exerciseLogs.workoutSessionId, excludeSessionId)] : []),
      ),
    )
    .orderBy(
      desc(workoutSessions.completedAt),
      desc(workoutSessions.scheduledDate),
      desc(exerciseLogs.setIndex),
    );

  for (const row of rows) {
    if (!row.masterExerciseId || result.has(row.masterExerciseId)) continue;
    if (row.weight <= 0 && row.reps <= 0) continue;

    result.set(row.masterExerciseId, {
      weight: row.weight,
      reps: row.reps,
      date: (row.completedAt ?? row.scheduledDate).slice(0, 10),
    });
  }

  return result;
}

export interface PersonalRecordUpsertInput {
  userId: string;
  masterExerciseId: string | null;
  exerciseName: string;
  weight: number;
  reps: number;
  workoutSessionId: string | null;
  achievedAt: string;
}

export async function upsertPersonalRecords(
  db: DbClient,
  input: PersonalRecordUpsertInput,
): Promise<void> {
  const candidates: Array<{ type: string; value: number }> = [
    { type: 'max_weight', value: input.weight },
    { type: 'max_volume', value: input.weight * input.reps },
    { type: 'epley_1rm', value: computeEpleyOneRepMax(input.weight, input.reps) },
  ];

  for (const candidate of candidates) {
    await upsertPersonalRecord(db, input, candidate.type, candidate.value);
  }
}

async function upsertPersonalRecord(
  db: DbClient,
  input: PersonalRecordUpsertInput,
  recordType: string,
  value: number,
): Promise<void> {
  const base = [
    eq(personalRecords.userId, input.userId),
    eq(personalRecords.recordType, recordType),
  ];
  const key = input.masterExerciseId
    ? [...base, eq(personalRecords.masterExerciseId, input.masterExerciseId)]
    : [
        ...base,
        isNull(personalRecords.masterExerciseId),
        eq(personalRecords.exerciseName, input.exerciseName),
      ];

  const existingRows = await db.select().from(personalRecords).where(and(...key)).limit(1);
  const existing = existingRows[0];

  if (!existing) {
    await db.insert(personalRecords).values({
      id: crypto.randomUUID(),
      userId: input.userId,
      masterExerciseId: input.masterExerciseId,
      exerciseName: input.exerciseName,
      recordType,
      value,
      reps: input.reps,
      weightKg: input.weight,
      workoutSessionId: input.workoutSessionId,
      achievedAt: input.achievedAt,
      createdAt: input.achievedAt,
    });
    return;
  }

  if (value > existing.value) {
    await db
      .update(personalRecords)
      .set({
        value,
        reps: input.reps,
        weightKg: input.weight,
        workoutSessionId: input.workoutSessionId,
        achievedAt: input.achievedAt,
      })
      .where(eq(personalRecords.id, existing.id));
  }
}

export async function swapExerciseInSession(
  db: DbClient,
  sessionId: string,
  input: SwapExerciseInput,
): Promise<number> {
  const logs = await findLogsForSessionId(db, sessionId);
  const key = input.logGroupKey.trim().toLowerCase();

  const matchingIds = logs
    .filter((log) => {
      const masterMatch =
        log.masterExerciseId !== null && log.masterExerciseId.toLowerCase() === key;
      const nameMatch = log.exerciseName.trim().toLowerCase() === key;
      return masterMatch || nameMatch;
    })
    .map((log) => log.id);

  if (matchingIds.length === 0) {
    return 0;
  }

  await db
    .update(exerciseLogs)
    .set({
      masterExerciseId: input.newMasterExerciseId,
      exerciseName: input.newExerciseName,
      movementPattern: input.newMovementPattern,
      muscleGroupsJson: JSON.stringify(input.newMuscleGroups),
    })
    .where(inArray(exerciseLogs.id, matchingIds));

  return matchingIds.length;
}

function withTransactionFallback<T>(
  db: DbClient & ClientWithTransaction,
  operation: (client: T) => Promise<void>,
  contextLabel: string,
): Promise<void> {
  if (typeof (db as { transaction?: unknown }).transaction !== 'function') {
    return operation(db as unknown as T);
  }

  const txClient = db as DbClient & ClientWithTransaction;
  const clientTransaction = txClient.transaction;
  return clientTransaction(async (client) => {
    await operation(client as T);
  }).catch((error: unknown) => {
    if (
      error instanceof Error &&
      (error.message.includes('failed query: begin') || error.message.includes('query: begin'))
    ) {
      console.error(
        `[${contextLabel}] Transaction begin failed, retrying without transaction.`,
        error.message,
      );
      return operation(db as unknown as T);
    }

    throw error;
  });
}
