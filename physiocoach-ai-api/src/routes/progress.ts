import { and, desc, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm';
import type { Context } from 'hono';
import { Hono } from 'hono';

import { exerciseLogs, workoutSessions } from '../db/schema';
import type { WorkerBindings } from '../env';
import { handleRouteError } from '../shared/errors/api';
import { getApiRouteContext } from './context';
import { getFallbackProgressSummary, getProgressSummary } from '../services/progress-calculator';

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
      sessionCompletedAt: workoutSessions.completedAt,
      sessionScheduledDate: workoutSessions.scheduledDate,
    })
    .from(exerciseLogs)
    .innerJoin(workoutSessions, eq(exerciseLogs.workoutSessionId, workoutSessions.id))
    .where(inArray(exerciseLogs.workoutSessionId, sessionIds))
    .orderBy(desc(workoutSessions.completedAt), exerciseLogs.exerciseName, exerciseLogs.setIndex);
}
