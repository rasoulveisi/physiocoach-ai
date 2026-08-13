import { and, desc, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm';
import type { Context } from 'hono';
import { Hono } from 'hono';

import { exerciseLogs, personalRecords, workoutSessions } from '../db/schema';
import type { WorkerBindings } from '../env';
import { handleRouteError } from '../shared/errors/api';
import { getApiRouteContext } from './context';
import { getFallbackProgressSummary, getProgressSummary } from '../services/progress-calculator';
import { parseMuscleGroups } from '../services/workout-session';

type DbClient = ReturnType<typeof import('../db/client').createDb>;

type CompletedSessionRow = typeof workoutSessions.$inferSelect;

type ExerciseLogRow = Omit<typeof exerciseLogs.$inferSelect, 'muscleGroupsJson'> & {
  masterExerciseId: string | null;
  sessionCompletedAt: string | null;
  sessionScheduledDate: string;
};

export function createProgressRoutes() {
  const route = new Hono<{ Bindings: WorkerBindings }>();

  route.get('/progress/summary', async (c) => {
    try {
      return await getProgressSummaryHandler(c);
    } catch (error) {
      return handleRouteError(c, error, 'Failed to fetch progress summary.');
    }
  });

  route.get('/progress/prs', async (c) => {
    try {
      return await getPersonalRecordsHandler(c);
    } catch (error) {
      return handleRouteError(c, error, 'Failed to fetch personal records.');
    }
  });

  route.get('/progress/muscle-volume', async (c) => {
    try {
      return await getMuscleVolumeHandler(c);
    } catch (error) {
      return handleRouteError(c, error, 'Failed to fetch muscle volume.');
    }
  });

  return route;
}

async function getProgressSummaryHandler(c: Context<{ Bindings: WorkerBindings }>) {
  const { user, db } = getApiRouteContext(c);
  if (!db) {
    return c.json({ data: getFallbackProgressSummary() });
  }

  const summary = await getProgressSummary(
    {
      findCompletedSessionsForUser: (userId) => findCompletedSessionsForUser(db, userId),
      findCompletedSessionsForUserInRange: (userId, from, to) =>
        findCompletedSessionsForUserInRange(db, userId, from, to),
      findExerciseLogsForSessionIds: (sessionIds) => findExerciseLogsForSessionIds(db, sessionIds),
    },
    user.id,
  );

  return c.json({ data: summary });
}

async function findCompletedSessionsForUser(
  db: DbClient,
  userId: string,
): Promise<CompletedSessionRow[]> {
  return db
    .select()
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, userId),
        isNotNull(workoutSessions.completedAt),
        eq(workoutSessions.status, 'completed'),
      ),
    )
    .orderBy(desc(workoutSessions.completedAt));
}

async function findCompletedSessionsForUserInRange(
  db: DbClient,
  userId: string,
  fromInclusive: string,
  toInclusive: string,
): Promise<CompletedSessionRow[]> {
  return db
    .select()
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, userId),
        eq(workoutSessions.status, 'completed'),
        isNotNull(workoutSessions.completedAt),
        gte(workoutSessions.completedAt, fromInclusive),
        lte(workoutSessions.completedAt, toInclusive),
      ),
    )
    .orderBy(desc(workoutSessions.completedAt));
}

async function findExerciseLogsForSessionIds(
  db: DbClient,
  sessionIds: string[],
): Promise<ExerciseLogRow[]> {
  if (sessionIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: exerciseLogs.id,
      userId: exerciseLogs.userId,
      workoutSessionId: exerciseLogs.workoutSessionId,
      exerciseName: exerciseLogs.exerciseName,
      masterExerciseId: exerciseLogs.masterExerciseId,
      movementPattern: exerciseLogs.movementPattern,
      setIndex: exerciseLogs.setIndex,
      targetReps: exerciseLogs.targetReps,
      reps: exerciseLogs.reps,
      weight: exerciseLogs.weight,
      rpe: exerciseLogs.rpe,
      completed: exerciseLogs.completed,
      notes: exerciseLogs.notes,
      exerciseType: exerciseLogs.exerciseType,
      previousPerformanceJson: exerciseLogs.previousPerformanceJson,
      sessionCompletedAt: workoutSessions.completedAt,
      sessionScheduledDate: workoutSessions.scheduledDate,
    })
    .from(exerciseLogs)
    .innerJoin(workoutSessions, eq(exerciseLogs.workoutSessionId, workoutSessions.id))
    .where(inArray(exerciseLogs.workoutSessionId, sessionIds))
    .orderBy(desc(workoutSessions.completedAt), exerciseLogs.exerciseName, exerciseLogs.setIndex);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type PersonalRecordRow = typeof personalRecords.$inferSelect;

interface PersonalRecordGroup {
  exerciseName: string;
  masterExerciseId: string | null;
  records: Array<{
    recordType: string;
    value: number;
    reps: number | null;
    weightKg: number | null;
    achievedAt: string;
  }>;
}

async function getPersonalRecordsHandler(c: Context<{ Bindings: WorkerBindings }>) {
  const { user, db } = getApiRouteContext(c);
  if (!db) {
    return c.json({ data: [] });
  }

  const rows = await db
    .select()
    .from(personalRecords)
    .where(eq(personalRecords.userId, user.id))
    .orderBy(desc(personalRecords.achievedAt));

  return c.json({ data: groupPersonalRecordsByExercise(rows) });
}

function groupPersonalRecordsByExercise(rows: PersonalRecordRow[]): PersonalRecordGroup[] {
  const grouped = new Map<string, PersonalRecordGroup>();

  for (const row of rows) {
    const key = (row.masterExerciseId ?? row.exerciseName).trim().toLowerCase();
    const record = {
      recordType: row.recordType,
      value: row.value,
      reps: row.reps,
      weightKg: row.weightKg,
      achievedAt: row.achievedAt,
    };

    const existing = grouped.get(key);
    if (existing) {
      existing.records.push(record);
    } else {
      grouped.set(key, {
        exerciseName: row.exerciseName,
        masterExerciseId: row.masterExerciseId,
        records: [record],
      });
    }
  }

  return Array.from(grouped.values());
}

async function getMuscleVolumeHandler(c: Context<{ Bindings: WorkerBindings }>) {
  const { user, db } = getApiRouteContext(c);
  if (!db) {
    return c.json({ data: [] });
  }

  const fromIso = new Date(Date.now() - 30 * MS_PER_DAY).toISOString();
  const rows = await findCompletedLogsWithSessionDates(db, user.id);

  const volumeByMuscle = new Map<string, number>();
  for (const row of rows) {
    if (row.completed !== 1 || row.weight <= 0 || row.reps <= 0) continue;

    const sessionDate =
      toComparableIso(row.sessionCompletedAt) ?? toComparableIso(row.sessionScheduledDate);
    if (!sessionDate || sessionDate < fromIso) continue;

    const volume = row.weight * row.reps;
    for (const group of parseMuscleGroups(row.muscleGroupsJson)) {
      volumeByMuscle.set(group, (volumeByMuscle.get(group) ?? 0) + volume);
    }
  }

  const data = Array.from(volumeByMuscle.entries())
    .map(([muscleGroup, volume]) => ({ muscleGroup, volume }))
    .sort((a, b) => b.volume - a.volume);

  return c.json({ data });
}

async function findCompletedLogsWithSessionDates(db: DbClient, userId: string) {
  return db
    .select({
      muscleGroupsJson: exerciseLogs.muscleGroupsJson,
      weight: exerciseLogs.weight,
      reps: exerciseLogs.reps,
      completed: exerciseLogs.completed,
      sessionCompletedAt: workoutSessions.completedAt,
      sessionScheduledDate: workoutSessions.scheduledDate,
    })
    .from(exerciseLogs)
    .innerJoin(workoutSessions, eq(exerciseLogs.workoutSessionId, workoutSessions.id))
    .where(and(eq(exerciseLogs.userId, userId), eq(exerciseLogs.completed, 1)));
}

function toComparableIso(value: string | null): string | null {
  if (!value) return null;
  return value.length >= 20 ? value : `${value}T00:00:00.000Z`;
}
