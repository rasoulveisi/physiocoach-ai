import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { z } from 'zod';

import { createDb } from '../db/client';
import { coachMessages, coachPainAlerts, exerciseLogs, workoutPlans, workoutSessions } from '../db/schema';
import { inMemoryCoachAlerts, inMemoryCoachMessages } from './coach';
import { createExpressRouter } from './express-adapter';
import { parseWorkoutPlanRecordOrError } from '../services/workout-generator';
import { generatePrehabRoutine } from '../services/prehab-generator';
import { createApiError, handleRouteError, notFound } from '../shared/errors/api';
import { MovementPatternSchema } from '../types/workout';
import { getApiRouteContext } from './context';
import { parseJsonPayload } from './validation';

type DbClient = ReturnType<typeof createDb>;

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
    notes: z.string().optional().nullable(),
    status: z.enum(['active', 'completed']).optional(),
  })
  .strict();

export const exerciseLogPatchSchema = z
  .object({
    reps: z.number().int().min(0),
    weightKg: z.number().min(0),
    rpe: z.number().min(1).max(10).optional().nullable(),
    completed: z.boolean(),
    notes: z.string().optional().nullable(),
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

export const exerciseLogInputSchema = z
  .object({
    workoutSessionId: z.string().min(1),
    exerciseName: z.string().min(1),
    masterExerciseId: z.string().min(1).optional().nullable(),
    movementPattern: MovementPatternSchema,
    muscleGroups: z.array(z.string().min(1)).min(1),
    setIndex: z.number().int().min(1),
    targetReps: z.string().min(1).optional().nullable(),
    reps: z.number().int().min(0).default(0),
    weightKg: z.number().min(0).default(0),
    rpe: z.number().min(1).max(10).optional().nullable(),
    completed: z.boolean().default(false),
    notes: z.string().optional().nullable(),
    setType: z.enum(SET_TYPE_VALUES).optional().default('working'),
  })
  .strict();

export const prehabGenerateSchema = z
  .object({
    exercises: z
      .array(
        z.object({
          name: z.string().min(1),
          movementPattern: z.string().optional(),
          muscleGroups: z.array(z.string()).optional(),
        }),
      )
      .default([]),
    limitations: z.array(z.string()).optional().default([]),
    sessionId: z.string().optional(),
  })
  .strict();

export const recordPainAlertSchema = z
  .object({
    sessionId: z.string().optional().nullable(),
    painScore: z.number().int().min(0).max(10),
    jointRegion: z.string().optional().nullable(),
    exerciseName: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .strict();

export const workoutSessionCompleteSchema = z
  .object({
    painScore: z.number().int().min(0).max(10).optional().nullable(),
    jointRegion: z.string().optional().nullable(),
    exerciseName: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    sessionRpe: z.number().min(1).max(10).optional().nullable(),
    durationSeconds: z.number().optional().nullable(),
  })
  .strict();

export async function triggerHighPriorityPainAlert(params: {
  userId: string;
  userName?: string | null | undefined;
  painScore: number;
  jointRegion?: string | null | undefined;
  exerciseName?: string | null | undefined;
  notes?: string | null | undefined;
  sessionId?: string | null | undefined;
  db?: DbClient | null | undefined;
}) {
  if (params.painScore <= 4) return null;

  const now = new Date().toISOString();
  const alertId = `alert-${crypto.randomUUID().slice(0, 8)}`;
  const coachId = '00000000-0000-4000-8000-000000000001';
  const clientId = params.userId || 'pt-client-001';
  const clientName = params.userName || 'Patient';

  const alertResult = {
    id: alertId,
    coachId,
    clientId,
    clientName,
    painScore: params.painScore,
    jointRegion: params.jointRegion || 'Joint/Tendon Discomfort',
    exerciseName: params.exerciseName || null,
    sessionDate: now.slice(0, 10),
    status: 'active' as const,
    clinicalNote: params.notes || null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  inMemoryCoachAlerts.set(alertId, alertResult);

  const msgId = `msg-${crypto.randomUUID().slice(0, 8)}`;
  const alertMessage = {
    id: msgId,
    coachId,
    clientId,
    senderRole: 'client' as const,
    senderName: clientName,
    message: `⚠️ Pain Alert (${params.painScore}/10) reported for ${params.jointRegion || 'joint'}${params.exerciseName ? ` during ${params.exerciseName}` : ''}.${params.notes ? ` Notes: ${params.notes}` : ''}`,
    isRead: false,
    isPainAlert: true,
    painScore: params.painScore,
    jointRegion: params.jointRegion || null,
    relatedSessionId: params.sessionId || null,
    createdAt: now,
    updatedAt: now,
  };
  inMemoryCoachMessages.set(msgId, alertMessage);

  if (params.db) {
    try {
      await params.db.insert(coachPainAlerts).values({
        id: alertId,
        coachId,
        clientId,
        clientName,
        painScore: alertResult.painScore,
        jointRegion: alertResult.jointRegion,
        exerciseName: alertResult.exerciseName,
        sessionDate: alertResult.sessionDate,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      await params.db.insert(coachMessages).values({
        id: msgId,
        coachId,
        clientId,
        senderRole: 'client',
        senderName: clientName,
        message: alertMessage.message,
        isRead: false,
        isPainAlert: true,
        painScore: params.painScore,
        jointRegion: alertResult.jointRegion,
        relatedSessionId: params.sessionId || null,
        createdAt: now,
        updatedAt: now,
      });
    } catch (dbErr) {
      console.warn('workout_sessions.pain_alert.db_error', dbErr);
    }
  }

  return alertResult;
}

export function createWorkoutSessionRoutes() {
  const route = createExpressRouter();

  route.post('/workout-sessions/prehab', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, prehabGenerateSchema);
      if (!parsed.success) return parsed.response;

      const result = generatePrehabRoutine(parsed.data);
      return c.json(result);
    } catch (error) {
      return handleRouteError(c, error, 'Failed to generate prehab routine.');
    }
  });

  route.get('/workout-sessions', async (c) => {
    const statusFilter = c.req.query('status');
    try {
      const { user, db } = getApiRouteContext(c);
      if (!db) {
        return c.json({ data: statusFilter === 'active' ? null : [] });
      }

      if (statusFilter === 'active') {
        const activeRows = await db
          .select()
          .from(workoutSessions)
          .where(and(eq(workoutSessions.userId, user.id), eq(workoutSessions.status, 'active')))
          .orderBy(desc(workoutSessions.startedAt))
          .limit(1);

        const activeSession = activeRows[0];
        if (!activeSession) {
          return c.json({ data: null });
        }

        const logs = await db
          .select()
          .from(exerciseLogs)
          .where(eq(exerciseLogs.workoutSessionId, activeSession.id));

        const masterExerciseIds = logs
          .map((l) => l.masterExerciseId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);

        const previousPerformance = await findPreviousPerformanceByExercises(
          db,
          user.id,
          masterExerciseIds,
          activeSession.id,
        );

        return c.json({
          data: buildSessionDto(activeSession, logs, previousPerformance),
        });
      }

      const sessions = await db
        .select()
        .from(workoutSessions)
        .where(eq(workoutSessions.userId, user.id))
        .orderBy(desc(workoutSessions.startedAt))
        .limit(20);

      if (sessions.length === 0) {
        return c.json({ data: [] });
      }

      const sessionIds = sessions.map((s) => s.id);
      const allLogs = await db
        .select()
        .from(exerciseLogs)
        .where(inArray(exerciseLogs.workoutSessionId, sessionIds));

      const logsBySession: Record<string, typeof allLogs> = {};
      for (const log of allLogs) {
        const list = logsBySession[log.workoutSessionId] ?? [];
        list.push(log);
        logsBySession[log.workoutSessionId] = list;
      }

      const dtos = sessions.map((session) =>
        buildSessionDto(session, logsBySession[session.id] ?? []),
      );

      return c.json({ data: dtos });
    } catch (error) {
      console.warn('workout_sessions.load.fallback', error);
      return c.json({ data: statusFilter === 'active' ? null : [] });
    }
  });

  route.get('/workout-sessions/:sessionId', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      if (!db) return c.json({ data: null }, 404);

      const sessionId = c.req.param('sessionId');
      const sessionRows = await db
        .select()
        .from(workoutSessions)
        .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, user.id)))
        .limit(1);

      const session = sessionRows[0];
      if (!session) {
        return notFound(c, 'Workout session not found.');
      }

      const logs = await db
        .select()
        .from(exerciseLogs)
        .where(eq(exerciseLogs.workoutSessionId, session.id));

      const masterExerciseIds = logs
        .map((l) => l.masterExerciseId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      const previousPerformance = await findPreviousPerformanceByExercises(
        db,
        user.id,
        masterExerciseIds,
        session.id,
      );

      return c.json({
        data: buildSessionDto(session, logs, previousPerformance),
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to load workout session.');
    }
  });

  route.post('/workout-sessions', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, workoutSessionCreateSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      if (!db) {
        return createApiError(c, 'internal_server_error', 'Database client is not available.');
      }

      const idempotencyKey = c.req.header('Idempotency-Key') ?? null;

      if (idempotencyKey) {
        const existingWithKey = await db
          .select()
          .from(workoutSessions)
          .where(
            and(
              eq(workoutSessions.userId, user.id),
              eq(workoutSessions.idempotencyKey, idempotencyKey),
            ),
          )
          .limit(1);

        if (existingWithKey[0]) {
          const session = existingWithKey[0];
          const logs = await db
            .select()
            .from(exerciseLogs)
            .where(eq(exerciseLogs.workoutSessionId, session.id));
          return c.json({ data: buildSessionDto(session, logs) });
        }
      }

      const activeExisting = await db
        .select()
        .from(workoutSessions)
        .where(
          and(
            eq(workoutSessions.userId, user.id),
            eq(workoutSessions.workoutPlanId, parsed.data.workoutPlanId),
            eq(workoutSessions.dayIndex, parsed.data.dayIndex),
            eq(workoutSessions.scheduledDate, parsed.data.scheduledDate),
            eq(workoutSessions.status, 'active'),
          ),
        )
        .limit(1);

      if (activeExisting[0]) {
        const session = activeExisting[0];
        const logs = await db
          .select()
          .from(exerciseLogs)
          .where(eq(exerciseLogs.workoutSessionId, session.id));
        return c.json({ data: buildSessionDto(session, logs) });
      }

      const planRows = await db
        .select()
        .from(workoutPlans)
        .where(eq(workoutPlans.id, parsed.data.workoutPlanId))
        .limit(1);

      const planRow = planRows[0];
      if (!planRow) {
        return notFound(c, 'Workout plan not found.');
      }

      const parsedPlanResult = parseWorkoutPlanRecordOrError(planRow);
      if (!parsedPlanResult.ok) {
        return createApiError(c, 'invalid_workout_plan_record', parsedPlanResult.error.message, {
          status: 409,
        });
      }

      const targetDay = parsedPlanResult.dto.plan.days[parsed.data.dayIndex];
      if (!targetDay) {
        return createApiError(
          c,
          'invalid_request',
          `Day index ${parsed.data.dayIndex} is invalid for workout plan.`,
          { status: 400 },
        );
      }

      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      const newSessionRecord = {
        id: sessionId,
        userId: user.id,
        workoutPlanId: parsed.data.workoutPlanId,
        dayIndex: parsed.data.dayIndex,
        status: 'active',
        scheduledDate: parsed.data.scheduledDate,
        idempotencyKey,
        startedAt: now,
        completedAt: null,
        notes: null,
      };

      const masterExerciseIds = targetDay.exercises
        .map((e) => e.masterExerciseId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      const previousPerformance = await findPreviousPerformanceByExercises(
        db,
        user.id,
        masterExerciseIds,
      );

      const logsToInsert: Array<typeof exerciseLogs.$inferInsert> = [];
      for (const exercise of targetDay.exercises) {
        const setCount = Math.max(1, exercise.sets || 3);
        const muscleGroups = [exercise.muscleGroup || exercise.movementPattern || 'target'];
        const previousPerf = exercise.masterExerciseId
          ? previousPerformance.get(exercise.masterExerciseId)
          : null;

        for (let setIdx = 1; setIdx <= setCount; setIdx++) {
          logsToInsert.push({
            id: crypto.randomUUID(),
            userId: user.id,
            workoutSessionId: sessionId,
            exerciseName: exercise.name,
            masterExerciseId: exercise.masterExerciseId || null,
            movementPattern: exercise.movementPattern,
            muscleGroupsJson: JSON.stringify(muscleGroups),
            setIndex: setIdx,
            targetReps: exercise.reps ? String(exercise.reps) : null,
            reps: 0,
            weight: 0,
            rpe: exercise.rpe ?? null,
            completed: false,
            notes: null,
            exerciseType: 'working',
            previousPerformanceJson: previousPerf ? JSON.stringify(previousPerf) : null,
          });
        }
      }

      await db.insert(workoutSessions).values(newSessionRecord);

      if (logsToInsert.length > 0) {
        const BATCH_SIZE = 25;
        for (let i = 0; i < logsToInsert.length; i += BATCH_SIZE) {
          const chunk = logsToInsert.slice(i, i + BATCH_SIZE);
          await db.insert(exerciseLogs).values(chunk);
        }
      }

      const createdLogs = await db
        .select()
        .from(exerciseLogs)
        .where(eq(exerciseLogs.workoutSessionId, sessionId));

      return c.json({
        data: buildSessionDto(newSessionRecord, createdLogs, previousPerformance),
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to create workout session.');
    }
  });

  route.patch('/workout-sessions/:sessionId', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, workoutSessionPatchSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      if (!db) return notFound(c, 'Workout session not found.');

      const sessionId = c.req.param('sessionId');
      const existing = await db
        .select()
        .from(workoutSessions)
        .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, user.id)))
        .limit(1);

      if (!existing[0]) {
        return notFound(c, 'Workout session not found.');
      }

      const patchData: { notes?: string | null; status?: string } = {};
      if (parsed.data.notes !== undefined) {
        patchData.notes = parsed.data.notes;
      }
      if (parsed.data.status !== undefined) {
        patchData.status = parsed.data.status;
      }

      if (Object.keys(patchData).length > 0) {
        await db
          .update(workoutSessions)
          .set(patchData)
          .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, user.id)));
      }

      const updated = await db
        .select()
        .from(workoutSessions)
        .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, user.id)))
        .limit(1);

      const logs = await db
        .select()
        .from(exerciseLogs)
        .where(eq(exerciseLogs.workoutSessionId, sessionId));

      return c.json({ data: buildSessionDto(updated[0]!, logs) });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to update workout session.');
    }
  });

  route.post('/workout-sessions/pain-alert', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, recordPainAlertSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      const alert = await triggerHighPriorityPainAlert({
        userId: user.id,
        userName: user.displayName,
        painScore: parsed.data.painScore,
        jointRegion: parsed.data.jointRegion,
        exerciseName: parsed.data.exerciseName,
        notes: parsed.data.notes,
        sessionId: parsed.data.sessionId,
        db,
      });

      return c.json({
        success: true,
        alertTriggered: Boolean(alert),
        alert,
        message: alert
          ? 'High-priority pain alert transmitted directly to your Physical Therapist.'
          : 'Pain score recorded within safe tolerance.',
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to record pain alert.');
    }
  });

  route.post('/workout-sessions/:sessionId/pain-alert', async (c) => {
    try {
      const sessionId = c.req.param('sessionId');
      const parsed = await parseJsonPayload(c, recordPainAlertSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      const alert = await triggerHighPriorityPainAlert({
        userId: user.id,
        userName: user.displayName,
        painScore: parsed.data.painScore,
        jointRegion: parsed.data.jointRegion,
        exerciseName: parsed.data.exerciseName,
        notes: parsed.data.notes,
        sessionId,
        db,
      });

      return c.json({
        success: true,
        alertTriggered: Boolean(alert),
        alert,
        message: alert
          ? 'High-priority pain alert transmitted directly to your Physical Therapist.'
          : 'Pain score recorded within safe tolerance.',
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to record pain alert.');
    }
  });

  route.post('/workout-sessions/:sessionId/complete', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      if (!db) return notFound(c, 'Workout session not found.');

      const sessionId = c.req.param('sessionId');
      let painScore: number | null = null;
      let jointRegion: string | null = null;
      let notes: string | null = null;

      try {
        const body = (await c.req.json()) as Record<string, unknown>;
        if (typeof body?.painScore === 'number') painScore = body.painScore;
        if (typeof body?.jointRegion === 'string') jointRegion = body.jointRegion;
        if (typeof body?.notes === 'string') notes = body.notes;
      } catch {
        // Body is optional
      }

      const existing = await db
        .select()
        .from(workoutSessions)
        .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, user.id)))
        .limit(1);

      if (!existing[0]) {
        return notFound(c, 'Workout session not found.');
      }

      const completedAt = new Date().toISOString();
      await db
        .update(workoutSessions)
        .set({
          status: 'completed',
          completedAt,
        })
        .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, user.id)));

      if (painScore !== null && painScore > 4) {
        await triggerHighPriorityPainAlert({
          userId: user.id,
          userName: user.displayName,
          painScore,
          jointRegion,
          notes,
          sessionId,
          db,
        });
      }

      const updated = await db
        .select()
        .from(workoutSessions)
        .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, user.id)))
        .limit(1);

      const logs = await db
        .select()
        .from(exerciseLogs)
        .where(eq(exerciseLogs.workoutSessionId, sessionId));

      return c.json({ data: buildSessionDto(updated[0]!, logs) });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to complete workout session.');
    }
  });

  route.post('/workout-sessions/:sessionId/swap-exercise', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, swapExerciseSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      if (!db) return notFound(c, 'Workout session not found.');

      const sessionId = c.req.param('sessionId');
      const existing = await db
        .select()
        .from(workoutSessions)
        .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, user.id)))
        .limit(1);

      if (!existing[0]) {
        return notFound(c, 'Workout session not found.');
      }

      const key = parsed.data.logGroupKey;
      const logs = await db
        .select()
        .from(exerciseLogs)
        .where(eq(exerciseLogs.workoutSessionId, sessionId));

      const matchingLogIds = logs
        .filter((l) => l.masterExerciseId === key || l.exerciseName === key)
        .map((l) => l.id);

      if (matchingLogIds.length > 0) {
        await db
          .update(exerciseLogs)
          .set({
            masterExerciseId: parsed.data.newMasterExerciseId,
            exerciseName: parsed.data.newExerciseName,
            movementPattern: parsed.data.newMovementPattern,
            muscleGroupsJson: JSON.stringify(parsed.data.newMuscleGroups),
          })
          .where(inArray(exerciseLogs.id, matchingLogIds));
      }

      const updatedLogs = await db
        .select()
        .from(exerciseLogs)
        .where(eq(exerciseLogs.workoutSessionId, sessionId));

      return c.json({ data: buildSessionDto(existing[0], updatedLogs) });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to swap exercise.');
    }
  });

  route.post('/exercise-logs', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, exerciseLogInputSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      if (!db) {
        return createApiError(c, 'internal_server_error', 'Database client is not available.');
      }

      const logId = crypto.randomUUID();
      const insertRecord: typeof exerciseLogs.$inferInsert = {
        id: logId,
        userId: user.id,
        workoutSessionId: parsed.data.workoutSessionId,
        exerciseName: parsed.data.exerciseName,
        masterExerciseId: parsed.data.masterExerciseId ?? null,
        movementPattern: parsed.data.movementPattern,
        muscleGroupsJson: JSON.stringify(parsed.data.muscleGroups),
        setIndex: parsed.data.setIndex,
        targetReps: parsed.data.targetReps ?? null,
        reps: parsed.data.reps,
        weight: parsed.data.weightKg,
        rpe: parsed.data.rpe ?? null,
        completed: Boolean(parsed.data.completed),
        notes: parsed.data.notes ?? null,
        exerciseType: parsed.data.setType ?? 'working',
        previousPerformanceJson: null,
      };

      await db.insert(exerciseLogs).values(insertRecord);

      const rows = await db.select().from(exerciseLogs).where(eq(exerciseLogs.id, logId)).limit(1);

      return c.json({ data: buildExerciseLogDto(rows[0]!) }, 201);
    } catch (error) {
      return handleRouteError(c, error, 'Failed to create exercise log.');
    }
  });

  route.patch('/exercise-logs/:exerciseLogId', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, exerciseLogPatchSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      if (!db) return notFound(c, 'Exercise log not found.');

      const exerciseLogId = c.req.param('exerciseLogId');
      const existing = await db
        .select()
        .from(exerciseLogs)
        .where(and(eq(exerciseLogs.id, exerciseLogId), eq(exerciseLogs.userId, user.id)))
        .limit(1);

      if (!existing[0]) {
        return notFound(c, 'Exercise log not found.');
      }

      await db
        .update(exerciseLogs)
        .set({
          reps: parsed.data.reps,
          weight: parsed.data.weightKg,
          rpe: parsed.data.rpe ?? null,
          ...(parsed.data.completed !== undefined
            ? { completed: Boolean(parsed.data.completed) }
            : {}),
          notes: parsed.data.notes ?? null,
          ...(parsed.data.setType ? { exerciseType: parsed.data.setType } : {}),
        })
        .where(and(eq(exerciseLogs.id, exerciseLogId), eq(exerciseLogs.userId, user.id)));

      const updated = await db
        .select()
        .from(exerciseLogs)
        .where(eq(exerciseLogs.id, exerciseLogId))
        .limit(1);

      return c.json({ data: buildExerciseLogDto(updated[0]!) });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to update exercise log.');
    }
  });

  route.delete('/exercise-logs/:exerciseLogId', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      if (!db) return notFound(c, 'Exercise log not found.');

      const exerciseLogId = c.req.param('exerciseLogId');
      await db
        .delete(exerciseLogs)
        .where(and(eq(exerciseLogs.id, exerciseLogId), eq(exerciseLogs.userId, user.id)));

      return c.json({ data: { exerciseLogId, deleted: true } });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to delete exercise log.');
    }
  });

  return route;
}

export const workoutSessionsRouter = createWorkoutSessionRoutes();

export function parseMuscleGroups(raw: string | null): string[] {
  if (!raw) return [];
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

export function buildExerciseLogDto(
  row: typeof exerciseLogs.$inferSelect,
  previousPerformanceOverride?: PreviousPerformance | null,
) {
  const storedPrevious = parsePreviousPerformance(row.previousPerformanceJson);
  return {
    id: row.id,
    exerciseName: row.exerciseName,
    movementPattern: row.movementPattern,
    muscleGroups: parseMuscleGroups(row.muscleGroupsJson),
    setIndex: row.setIndex,
    targetReps: row.targetReps,
    masterExerciseId: row.masterExerciseId,
    reps: row.reps,
    weightKg: row.weight,
    rpe: row.rpe,
    completed: Boolean(row.completed),
    notes: row.notes,
    setType: (row.exerciseType as ExerciseSetType) || 'working',
    previousPerformance: storedPrevious ?? previousPerformanceOverride ?? null,
  };
}

export function buildSessionDto(
  session: typeof workoutSessions.$inferSelect,
  logs: Array<typeof exerciseLogs.$inferSelect>,
  previousPerformanceByExercise?: Map<string, PreviousPerformance>,
) {
  const sortedLogs = [...logs].sort((a, b) => a.setIndex - b.setIndex);
  const mappedLogs = sortedLogs.map((log) => {
    const prev = log.masterExerciseId
      ? previousPerformanceByExercise?.get(log.masterExerciseId)
      : null;
    return buildExerciseLogDto(log, prev);
  });

  const completedSets = mappedLogs.filter((log) => log.completed).length;

  return {
    id: session.id,
    workoutPlanId: session.workoutPlanId,
    dayIndex: session.dayIndex,
    status: (session.status as 'active' | 'completed') || 'active',
    scheduledDate: session.scheduledDate,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    notes: session.notes,
    progress: {
      completedSets,
      totalSets: mappedLogs.length,
    },
    logs: mappedLogs,
  };
}

async function findPreviousPerformanceByExercises(
  db: DbClient,
  userId: string,
  masterExerciseIds: string[],
  excludeSessionId?: string,
): Promise<Map<string, PreviousPerformance>> {
  const result = new Map<string, PreviousPerformance>();
  const uniqueIds = Array.from(
    new Set(masterExerciseIds.filter((id) => id && id.trim().length > 0)),
  );
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
        eq(exerciseLogs.completed, true),
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
      date: (row.completedAt ?? row.scheduledDate ?? '').slice(0, 10),
    });
  }

  return result;
}
