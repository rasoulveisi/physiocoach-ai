import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { WorkerBindings } from '../env';
import { createDb } from '../db/client';
import {
  assessmentConsiderations,
  assessments,
  bodyConsiderations,
  profiles,
  users,
  workoutPlans,
} from '../db/schema';
import { createApiError, internalServerError, unauthorized } from '../shared/errors/api';
import type { AuthenticatedUser } from '../types/auth';
import {
  buildPlanInputHash,
  buildWorkoutPlanContext,
  buildWorkoutPlanModelConfig,
  buildWorkoutPlanRecord,
  createWorkoutPlanProvider,
  generatePlanInputSchema,
  generateWorkoutPlanWithSafety,
  parseWorkoutPlanRecordOrError,
  type GeneratePlanInput,
  type WorkoutPlanRecord,
  WorkoutPlanGenerationError,
} from '../services/workout-generator';
import type { ProfileInput } from '../types/profile';
import {
  legacySafetyContextFromConsiderations,
  resolveAssessmentConsiderations,
} from '../types/assessment';
import { withTransactionFallback } from './transactions';
import { getApiRouteContext, hasDbClient } from './context';

type DbClient = ReturnType<typeof createDb>;

type ProfileRow = typeof profiles.$inferSelect;

export function createWorkoutPlanRoutes() {
  const route = new Hono<{ Bindings: WorkerBindings }>();

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

      const parsed = generatePlanInputSchema.safeParse(generatePayload);
      if (!parsed.success) {
        const validationIssues = parsed.error.issues.map((issue: z.ZodIssue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));

        return createApiError(c, 'invalid_request', 'Request payload failed validation.', {
          details: {
            issues: validationIssues,
          },
        });
      }

      const routeContext = getApiRouteContext(c);
      const { user, env, db } = routeContext;
      const now = new Date().toISOString();
      const profileRow = hasDbClient(routeContext)
        ? await getLatestProfileForUser(routeContext.db, user.id)
        : null;
      const resolvedProfile = mapProfileRecordToInput(profileRow) ?? parsed.data.profile;
      if (!resolvedProfile) {
        return createApiError(
          c,
          'profile_not_found',
          'No active profile snapshot is available. Save onboarding profile first.',
          { status: 409 },
        );
      }

      const generationInput: GeneratePlanInput = {
        ...parsed.data,
        assessment: hasExplicitConsiderations(generatePayload.assessment)
          ? parsed.data.assessment
          : { ...parsed.data.assessment, considerations: undefined },
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
          { forceFresh: true, provisionalNoRuleCautions: env.APP_ENV === 'dev' },
          db,
        );
      } catch (error) {
        if (error instanceof WorkoutPlanGenerationError) {
          return createApiError(c, 'workout_plan_generation_failed', error.message, {
            status: 409,
            details: error.details,
          });
        }

        return createApiError(
          c,
          'workout_plan_generation_failed',
          'Workout plan generation failed.',
          {
            status: 409,
            details: {
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
      if (error instanceof Error && error.message === 'Missing or invalid authenticated user context.') {
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
      if (error instanceof Error && error.message === 'Missing or invalid authenticated user context.') {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to load current workout plan.');
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
      if (error instanceof Error && error.message === 'Missing or invalid authenticated user context.') {
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
      if (error instanceof Error && error.message === 'Missing or invalid authenticated user context.') {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to delete current workout plan.');
    }
  });

  return route;
}

function hasExplicitConsiderations(input: unknown): boolean {
  return typeof input === 'object' && input !== null && Object.hasOwn(input, 'considerations');
}

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
        inferred: consideration.inferred ? 1 : 0,
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
    .where(eq(bodyConsiderations.active, 1));
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

function mapProfileRecordToInput(profile: ProfileRow | null): ProfileInput | null {
  if (!profile) {
    return null;
  }

  return {
    age: profile.age,
    sex: profile.sex as ProfileInput['sex'],
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    ...(profile.bodyFatEstimate === null ? {} : { bodyFatEstimate: profile.bodyFatEstimate }),
    lifestyle: profile.lifestyle as ProfileInput['lifestyle'],
    experienceLevel: profile.experienceLevel as ProfileInput['experienceLevel'],
  };
}

async function getLatestProfileForUser(db: DbClient, userId: string): Promise<ProfileRow | null> {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .orderBy(desc(profiles.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

async function upsertUserAndProfile(
  db: DbClient,
  user: AuthenticatedUser,
  profile: ProfileInput | null,
  now: string,
): Promise<void> {
  const profileId = `profile_${crypto.randomUUID()}`;
  if (!profile) {
    return;
  }

  await withTransactionFallback(
    db,
    async (tx) => {
      const client = tx as DbClient;
      await upsertUserForContext(client, user, now);
      await client.insert(profiles).values({
        id: profileId,
        userId: user.id,
        age: profile.age,
        sex: profile.sex,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        bodyFatEstimate: profile.bodyFatEstimate ?? null,
        lifestyle: profile.lifestyle,
        experienceLevel: profile.experienceLevel,
        createdAt: now,
        updatedAt: now,
      });
    },
    'profile-upsert',
  );
}

async function upsertUserForContext(
  db: DbClient,
  user: AuthenticatedUser,
  now: string,
): Promise<void> {
  const safeDisplayName = user.displayName ?? null;

  await db
    .insert(users)
    .values({
      id: user.id,
      email: user.email,
      displayName: safeDisplayName,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: user.email,
        displayName: safeDisplayName,
        updatedAt: now,
      },
    });
}
