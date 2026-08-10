import { Hono } from 'hono';

import type { WorkerBindings } from '../env';
import { createApiError, internalServerError, unauthorized } from '../shared/errors/api';
import { parseWorkoutPlanRecordOrError } from '../services/workout-generator';
import { getApiRouteContext } from './context';
import {
  DEFAULT_SESSION_LIST_LIMIT,
  MISSING_MASTER_EXERCISE_ID_ERROR_MESSAGE,
  buildDefaultExerciseLogs,
  buildExerciseLogDto,
  buildSessionDto,
  createSessionWithLogs,
  deleteExerciseLogById,
  deleteSessionByIdempotencyKey,
  exerciseLogInputSchema,
  exerciseLogPatchSchema,
  findCanonicalExerciseForLog,
  findExerciseLogById,
  findLatestActiveSessionForUser,
  findLogsForSessionId,
  findLogsForSessionIds,
  findPlanForUserById,
  findSessionByIdempotencyKey,
  findSessionForUserById,
  findRecentSessionsForUser,
  groupBySession,
  insertExerciseLog,
  patchExerciseLog,
  setSessionCompleted,
  updateSessionNotes,
  type WorkoutSessionDto,
  workoutSessionCreateSchema,
  workoutSessionPatchSchema,
} from '../services/workout-session';
import { parseJsonPayload } from './validation';

export function createWorkoutSessionRoutes() {
  const route = new Hono<{ Bindings: WorkerBindings }>();

  route.get('/workout-sessions', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      if (!db) return c.json({ data: [] });

      const statusFilter = c.req.query('status');
      const rows =
        statusFilter === 'active'
          ? [await findLatestActiveSessionForUser(db, user.id)]
          : await findRecentSessionsForUser(db, user.id, DEFAULT_SESSION_LIST_LIMIT);

      if (statusFilter === 'active') {
        const activeSession = rows[0];
        if (!activeSession) {
          return c.json({ data: null });
        }

        const logs = await findLogsForSessionId(db, activeSession.id);
        const dtoResult = buildSessionDto(activeSession, logs);
        if (!dtoResult.ok) {
          return createApiError(c, 'invalid_session_data', dtoResult.error.message, {
            status: 500,
          });
        }

        return c.json({ data: dtoResult.dto });
      }

      const existingRows = rows.filter(
        (row): row is NonNullable<(typeof rows)[number]> => row !== undefined,
      );
      if (existingRows.length === 0) {
        return c.json({ data: [] });
      }

      const logs = await findLogsForSessionIds(
        db,
        existingRows.map((row) => row.id),
      );
      const logsBySession = groupBySession(logs);

      const dtos: WorkoutSessionDto[] = [];
      for (const row of existingRows) {
        const dtoResult = buildSessionDto(row, logsBySession[row.id] ?? []);
        if (!dtoResult.ok) {
          return createApiError(c, 'invalid_session_data', dtoResult.error.message, {
            status: 500,
          });
        }

        dtos.push(dtoResult.dto);
      }

      return c.json({ data: dtos });
    } catch (error) {
      if (error instanceof Error && error.message === 'Missing or invalid authenticated user context.') {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to load workout sessions.');
    }
  });

  route.post('/workout-sessions', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, workoutSessionCreateSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      if (!db) {
        return c.json({
          data: {
            workoutPlanId: parsed.data.workoutPlanId,
            dayIndex: parsed.data.dayIndex,
            scheduledDate: parsed.data.scheduledDate,
          },
        });
      }

      const idempotencyKey = c.req.header('Idempotency-Key')?.trim();
      const normalizedIdempotencyKey =
        idempotencyKey ??
        `plan:${parsed.data.workoutPlanId}|day:${parsed.data.dayIndex}|date:${parsed.data.scheduledDate}`;

      const existingSession = await findSessionByIdempotencyKey(
        db,
        user.id,
        normalizedIdempotencyKey,
      );
      if (existingSession) {
        const existingRows = await findLogsForSessionId(db, existingSession.id);
        const existingDtoResult = buildSessionDto(existingSession, existingRows);
        if (!existingDtoResult.ok) {
          return createApiError(c, 'invalid_session_data', existingDtoResult.error.message, {
            status: 500,
          });
        }

        return c.json({ data: existingDtoResult.dto });
      }

      const plan = await findPlanForUserById(db, user.id, parsed.data.workoutPlanId);
      if (!plan) {
        return createApiError(c, 'invalid_request', 'Workout plan not found.', { status: 404 });
      }

      const parsedPlan = parseWorkoutPlanRecordOrError(plan);
      if (!parsedPlan.ok) {
        return createApiError(c, 'invalid_request', parsedPlan.error.message, { status: 409 });
      }

      const selectedDay = parsedPlan.dto.plan.days[parsed.data.dayIndex];
      if (!selectedDay) {
        return createApiError(
          c,
          'invalid_request',
          'Day index out of range for selected workout plan.',
          { status: 400 },
        );
      }

      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      let exerciseLogsToInsert: Parameters<typeof createSessionWithLogs>[2];
      try {
        const generatedLogs = buildDefaultExerciseLogs({
          userId: user.id,
          workoutSessionId: sessionId,
          day: selectedDay,
        });

        exerciseLogsToInsert = generatedLogs.map((log) => ({
          id: crypto.randomUUID(),
          userId: log.userId,
          workoutSessionId: log.workoutSessionId,
          exerciseName: log.exerciseName,
          masterExerciseId: log.masterExerciseId,
          movementPattern: log.movementPattern,
          muscleGroupsJson: log.muscleGroupsJson,
          setIndex: log.setIndex,
          targetReps: log.targetReps,
          reps: log.reps,
          weight: log.weight,
          rpe: log.rpe,
          completed: log.completed,
          notes: log.notes,
        }));
      } catch (error) {
        if (error instanceof Error && error.message === MISSING_MASTER_EXERCISE_ID_ERROR_MESSAGE) {
          return createApiError(c, 'invalid_request', error.message, { status: 409 });
        }

        throw error;
      }

      try {
        await createSessionWithLogs(
          db,
          {
            id: sessionId,
            userId: user.id,
            workoutPlanId: parsed.data.workoutPlanId,
            dayIndex: parsed.data.dayIndex,
            status: 'active',
            scheduledDate: parsed.data.scheduledDate,
            idempotencyKey: normalizedIdempotencyKey,
            startedAt: now,
            completedAt: null,
            notes: null,
          },
          exerciseLogsToInsert,
        );
      } catch (error) {
        await deleteSessionByIdempotencyKey(db, user.id, normalizedIdempotencyKey).catch(
          () => undefined,
        );

        if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
          const duplicatedSession = await findSessionByIdempotencyKey(
            db,
            user.id,
            normalizedIdempotencyKey,
          );
          if (duplicatedSession) {
            const duplicatedRows = await findLogsForSessionId(db, duplicatedSession.id);
            const duplicatedDto = buildSessionDto(duplicatedSession, duplicatedRows);
            if (!duplicatedDto.ok) {
              return createApiError(c, 'invalid_session_data', duplicatedDto.error.message, {
                status: 500,
              });
            }
            return c.json({ data: duplicatedDto.dto });
          }
        }

        throw error;
      }

      const rows = await findLogsForSessionId(db, sessionId);
      const session = await findSessionForUserById(db, user.id, sessionId);
      if (!session) {
        return createApiError(c, 'internal_server_error', 'Unable to create workout session.', {
          status: 500,
        });
      }

      const dtoResult = buildSessionDto(session, rows);
      if (!dtoResult.ok) {
        return createApiError(c, 'invalid_session_data', dtoResult.error.message, { status: 500 });
      }

      return c.json({ data: dtoResult.dto });
    } catch (error) {
      if (error instanceof Error && error.message === 'Missing or invalid authenticated user context.') {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to create workout session.');
    }
  });

  route.get('/workout-sessions/:sessionId', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      if (!db) return c.json({ data: null });

      const sessionId = c.req.param('sessionId');
      const row = await findSessionForUserById(db, user.id, sessionId);
      if (!row) return c.json({ data: null }, 404);

      const logs = await findLogsForSessionId(db, sessionId);
      const dtoResult = buildSessionDto(row, logs);
      if (!dtoResult.ok) {
        return createApiError(c, 'invalid_session_data', dtoResult.error.message, { status: 500 });
      }

      return c.json({ data: dtoResult.dto });
    } catch (error) {
      if (error instanceof Error && error.message === 'Missing or invalid authenticated user context.') {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to load workout session.');
    }
  });

  route.patch('/workout-sessions/:sessionId', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, workoutSessionPatchSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      if (!db) return c.json({ data: { ...parsed.data, sessionId: c.req.param('sessionId') } });

      const sessionId = c.req.param('sessionId');
      await updateSessionNotes(
        db,
        user.id,
        sessionId,
        parsed.data.notes === undefined ? {} : { notes: parsed.data.notes },
      );

      const session = await findSessionForUserById(db, user.id, sessionId);
      if (!session) return c.json({ data: null }, 404);

      const logs = await findLogsForSessionId(db, sessionId);
      const dtoResult = buildSessionDto(session, logs);
      if (!dtoResult.ok) {
        return createApiError(c, 'invalid_session_data', dtoResult.error.message, { status: 500 });
      }

      return c.json({ data: dtoResult.dto });
    } catch (error) {
      if (error instanceof Error && error.message === 'Missing or invalid authenticated user context.') {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to update workout session.');
    }
  });

  route.post('/workout-sessions/:sessionId/complete', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      if (!db) return c.json({ data: { sessionId: c.req.param('sessionId'), completed: true } });

      const sessionId = c.req.param('sessionId');
      await setSessionCompleted(db, user.id, sessionId, new Date().toISOString());

      const session = await findSessionForUserById(db, user.id, sessionId);
      if (!session) return c.json({ data: null }, 404);

      const logs = await findLogsForSessionId(db, sessionId);
      const dtoResult = buildSessionDto(session, logs);
      if (!dtoResult.ok) {
        return createApiError(c, 'invalid_session_data', dtoResult.error.message, { status: 500 });
      }

      return c.json({ data: dtoResult.dto });
    } catch (error) {
      if (error instanceof Error && error.message === 'Missing or invalid authenticated user context.') {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to complete workout session.');
    }
  });

  route.post('/exercise-logs', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, exerciseLogInputSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      if (!db) {
        return c.json({
          data: {
            workoutSessionId: parsed.data.workoutSessionId,
            exerciseName: parsed.data.exerciseName,
            masterExerciseId: parsed.data.masterExerciseId,
            movementPattern: parsed.data.movementPattern,
            muscleGroups: parsed.data.muscleGroups,
            setIndex: parsed.data.setIndex,
            reps: parsed.data.reps,
            weightKg: parsed.data.weightKg,
            ...(parsed.data.rpe === undefined ? {} : { rpe: parsed.data.rpe }),
            ...(parsed.data.notes === undefined ? {} : { notes: parsed.data.notes }),
            ...(parsed.data.targetReps === undefined ? {} : { targetReps: parsed.data.targetReps }),
          },
        });
      }

      const canonicalExercise = await findCanonicalExerciseForLog(db, parsed.data.masterExerciseId);
      if (!canonicalExercise) {
        return createApiError(
          c,
          'invalid_request',
          'Master exercise ID is not in the canonical exercise catalog. Regenerate your workout plan before logging this exercise.',
          { status: 409 },
        );
      }

      const exerciseLogId = crypto.randomUUID();
      await insertExerciseLog(db, {
        id: exerciseLogId,
        userId: user.id,
        workoutSessionId: parsed.data.workoutSessionId,
        exerciseName: canonicalExercise.exerciseName,
        masterExerciseId: canonicalExercise.masterExerciseId,
        movementPattern: canonicalExercise.movementPattern,
        muscleGroupsJson: JSON.stringify(
          canonicalExercise.muscleGroups.length > 0
            ? canonicalExercise.muscleGroups
            : parsed.data.muscleGroups,
        ),
        setIndex: parsed.data.setIndex,
        targetReps: parsed.data.targetReps ?? null,
        reps: parsed.data.reps,
        weight: parsed.data.weightKg,
        rpe: parsed.data.rpe ?? null,
        completed: parsed.data.completed ? 1 : 0,
        notes: parsed.data.notes ?? null,
      });

      const row = await findExerciseLogById(db, exerciseLogId);
      if (!row) return c.json({ data: null }, 500);

      return c.json({ data: buildExerciseLogDto(row) });
    } catch (error) {
      if (error instanceof Error && error.message === 'Missing or invalid authenticated user context.') {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to create exercise log.');
    }
  });

  route.patch('/exercise-logs/:exerciseLogId', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, exerciseLogPatchSchema);
      if (!parsed.success) return parsed.response;

      const { db } = getApiRouteContext(c);
      if (!db) return c.json({ data: { id: c.req.param('exerciseLogId'), ...parsed.data } });

      const exerciseLogId = c.req.param('exerciseLogId');
      await patchExerciseLog(db, exerciseLogId, {
        reps: parsed.data.reps,
        weight: parsed.data.weightKg,
        rpe: parsed.data.rpe ?? null,
        completed: parsed.data.completed ? 1 : 0,
        notes: parsed.data.notes ?? null,
      });

      const row = await findExerciseLogById(db, exerciseLogId);
      if (!row) return c.json({ data: null }, 404);

      return c.json({ data: buildExerciseLogDto(row) });
    } catch (error) {
      if (error instanceof Error && error.message === 'Missing or invalid authenticated user context.') {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to patch exercise log.');
    }
  });

  route.delete('/exercise-logs/:exerciseLogId', async (c) => {
    try {
      const { db } = getApiRouteContext(c);
      if (!db)
        return c.json({ data: { exerciseLogId: c.req.param('exerciseLogId'), deleted: true } });

      const exerciseLogId = c.req.param('exerciseLogId');
      await deleteExerciseLogById(db, exerciseLogId);
      return c.json({ data: { exerciseLogId, deleted: true } });
    } catch (error) {
      if (error instanceof Error && error.message === 'Missing or invalid authenticated user context.') {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to delete exercise log.');
    }
  });

  return route;
}

