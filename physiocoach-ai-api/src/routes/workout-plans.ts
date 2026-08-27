import { and, desc, eq } from 'drizzle-orm';
import { createExpressRouter } from './express-adapter';
import { createDb } from '../db/client';
import {
  assessmentConsiderations,
  assessments,
  bodyConsiderations,
  workoutPlans,
} from '../db/schema';
import { createApiError, internalServerError, unauthorized } from '../shared/errors/api';
import {
  buildPlanInputHash,
  buildWorkoutPlanContext,
  buildWorkoutPlanModelConfig,
  buildWorkoutPlanRecord,
  createWorkoutPlanProvider,
  generateWorkoutPlanWithSafety,
  parseWorkoutPlanRecordOrError,
  type GeneratePlanInput,
  type WorkoutPlanRecord,
  WorkoutPlanGenerationError,
} from '../services/workout-generator';
import {
  hasExplicitConsiderations,
  legacySafetyContextFromConsiderations,
  resolveAssessmentConsiderations,
} from '../types/assessment';
import { loadAssessmentConsiderations } from './assessments';
import {
  getLatestProfileForUser,
  mapProfileRecordToInput,
  upsertUserAndProfile,
} from '../services/user-profile';
import { getApiRouteContext, hasDbClient } from './context';

type DbClient = ReturnType<typeof createDb>;

export function createWorkoutPlanRoutes() {
  const route = createExpressRouter();

  route.post('/workout-plans/generate', async (c) => {
    try {
      const generatePayload = await c.req.json().catch(() => undefined);
      if (generatePayload === undefined) {
        return createApiError(
          c,
          'invalid_request',
          'Workout plan generation requires a JSON body.',
          {
            details: {
              issues: [
                {
                  path: '',
                  message: 'Expected an object containing assessment and optional profile.',
                },
              ],
            },
          },
        );
      }

      const routeContext = getApiRouteContext(c);
      const { user, env, db } = routeContext;
      const now = new Date().toISOString();

      let resolvedAssessment =
        generatePayload && typeof generatePayload === 'object' && 'assessment' in generatePayload
          ? generatePayload.assessment
          : null;

      if (!resolvedAssessment && hasDbClient(routeContext)) {
        const assessmentRows = await routeContext.db
          .select()
          .from(assessments)
          .where(eq(assessments.userId, user.id))
          .orderBy(desc(assessments.completedAt))
          .limit(1);

        if (assessmentRows[0]) {
          const row = assessmentRows[0];
          const goals =
            typeof row.goalsJson === 'string' ? JSON.parse(row.goalsJson) : row.goalsJson;
          const equipment =
            typeof row.equipmentJson === 'string' ? JSON.parse(row.equipmentJson) : row.equipmentJson;
          const limitations =
            typeof row.limitationsJson === 'string'
              ? JSON.parse(row.limitationsJson)
              : row.limitationsJson;
          const postureFlags =
            typeof row.postureFlagsJson === 'string'
              ? JSON.parse(row.postureFlagsJson)
              : row.postureFlagsJson;
          const loadedConsiderations = await loadAssessmentConsiderations(routeContext.db, row.id);
          resolvedAssessment = {
            goals: Array.isArray(goals) && goals.length > 0 ? goals : ['strength'],
            frequencyDays: row.frequencyDays || 3,
            equipment: Array.isArray(equipment) && equipment.length > 0 ? equipment : ['home_gym'],
            considerations: loadedConsiderations,
            limitations: Array.isArray(limitations) ? limitations : [],
            postureFlags: Array.isArray(postureFlags) ? postureFlags : [],
          };
        }
      }

      if (!resolvedAssessment) {
        resolvedAssessment = {
          goals: ['strength'],
          frequencyDays: 3,
          equipment: ['home_gym'],
          limitations: [],
          postureFlags: [],
        };
      }

      const payloadProfile =
        generatePayload && typeof generatePayload === 'object' && 'profile' in generatePayload
          ? generatePayload.profile
          : null;
      const profileRow =
        !payloadProfile && hasDbClient(routeContext)
          ? await getLatestProfileForUser(routeContext.db, user.id)
          : null;
      let resolvedProfile = payloadProfile ?? mapProfileRecordToInput(profileRow);

      if (!resolvedProfile) {
        resolvedProfile = {
          age: 30,
          sex: 'prefer_not_to_say',
          heightCm: 175,
          weightKg: 75,
          lifestyle: 'active',
          experienceLevel: 'beginner',
        };
      }

      const traceId = routeContext.requestId;
      const generationInput: GeneratePlanInput = {
        assessment: hasExplicitConsiderations(resolvedAssessment)
          ? resolvedAssessment
          : { ...resolvedAssessment, considerations: undefined },
        profile: resolvedProfile,
      };
      const inputHash = await buildPlanInputHash(generationInput);
      const modelConfig = buildWorkoutPlanModelConfig(env);
      console.info('workout_plan.generate.config', {
        appEnv: env.APP_ENV,
        primaryModel: modelConfig.primaryModel,
        fallbackModels: modelConfig.fallbackModels,
        timeoutMs: modelConfig.timeoutMs,
        maxRetries: modelConfig.maxRetries,
        inputHash,
        traceId,
      });

      if (hasDbClient(routeContext)) {
        await upsertUserAndProfile(routeContext.db, user, resolvedProfile, now);
      }

      let generationResult;
      try {
        generationResult = await generateWorkoutPlanWithSafety(
          createWorkoutPlanProvider(env),
          buildWorkoutPlanContext(generationInput),
          modelConfig,
          inputHash,
          {
            forceFresh: true,
            provisionalNoRuleCautions: env.APP_ENV === 'dev',
            db,
            userId: user.id,
            traceId,
            inputHash,
          },
          db,
        );
      } catch (error) {
        if (error instanceof WorkoutPlanGenerationError) {
          return createApiError(c, 'workout_plan_generation_failed', error.message, {
            status: 409,
            details: {
              traceId,
              reason: error.details?.reason ?? 'workout_plan_generation_error',
              issues: error.details?.issues ?? [error.message],
            },
          });
        }

        return createApiError(
          c,
          'workout_plan_generation_failed',
          'Medical AI workout plan generation could not be safely completed.',
          {
            status: 409,
            details: {
              traceId,
              reason: error instanceof Error ? error.message : 'Unknown generation failure.',
            },
          },
        );
      }

      const record = buildWorkoutPlanRecord({
        id: crypto.randomUUID(),
        userId: user.id,
        assessmentId: crypto.randomUUID(),
        inputHash,
        createdAt: now,
        result: generationResult,
      });

      const parsedRecord = parseWorkoutPlanRecordOrError(record);
      if (!parsedRecord.ok) {
        return createApiError(c, 'invalid_workout_plan_record', parsedRecord.error.message, {
          status: 409,
          details: parsedRecord.error.issues,
        });
      }

      if (hasDbClient(routeContext)) {
        await persistAssessmentAndPlan(routeContext.db, user.id, generationInput, record);
      }

      return c.json({
        data: {
          ...parsedRecord.dto,
          inputHash,
          cached: false,
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Missing or invalid authenticated user context.'
      ) {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to generate workout plan.');
    }
  });

  route.get('/workout-plans/current', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      if (!db) {
        return c.json({ data: null });
      }

      const rows = await db
        .select()
        .from(workoutPlans)
        .where(and(eq(workoutPlans.userId, user.id), eq(workoutPlans.status, 'active')))
        .orderBy(desc(workoutPlans.createdAt))
        .limit(1);

      const row = rows[0];
      if (!row) {
        return c.json({ data: null });
      }

      const parsedRecord = parseWorkoutPlanRecordOrError(row);
      if (!parsedRecord.ok) {
        return createApiError(c, 'invalid_workout_plan_record', parsedRecord.error.message, {
          status: 409,
          details: parsedRecord.error.issues,
        });
      }

      return c.json({ data: parsedRecord.dto });
    } catch (error) {
      console.warn('workout_plans.current.fallback', error);
      return c.json({ data: null });
    }
  });

  route.get('/workout-plans/:planId', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      if (!db) {
        return c.json({ data: null });
      }

      const planId = c.req.param('planId');
      const rows = await db
        .select()
        .from(workoutPlans)
        .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, user.id)))
        .limit(1);

      const row = rows[0];
      if (!row) {
        return c.json({ data: null }, 404);
      }

      const parsedRecord = parseWorkoutPlanRecordOrError(row);
      if (!parsedRecord.ok) {
        return createApiError(c, 'invalid_workout_plan_record', parsedRecord.error.message, {
          status: 409,
          details: parsedRecord.error.issues,
        });
      }

      return c.json({ data: parsedRecord.dto });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Missing or invalid authenticated user context.'
      ) {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to load workout plan.');
    }
  });

  route.delete('/workout-plans/current', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      if (!db) {
        return c.json({ data: null }, 409);
      }

      const rows = await db
        .select()
        .from(workoutPlans)
        .where(and(eq(workoutPlans.userId, user.id), eq(workoutPlans.status, 'active')))
        .orderBy(desc(workoutPlans.createdAt))
        .limit(1);

      const current = rows[0];
      if (!current) {
        return c.json({ data: null }, 404);
      }

      await db
        .update(workoutPlans)
        .set({ status: 'archived' })
        .where(and(eq(workoutPlans.userId, user.id), eq(workoutPlans.status, 'active')));

      return c.json({ data: { id: current.id, deleted: true } });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Missing or invalid authenticated user context.'
      ) {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to delete current workout plan.');
    }
  });

  route.delete('/workout-plans/:planId', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      if (!db) {
        return c.json({ data: null }, 409);
      }

      const planId = c.req.param('planId');
      const rows = await db
        .select()
        .from(workoutPlans)
        .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, user.id)))
        .limit(1);

      const targetPlan = rows[0];
      if (!targetPlan) {
        return c.json({ data: null }, 404);
      }

      await db
        .update(workoutPlans)
        .set({ status: 'archived' })
        .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, user.id)));

      return c.json({ data: { id: planId, deleted: true } });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Missing or invalid authenticated user context.'
      ) {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to delete workout plan.');
    }
  });

  return route;
}

export const workoutPlansRouter = createWorkoutPlanRoutes();

export async function persistAssessmentAndPlan(
  db: DbClient,
  userId: string,
  input: GeneratePlanInput,
  record: WorkoutPlanRecord,
) {
  const assessmentId = crypto.randomUUID();
  const considerations = resolveAssessmentConsiderations(input.assessment);
  const legacySafety = legacySafetyContextFromConsiderations(considerations);
  const idsByCode = await loadActiveConsiderationIds(db, considerations);

  await db
    .update(workoutPlans)
    .set({ status: 'archived' })
    .where(and(eq(workoutPlans.userId, userId), eq(workoutPlans.status, 'active')));

  await db.insert(assessments).values({
    id: assessmentId,
    userId,
    goalsJson: JSON.stringify(input.assessment.goals),
    frequencyDays: input.assessment.frequencyDays,
    equipmentJson: JSON.stringify(input.assessment.equipment),
    limitationsJson: JSON.stringify(legacySafety.limitations),
    postureFlagsJson: JSON.stringify(legacySafety.postureFlags),
    completedAt: record.createdAt,
    inputHash: record.inputHash,
  });

  if (considerations.length > 0) {
    await db.insert(assessmentConsiderations).values(
      considerations.map((consideration) => ({
        assessmentId,
        considerationId: idsByCode.get(consideration.code)!,
        severity: consideration.severity,
        side: consideration.side,
        notes: consideration.notes ?? null,
        inferred: Boolean(consideration.inferred),
        createdAt: record.createdAt,
      })),
    );
  }

  await db.insert(workoutPlans).values({
    ...record,
    assessmentId,
  });
}

async function loadActiveConsiderationIds(
  db: DbClient,
  considerations: ReadonlyArray<ReturnType<typeof resolveAssessmentConsiderations>[number]>,
): Promise<Map<string, string>> {
  if (considerations.length === 0) return new Map();
  const rows = await db
    .select({ id: bodyConsiderations.id, code: bodyConsiderations.code })
    .from(bodyConsiderations)
    .where(eq(bodyConsiderations.active, true));
  const idsByCode = new Map(rows.map((row) => [row.code, row.id]));
  const invalidCodes = considerations
    .map(({ code }) => code)
    .filter((code) => !idsByCode.has(code));
  if (invalidCodes.length > 0) {
    throw new WorkoutPlanGenerationError(
      'Assessment includes inactive or unknown consideration codes.',
      {
        reason: `Inactive or unknown consideration codes: ${invalidCodes.join(', ')}`,
        issues: invalidCodes,
      },
    );
  }
  return idsByCode;
}
