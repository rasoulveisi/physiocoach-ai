import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createExpressRouter } from './express-adapter';
import { createDb } from '../db/client';
import {
  assessmentConsiderations,
  assessments,
  aiAuditLogs,
  bodyConsiderations,
  workoutPlanRatings,
  workoutPlans,
} from '../db/schema';
import { createApiError, internalServerError, notFound, unauthorized } from '../shared/errors/api';
import { runPlanAudit } from '../services/plan-audit';
import { evaluatePlanPersonas } from '../services/persona-matching';
import { findExplorePlanById } from '../types/explore';
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

export const inMemoryWorkoutPlans = new Map<string, WorkoutPlanRecord>();

export interface InMemoryRatingRecord {
  id: string;
  workoutPlanId: string;
  userId: string;
  rating: number;
  review?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const inMemoryWorkoutPlanRatings = new Map<string, InMemoryRatingRecord>();

export const ratePlanSchema = z.object({
  rating: z.number().min(1).max(5),
  review: z.string().max(1000).optional(),
});


export const customPlanSetSchema = z.object({
  setNumber: z.number().int().min(1),
  setType: z.enum(['NORMAL', 'WARMUP', 'DROP', 'FAILURE']),
  targetReps: z.union([z.string().min(1), z.number()]),
  targetRir: z.number().min(0).max(4),
  tempo: z.string().min(1),
  restSeconds: z.number().min(0),
});

export const customPlanExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  exerciseName: z.string().min(1),
  movementPattern: z.string().min(1),
  muscleGroups: z.array(z.string()),
  sets: z.array(customPlanSetSchema).min(1),
});

export const customPlanDaySchema = z.object({
  dayName: z.string().min(1),
  exercises: z.array(customPlanExerciseSchema).min(1),
});

export const customPlanPayloadSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().optional(),
  split: z.enum(['ppl', 'upper_lower', 'full_body', 'custom']),
  frequencyDays: z.number().int().min(1).max(7),
  days: z.array(customPlanDaySchema).min(1),
});

export type CustomPlanPayload = z.infer<typeof customPlanPayloadSchema>;

function normalizeCustomMovementPattern(
  pattern: string,
): 'squat' | 'hinge' | 'push' | 'pull' | 'lunge' | 'carry' | 'core' | 'mobility' {
  const p = (pattern || '').toLowerCase().trim();
  if (['squat', 'hinge', 'push', 'pull', 'lunge', 'carry', 'core', 'mobility'].includes(p)) {
    return p as 'squat' | 'hinge' | 'push' | 'pull' | 'lunge' | 'carry' | 'core' | 'mobility';
  }
  if (p.includes('squat') || p.includes('quad') || p.includes('leg press')) return 'squat';
  if (
    p.includes('hinge') ||
    p.includes('deadlift') ||
    p.includes('glute') ||
    p.includes('hamstring')
  )
    return 'hinge';
  if (
    p.includes('push') ||
    p.includes('chest') ||
    p.includes('tricep') ||
    p.includes('shoulder') ||
    p.includes('press')
  )
    return 'push';
  if (
    p.includes('pull') ||
    p.includes('back') ||
    p.includes('lat') ||
    p.includes('bicep') ||
    p.includes('row')
  )
    return 'pull';
  if (p.includes('lunge') || p.includes('split') || p.includes('step')) return 'lunge';
  if (p.includes('carry') || p.includes('walk') || p.includes('farmer')) return 'carry';
  if (p.includes('core') || p.includes('abs') || p.includes('abdominals') || p.includes('oblique'))
    return 'core';
  return 'mobility';
}

export function createWorkoutPlanRoutes() {
  const route = createExpressRouter();

  route.post('/workout-plans/custom', async (c) => {
    try {
      const body = await c.req.json().catch(() => undefined);
      if (!body || typeof body !== 'object') {
        return createApiError(
          c,
          'invalid_request',
          'Custom plan creation requires a valid JSON body.',
          {
            details: {
              issues: [{ path: '', message: 'Expected a JSON object.' }],
            },
          },
        );
      }

      const parseResult = customPlanPayloadSchema.safeParse(body);
      if (!parseResult.success) {
        return createApiError(c, 'invalid_request', 'Custom plan validation failed.', {
          details: {
            issues: parseResult.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        });
      }

      const validated = parseResult.data;
      const { user, db } = getApiRouteContext(c);
      const planId = crypto.randomUUID();
      const assessmentId = crypto.randomUUID();
      const now = new Date().toISOString();

      const fullPlanObject = {
        schemaVersion: '1.0',
        source: 'fallback',
        name: validated.title,
        description: validated.description || '',
        scheduleType: validated.split,
        summary: validated.description || `${validated.title} custom workout routine`,
        isCustom: true,
        days: validated.days.map((d, dIdx) => ({
          dayNumber: dIdx + 1,
          name: d.dayName,
          focus: d.dayName,
          exercises: d.exercises.map((ex, exIdx) => {
            const totalSets = ex.sets.length;
            const firstSet = ex.sets[0];
            const repsString = String(firstSet?.targetReps ?? '8-10');
            const restSecs = firstSet?.restSeconds ?? 90;
            const rpe =
              firstSet?.targetRir !== undefined
                ? Math.max(1, Math.min(10, 10 - firstSet.targetRir))
                : 8;
            const notes = ex.sets
              .map(
                (s) =>
                  `Set ${s.setNumber} [${s.setType}]: ${s.targetReps} reps @ RIR ${s.targetRir}, tempo ${s.tempo}, rest ${s.restSeconds}s`,
              )
              .join(' | ');

            return {
              id: `custom_ex_${dIdx + 1}_${exIdx + 1}_${ex.exerciseId}`,
              name: ex.exerciseName,
              masterExerciseId: ex.exerciseId,
              muscleGroup: ex.muscleGroups[0] || 'general',
              movementPattern: normalizeCustomMovementPattern(ex.movementPattern),
              sets: totalSets,
              reps: repsString,
              rpe,
              restSeconds: restSecs,
              notes,
              customSets: ex.sets,
            };
          }),
        })),
        progression: {
          baselineIntensity: 'low-moderate',
          progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
          increasePercent: 10,
          conditions: ['Two pain-free sessions'],
        },
        safetyNotes: [],
        warnings: [
          'Educational fitness recommendations only. Not medical advice.',
          'Stop immediately if pain increases during an exercise.',
          'Do not continue if dizziness, lightheadedness, or chest pressure appears.',
        ],
      };

      const record: WorkoutPlanRecord = {
        id: planId,
        userId: user.id,
        assessmentId,
        status: 'active',
        planJson: JSON.stringify(fullPlanObject),
        safetyWarningsJson: JSON.stringify([]),
        aiMetadataJson: JSON.stringify({
          source: 'fallback',
          model: 'custom-plan-builder',
          isCustom: true,
          generation: { fallbackUsed: false },
          providerMetadata: {
            isCustom: true,
            title: validated.title,
            split: validated.split,
          },
        }),
        version: 1,
        inputHash: `custom-${planId}`,
        createdAt: now,
      };

      if (db) {
        // Archive prior active plans
        await db
          .update(workoutPlans)
          .set({ status: 'archived' })
          .where(and(eq(workoutPlans.userId, user.id), eq(workoutPlans.status, 'active')));

        // Insert assessment row
        await db.insert(assessments).values({
          id: assessmentId,
          userId: user.id,
          goalsJson: JSON.stringify(['strength', 'hypertrophy']),
          frequencyDays: validated.frequencyDays,
          equipmentJson: JSON.stringify([
            'barbell',
            'dumbbells',
            'cables',
            'machines',
            'bodyweight',
          ]),
          limitationsJson: JSON.stringify([]),
          postureFlagsJson: JSON.stringify([]),
          completedAt: now,
          inputHash: `custom-assessment-${planId}`,
        });

        await db.insert(workoutPlans).values(record);
      }

      inMemoryWorkoutPlans.set(planId, record);

      const parsed = parseWorkoutPlanRecordOrError(record);
      if (!parsed.ok) {
        return createApiError(c, 'invalid_workout_plan_record', parsed.error.message, {
          status: 409,
          details: parsed.error.issues,
        });
      }

      return c.json(
        {
          success: true,
          planId,
          data: {
            success: true,
            planId,
            ...parsed.dto,
          },
        },
        201,
      );
    } catch (error) {
      console.error('workout_plan.custom.error', error);
      if (
        error instanceof Error &&
        error.message === 'Missing or invalid authenticated user context.'
      ) {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to create custom workout plan.');
    }
  });

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
      let row: (typeof workoutPlans.$inferSelect) | WorkoutPlanRecord | undefined = undefined;

      if (db) {
        const rows = await db
          .select()
          .from(workoutPlans)
          .where(and(eq(workoutPlans.userId, user.id), eq(workoutPlans.status, 'active')))
          .orderBy(desc(workoutPlans.createdAt))
          .limit(1);

        row = rows[0];
      }

      if (!row) {
        // Check inMemoryWorkoutPlans
        for (const r of inMemoryWorkoutPlans.values()) {
          if (r.userId === user.id && r.status === 'active') {
            row = r;
            break;
          }
        }
      }

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

  route.get('/workout-plans/my-plans', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      const userPlans: Array<{
        id: string;
        title: string;
        description: string;
        split: string;
        frequencyDays: number;
        status: string;
        isPublished: boolean;
        totalSets: number;
        createdAt: string;
        dayCount: number;
        exerciseCount: number;
        primaryExercise?: {
          name: string;
          masterExerciseId?: string | undefined;
          movementPattern?: string | undefined;
          muscleGroup?: string | undefined;
        } | undefined;
      }> = [];
      const seenIds = new Set<string>();

      if (db) {
        const rows = await db
          .select()
          .from(workoutPlans)
          .where(eq(workoutPlans.userId, user.id))
          .orderBy(desc(workoutPlans.createdAt));

        for (const row of rows) {
          const parsed = parseWorkoutPlanRecordOrError(row);
          if (!parsed.ok || !parsed.dto.plan?.days) continue;

          let rawPlan: Record<string, unknown> = {};
          try {
            rawPlan = typeof row.planJson === 'string' ? JSON.parse(row.planJson) : (row.planJson ?? {});
          } catch {
            rawPlan = {};
          }

          let aiMetadata: Record<string, unknown> = {};
          try {
            aiMetadata = typeof row.aiMetadataJson === 'string' ? JSON.parse(row.aiMetadataJson) : (row.aiMetadataJson ?? {});
          } catch {
            aiMetadata = {};
          }

          const planData = parsed.dto.plan;
          const totalSets = planData.days.reduce(
            (sum, d) => sum + d.exercises.reduce((exSum, ex) => exSum + (ex.sets || 3), 0),
            0,
          );
          const totalExercises = planData.days.reduce((sum, d) => sum + d.exercises.length, 0);
          const firstEx = planData.days[0]?.exercises[0];

          userPlans.push({
            id: row.id,
            title:
              typeof rawPlan.name === 'string' && rawPlan.name
                ? rawPlan.name
                : `Workout Plan (${row.id.slice(0, 6)})`,
            description:
              typeof rawPlan.description === 'string' && rawPlan.description
                ? rawPlan.description
                : (typeof rawPlan.summary === 'string' ? rawPlan.summary : 'Custom personalized training plan.'),
            split: typeof rawPlan.scheduleType === 'string' ? rawPlan.scheduleType : 'custom',
            frequencyDays: planData.days.length,
            status: row.status,
            isPublished: Boolean(aiMetadata.isPublished || rawPlan.isPublished),
            totalSets,
            createdAt: row.createdAt,
            dayCount: planData.days.length,
            exerciseCount: totalExercises,
            primaryExercise: firstEx
              ? {
                  name: firstEx.name,
                  masterExerciseId: firstEx.masterExerciseId || firstEx.id,
                  movementPattern: firstEx.movementPattern,
                  muscleGroup: firstEx.muscleGroup,
                }
              : undefined,
          });
          seenIds.add(row.id);
        }
      }

      // Check inMemoryWorkoutPlans for user
      for (const [id, row] of inMemoryWorkoutPlans.entries()) {
        if (row.userId === user.id && !seenIds.has(id)) {
          const parsed = parseWorkoutPlanRecordOrError(row);
          if (!parsed.ok || !parsed.dto.plan?.days) continue;

          let rawPlan: Record<string, unknown> = {};
          try {
            rawPlan = typeof row.planJson === 'string' ? JSON.parse(row.planJson) : (row.planJson ?? {});
          } catch {
            rawPlan = {};
          }

          let aiMetadata: Record<string, unknown> = {};
          try {
            aiMetadata = typeof row.aiMetadataJson === 'string' ? JSON.parse(row.aiMetadataJson) : (row.aiMetadataJson ?? {});
          } catch {
            aiMetadata = {};
          }

          const planData = parsed.dto.plan;
          const totalSets = planData.days.reduce(
            (sum, d) => sum + d.exercises.reduce((exSum, ex) => exSum + (ex.sets || 3), 0),
            0,
          );
          const totalExercises = planData.days.reduce((sum, d) => sum + d.exercises.length, 0);
          const firstEx = planData.days[0]?.exercises[0];

          userPlans.push({
            id: row.id,
            title:
              typeof rawPlan.name === 'string' && rawPlan.name
                ? rawPlan.name
                : `Workout Plan (${row.id.slice(0, 6)})`,
            description:
              typeof rawPlan.description === 'string' && rawPlan.description
                ? rawPlan.description
                : (typeof rawPlan.summary === 'string' ? rawPlan.summary : 'Custom personalized training plan.'),
            split: typeof rawPlan.scheduleType === 'string' ? rawPlan.scheduleType : 'custom',
            frequencyDays: planData.days.length,
            status: row.status,
            isPublished: Boolean(aiMetadata.isPublished || rawPlan.isPublished),
            totalSets,
            createdAt: row.createdAt,
            dayCount: planData.days.length,
            exerciseCount: totalExercises,
            primaryExercise: firstEx
              ? {
                  name: firstEx.name,
                  masterExerciseId: firstEx.masterExerciseId || firstEx.id,
                  movementPattern: firstEx.movementPattern,
                  muscleGroup: firstEx.muscleGroup,
                }
              : undefined,
          });
        }
      }

      return c.json({ data: userPlans, total: userPlans.length });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Missing or invalid authenticated user context.'
      ) {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to load user plans.');
    }
  });

  route.post('/workout-plans/:planId/activate', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      const planId = c.req.param('planId');

      let targetRecord: (typeof workoutPlans.$inferSelect) | WorkoutPlanRecord | null = null;

      if (db) {
        // Archive all active plans for this user
        await db
          .update(workoutPlans)
          .set({ status: 'archived' })
          .where(and(eq(workoutPlans.userId, user.id), eq(workoutPlans.status, 'active')));

        // Set target plan to active
        const rows = await db
          .update(workoutPlans)
          .set({ status: 'active' })
          .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, user.id)))
          .returning();

        if (rows[0]) {
          targetRecord = rows[0];
        }
      }

      if (!targetRecord && inMemoryWorkoutPlans.has(planId)) {
        // Archive in memory
        for (const [id, r] of inMemoryWorkoutPlans.entries()) {
          if (r.userId === user.id) {
            inMemoryWorkoutPlans.set(id, { ...r, status: id === planId ? 'active' : 'archived' });
          }
        }
        targetRecord = inMemoryWorkoutPlans.get(planId) ?? null;
      }

      if (!targetRecord) {
        return notFound(c, 'Workout plan not found.');
      }

      const parsed = parseWorkoutPlanRecordOrError(targetRecord);
      if (!parsed.ok) {
        return createApiError(c, 'invalid_workout_plan_record', parsed.error.message, {
          status: 409,
          details: parsed.error.issues,
        });
      }

      return c.json({
        success: true,
        activePlanId: planId,
        data: parsed.dto,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Missing or invalid authenticated user context.'
      ) {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to activate workout plan.');
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
      const planId = c.req.param('planId');

      if (db) {
        const rows = await db
          .select()
          .from(workoutPlans)
          .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, user.id)))
          .limit(1);

        const targetPlan = rows[0];
        if (targetPlan) {
          await db
            .update(workoutPlans)
            .set({ status: 'archived' })
            .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, user.id)));

          if (inMemoryWorkoutPlans.has(planId)) {
            inMemoryWorkoutPlans.delete(planId);
          }
          return c.json({ success: true, data: { id: planId, deleted: true } });
        }
      }

      if (inMemoryWorkoutPlans.has(planId)) {
        const memPlan = inMemoryWorkoutPlans.get(planId)!;
        if (memPlan.userId === user.id) {
          inMemoryWorkoutPlans.delete(planId);
          return c.json({ success: true, data: { id: planId, deleted: true } });
        }
      }

      return notFound(c, 'Workout plan not found.');
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

  // ─── PUT /workout-plans/:id (Update in-place / sync shared plan) ─────────
  route.put('/workout-plans/:id', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      const planId = c.req.param('id');
      const body = await c.req.json().catch(() => undefined);
      if (!body || typeof body !== 'object') {
        return createApiError(c, 'invalid_request', 'Updating a plan requires a valid JSON body.');
      }

      let existingRecord: (typeof workoutPlans.$inferSelect) | WorkoutPlanRecord | null = null;
      if (db) {
        const rows = await db
          .select()
          .from(workoutPlans)
          .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, user.id)))
          .limit(1);
        existingRecord = rows[0] ?? null;
      }
      if (!existingRecord) {
        existingRecord = inMemoryWorkoutPlans.get(planId) ?? null;
      }

      if (!existingRecord) {
        return notFound(c, 'Workout plan not found.');
      }

      let aiMetadata: Record<string, unknown> = {};
      try {
        aiMetadata =
          typeof existingRecord.aiMetadataJson === 'string'
            ? JSON.parse(existingRecord.aiMetadataJson)
            : (existingRecord.aiMetadataJson ?? {});
      } catch {
        aiMetadata = {};
      }

      let fullPlanObject: Record<string, unknown>;
      const customParse = customPlanPayloadSchema.safeParse(body);
      if (customParse.success) {
        const validated = customParse.data;
        fullPlanObject = {
          schemaVersion: '1.0',
          source: 'custom',
          name: validated.title,
          description: validated.description || '',
          scheduleType: validated.split,
          summary: validated.description || `${validated.title} custom workout routine`,
          isCustom: true,
          isPublished: Boolean(aiMetadata.isPublished),
          days: validated.days.map((d, dIdx) => ({
            dayNumber: dIdx + 1,
            name: d.dayName,
            focus: d.dayName,
            exercises: d.exercises.map((ex, exIdx) => {
              const totalSets = ex.sets.length;
              const firstSet = ex.sets[0];
              const repsString = String(firstSet?.targetReps ?? '8-10');
              const restSecs = firstSet?.restSeconds ?? 90;
              const rpe =
                firstSet?.targetRir !== undefined
                  ? Math.max(1, Math.min(10, 10 - firstSet.targetRir))
                  : 8;
              const notes = ex.sets
                .map(
                  (s) =>
                    `Set ${s.setNumber} [${s.setType}]: ${s.targetReps} reps @ RIR ${s.targetRir}, tempo ${s.tempo}, rest ${s.restSeconds}s`,
                )
                .join(' | ');

              return {
                id: `custom_ex_${dIdx + 1}_${exIdx + 1}_${ex.exerciseId}`,
                name: ex.exerciseName,
                masterExerciseId: ex.exerciseId,
                muscleGroup: ex.muscleGroups[0] || 'general',
                movementPattern: normalizeCustomMovementPattern(ex.movementPattern),
                sets: totalSets,
                reps: repsString,
                rpe,
                restSeconds: restSecs,
                notes,
                customSets: ex.sets,
              };
            }),
          })),
          progression: {
            baselineIntensity: 'low-moderate',
            progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
            increasePercent: 10,
            conditions: ['Two pain-free sessions'],
          },
          safetyNotes: [],
          warnings: [
            'Educational fitness recommendations only. Not medical advice.',
            'Stop immediately if pain increases during an exercise.',
            'Do not continue if dizziness, lightheadedness, or chest pressure appears.',
          ],
        };
      } else if (body.plan && typeof body.plan === 'object') {
        fullPlanObject = body.plan as Record<string, unknown>;
      } else {
        fullPlanObject = body as Record<string, unknown>;
      }

      if (aiMetadata.isPublished) {
        const { personas, targetAudience, jointTags } = evaluatePlanPersonas(fullPlanObject);
        aiMetadata.personaTags = personas;
        aiMetadata.targetAudience = targetAudience;
        aiMetadata.jointTags = jointTags;
        fullPlanObject.personaTags = personas;
        fullPlanObject.targetAudience = targetAudience;
        fullPlanObject.jointTags = jointTags;
      }

      const updatedRecord: WorkoutPlanRecord = {
        id: planId,
        userId: user.id,
        assessmentId: existingRecord.assessmentId,
        status:
          existingRecord.status === 'draft' || existingRecord.status === 'archived'
            ? existingRecord.status
            : 'active',
        planJson: JSON.stringify(fullPlanObject),
        safetyWarningsJson: existingRecord.safetyWarningsJson,
        aiMetadataJson: JSON.stringify(aiMetadata),
        version: existingRecord.version + 1,
        inputHash: existingRecord.inputHash,
        createdAt: existingRecord.createdAt,
      };

      if (db) {
        await db
          .update(workoutPlans)
          .set({
            planJson: updatedRecord.planJson,
            aiMetadataJson: updatedRecord.aiMetadataJson,
            version: updatedRecord.version,
          })
          .where(and(eq(workoutPlans.id, planId), eq(workoutPlans.userId, user.id)));
      }

      inMemoryWorkoutPlans.set(planId, updatedRecord);

      const parsed = parseWorkoutPlanRecordOrError(updatedRecord);
      if (!parsed.ok) {
        return createApiError(c, 'invalid_workout_plan_record', parsed.error.message, {
          status: 409,
          details: parsed.error.issues,
        });
      }

      return c.json({
        success: true,
        data: parsed.dto,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Missing or invalid authenticated user context.'
      ) {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to update workout plan.');
    }
  });

  // ─── POST /workout-plans/:id/rate (Live Interactive Ratings & Reviews) ───
  route.post('/workout-plans/:id/rate', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      const planId = c.req.param('id');
      const body = await c.req.json().catch(() => undefined);

      if (!body || typeof body !== 'object') {
        return createApiError(
          c,
          'invalid_request',
          'Rating requires a JSON object with rating (1-5).',
        );
      }

      const parseResult = ratePlanSchema.safeParse(body);
      if (!parseResult.success) {
        return createApiError(c, 'invalid_request', 'Invalid rating payload.', {
          details: {
            issues: parseResult.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        });
      }

      const { rating, review } = parseResult.data;
      const roundedRating = Math.max(1, Math.min(5, Math.round(rating)));
      const now = new Date().toISOString();

      let averageRating = roundedRating;
      let reviewsCount = 1;

      let dbSucceeded = false;
      if (db) {
        try {
          // Upsert user rating in workout_plan_ratings
          const existing = await db
            .select()
            .from(workoutPlanRatings)
            .where(
              and(
                eq(workoutPlanRatings.workoutPlanId, planId),
                eq(workoutPlanRatings.userId, user.id),
              ),
            )
            .limit(1);

          if (existing[0]) {
            await db
              .update(workoutPlanRatings)
              .set({
                rating: roundedRating,
                review: review ?? null,
                updatedAt: now,
              })
              .where(eq(workoutPlanRatings.id, existing[0].id));
          } else {
            await db.insert(workoutPlanRatings).values({
              id: crypto.randomUUID(),
              workoutPlanId: planId,
              userId: user.id,
              rating: roundedRating,
              review: review ?? null,
              createdAt: now,
              updatedAt: now,
            });
          }

          // Dynamically compute aggregated average rating and reviews count
          const allRatings = await db
            .select()
            .from(workoutPlanRatings)
            .where(eq(workoutPlanRatings.workoutPlanId, planId));

          reviewsCount = allRatings.length;
          const sum = allRatings.reduce((acc, r) => acc + r.rating, 0);
          averageRating = Number((sum / (reviewsCount || 1)).toFixed(1));

          // Update plan aiMetadataJson if it exists in DB
          const planRows = await db
            .select()
            .from(workoutPlans)
            .where(eq(workoutPlans.id, planId))
            .limit(1);

          if (planRows[0]) {
            let aiMetadata: Record<string, unknown> = {};
            try {
              aiMetadata =
                typeof planRows[0].aiMetadataJson === 'string'
                  ? JSON.parse(planRows[0].aiMetadataJson)
                  : (planRows[0].aiMetadataJson ?? {});
            } catch {
              aiMetadata = {};
            }
            aiMetadata.rating = averageRating;
            aiMetadata.reviewsCount = reviewsCount;

            await db
              .update(workoutPlans)
              .set({ aiMetadataJson: JSON.stringify(aiMetadata) })
              .where(eq(workoutPlans.id, planId));
          }
          dbSucceeded = true;
        } catch (dbErr) {
          console.warn('workout_plans.rate.db_fallback', dbErr);
        }
      }

      // Record in in-memory ratings storage
      const ratingKey = `${planId}:${user.id}`;
      inMemoryWorkoutPlanRatings.set(ratingKey, {
        id: ratingKey,
        workoutPlanId: planId,
        userId: user.id,
        rating: roundedRating,
        review: review ?? null,
        createdAt: now,
        updatedAt: now,
      });

      if (!dbSucceeded) {
        const memRatings = Array.from(inMemoryWorkoutPlanRatings.values()).filter(
          (r) => r.workoutPlanId === planId,
        );
        reviewsCount = memRatings.length;
        const sum = memRatings.reduce((acc, r) => acc + r.rating, 0);
        averageRating = Number((sum / (reviewsCount || 1)).toFixed(1));

        const memPlan = inMemoryWorkoutPlans.get(planId);
        if (memPlan) {
          let aiMetadata: Record<string, unknown> = {};
          try {
            aiMetadata =
              typeof memPlan.aiMetadataJson === 'string'
                ? JSON.parse(memPlan.aiMetadataJson)
                : (memPlan.aiMetadataJson ?? {});
          } catch {
            aiMetadata = {};
          }
          aiMetadata.rating = averageRating;
          aiMetadata.reviewsCount = reviewsCount;
          inMemoryWorkoutPlans.set(planId, {
            ...memPlan,
            aiMetadataJson: JSON.stringify(aiMetadata),
          });
        }
      }

      return c.json({
        success: true,
        data: {
          planId,
          rating: averageRating,
          reviewsCount,
          userRating: roundedRating,
          userReview: review,
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Missing or invalid authenticated user context.'
      ) {
        return unauthorized(c, error.message);
      }
      console.error('workout_plans.rate.error', error);
      return internalServerError(c, 'Failed to save workout plan rating.');
    }
  });

  // ─── GET /workout-plans/:id/ratings (Fetch ratings for a plan) ──────────
  route.get('/workout-plans/:id/ratings', async (c) => {
    try {
      const { db } = getApiRouteContext(c);
      const planId = c.req.param('id');

      if (db) {
        try {
          const ratingsRows = await db
            .select()
            .from(workoutPlanRatings)
            .where(eq(workoutPlanRatings.workoutPlanId, planId));

          const reviewsCount = ratingsRows.length;
          const sum = ratingsRows.reduce((acc, r) => acc + r.rating, 0);
          const averageRating = reviewsCount > 0 ? Number((sum / reviewsCount).toFixed(1)) : 5.0;

          return c.json({
            success: true,
            data: {
              planId,
              averageRating,
              reviewsCount,
              ratings: ratingsRows,
            },
          });
        } catch (dbErr) {
          console.warn('workout_plans.get_ratings.db_fallback', dbErr);
        }
      }

      const memRatings = Array.from(inMemoryWorkoutPlanRatings.values()).filter(
        (r) => r.workoutPlanId === planId,
      );
      const reviewsCount = memRatings.length;
      const sum = memRatings.reduce((acc, r) => acc + r.rating, 0);
      const averageRating = reviewsCount > 0 ? Number((sum / reviewsCount).toFixed(1)) : 5.0;

      return c.json({
        success: true,
        data: {
          planId,
          averageRating,
          reviewsCount,
          ratings: memRatings,
        },
      });
    } catch (error) {
      console.error('workout_plans.get_ratings.error', error);
      return internalServerError(c, 'Failed to fetch plan ratings.');
    }
  });

  route.post('/workout-plans/:planId/clone', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      const planId = c.req.param('planId');
      const now = new Date().toISOString();

      // Check if planId matches a verified explore template
      const template = findExplorePlanById(planId);
      if (template) {
        const clonedId = crypto.randomUUID();
        const assessmentId = crypto.randomUUID();

        const fullPlanObject = {
          schemaVersion: '1.0',
          source: 'fallback',
          name: template.title,
          description: template.description,
          scheduleType: template.split,
          summary: template.summary || template.description,
          days: template.days.map((d) => ({
            dayNumber: d.dayNumber,
            name: d.name,
            focus: d.focus,
            exercises: d.exercises.map((ex) => ({
              id: ex.id,
              name: ex.name,
              movementPattern: ex.movementPattern,
              muscleGroup: ex.muscleGroup,
              sets: ex.sets,
              reps: ex.reps,
              restSeconds: ex.restSeconds ?? 60,
              rpe: ex.rpe,
              notes: ex.notes,
              masterExerciseId: ex.masterExerciseId,
            })),
          })),
          progression: template.progression ?? {
            baselineIntensity: 'low-moderate',
            progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
            increasePercent: 10,
            conditions: ['Two pain-free sessions'],
          },
          safetyNotes: template.safetyNotes ?? [],
          warnings: [
            'Educational fitness recommendations only. Not medical advice.',
            'Stop immediately if pain increases during an exercise.',
            'Do not continue if dizziness, lightheadedness, or chest pressure appears.',
          ],
        };

        const record: WorkoutPlanRecord = {
          id: clonedId,
          userId: user.id,
          assessmentId,
          status: 'active',
          planJson: JSON.stringify(fullPlanObject),
          safetyWarningsJson: JSON.stringify(template.safetyNotes ?? []),
          aiMetadataJson: JSON.stringify({
            source: 'fallback',
            model: 'physiocoach-clinical-curated-v1',
            generation: { fallbackUsed: false },
            providerMetadata: {
              clonedFromTemplateId: template.id,
              author: template.author.name,
            },
            forkedFromPlanId: template.id,
            forkedFromAuthor: template.author.name,
            forkedFromTitle: template.title,
          }),
          version: 1,
          inputHash: `cloned-${template.id}`,
          createdAt: now,
        };

        if (db) {
          // Archive prior active plans
          await db
            .update(workoutPlans)
            .set({ status: 'archived' })
            .where(and(eq(workoutPlans.userId, user.id), eq(workoutPlans.status, 'active')));

          // Create dummy assessment record if none exists for foreign key
          await db.insert(assessments).values({
            id: assessmentId,
            userId: user.id,
            goalsJson: JSON.stringify(['strength', 'hypertrophy']),
            frequencyDays: template.frequencyDays,
            equipmentJson: JSON.stringify(template.equipment),
            limitationsJson: JSON.stringify([]),
            postureFlagsJson: JSON.stringify([]),
            completedAt: now,
            inputHash: `cloned-assessment-${template.id}`,
          });

          await db.insert(workoutPlans).values(record);
        }

        inMemoryWorkoutPlans.set(clonedId, record);

        const parsed = parseWorkoutPlanRecordOrError(record);
        if (!parsed.ok) {
          return createApiError(c, 'invalid_workout_plan_record', parsed.error.message, {
            status: 409,
            details: parsed.error.issues,
          });
        }

        return c.json({ data: parsed.dto }, 201);
      }

      // If not a template, check if it's an existing plan in DB
      if (db) {
        const rows = await db
          .select()
          .from(workoutPlans)
          .where(eq(workoutPlans.id, planId))
          .limit(1);

        const targetPlan = rows[0];
        if (!targetPlan) {
          return notFound(c, 'Workout plan not found.');
        }

        let targetAiMetadata: Record<string, unknown> = {};
        try {
          targetAiMetadata =
            typeof targetPlan.aiMetadataJson === 'string'
              ? JSON.parse(targetPlan.aiMetadataJson)
              : (targetPlan.aiMetadataJson ?? {});
        } catch {
          targetAiMetadata = {};
        }

        let targetPlanObj: Record<string, unknown> = {};
        try {
          targetPlanObj =
            typeof targetPlan.planJson === 'string'
              ? JSON.parse(targetPlan.planJson)
              : (targetPlan.planJson ?? {});
        } catch {
          targetPlanObj = {};
        }

        const sourceAuthor =
          (typeof targetAiMetadata.authorName === 'string' && targetAiMetadata.authorName) ||
          (typeof targetAiMetadata.author === 'string' && targetAiMetadata.author) ||
          'Community Athlete';

        const sourceTitle =
          (typeof targetPlanObj.name === 'string' && targetPlanObj.name) ||
          (typeof targetPlanObj.title === 'string' && targetPlanObj.title) ||
          `Routine (${targetPlan.id.slice(0, 6)})`;

        const clonedId = crypto.randomUUID();
        const assessmentId = crypto.randomUUID();

        // Archive current active plan for user
        await db
          .update(workoutPlans)
          .set({ status: 'archived' })
          .where(and(eq(workoutPlans.userId, user.id), eq(workoutPlans.status, 'active')));

        // Clone assessment if exists
        const origAssessments = await db
          .select()
          .from(assessments)
          .where(eq(assessments.id, targetPlan.assessmentId))
          .limit(1);

        if (origAssessments[0]) {
          await db.insert(assessments).values({
            ...origAssessments[0],
            id: assessmentId,
            userId: user.id,
            completedAt: now,
          });
        } else {
          await db.insert(assessments).values({
            id: assessmentId,
            userId: user.id,
            goalsJson: JSON.stringify(['strength']),
            frequencyDays: 3,
            equipmentJson: JSON.stringify(['home_gym']),
            limitationsJson: JSON.stringify([]),
            postureFlagsJson: JSON.stringify([]),
            completedAt: now,
            inputHash: `cloned-assessment-${planId}`,
          });
        }

        const clonedMetadata = {
          ...targetAiMetadata,
          isPublished: false,
          forkedFromPlanId: targetPlan.id,
          forkedFromAuthor: sourceAuthor,
          forkedFromTitle: sourceTitle,
        };

        const clonedRecord: WorkoutPlanRecord = {
          id: clonedId,
          userId: user.id,
          assessmentId,
          status: 'active',
          planJson: targetPlan.planJson,
          safetyWarningsJson: targetPlan.safetyWarningsJson,
          aiMetadataJson: JSON.stringify(clonedMetadata),
          version: 1,
          inputHash: `cloned-${planId}`,
          createdAt: now,
        };

        await db.insert(workoutPlans).values(clonedRecord);
        inMemoryWorkoutPlans.set(clonedId, clonedRecord);

        const parsed = parseWorkoutPlanRecordOrError(clonedRecord);
        if (!parsed.ok) {
          return createApiError(c, 'invalid_workout_plan_record', parsed.error.message, {
            status: 409,
            details: parsed.error.issues,
          });
        }

        return c.json({ data: parsed.dto }, 201);
      }

      if (inMemoryWorkoutPlans.has(planId)) {
        const targetPlan = inMemoryWorkoutPlans.get(planId)!;
        let targetAiMetadata: Record<string, unknown> = {};
        try {
          targetAiMetadata =
            typeof targetPlan.aiMetadataJson === 'string'
              ? JSON.parse(targetPlan.aiMetadataJson)
              : (targetPlan.aiMetadataJson ?? {});
        } catch {
          targetAiMetadata = {};
        }

        let targetPlanObj: Record<string, unknown> = {};
        try {
          targetPlanObj =
            typeof targetPlan.planJson === 'string'
              ? JSON.parse(targetPlan.planJson)
              : (targetPlan.planJson ?? {});
        } catch {
          targetPlanObj = {};
        }

        const sourceAuthor =
          (typeof targetAiMetadata.authorName === 'string' && targetAiMetadata.authorName) ||
          (typeof targetAiMetadata.author === 'string' && targetAiMetadata.author) ||
          'Community Athlete';

        const sourceTitle =
          (typeof targetPlanObj.name === 'string' && targetPlanObj.name) ||
          (typeof targetPlanObj.title === 'string' && targetPlanObj.title) ||
          `Routine (${targetPlan.id.slice(0, 6)})`;

        const clonedId = crypto.randomUUID();
        const assessmentId = crypto.randomUUID();
        const clonedMetadata = {
          ...targetAiMetadata,
          isPublished: false,
          forkedFromPlanId: targetPlan.id,
          forkedFromAuthor: sourceAuthor,
          forkedFromTitle: sourceTitle,
        };

        const clonedRecord: WorkoutPlanRecord = {
          id: clonedId,
          userId: user.id,
          assessmentId,
          status: 'active',
          planJson: targetPlan.planJson,
          safetyWarningsJson: targetPlan.safetyWarningsJson,
          aiMetadataJson: JSON.stringify(clonedMetadata),
          version: 1,
          inputHash: `cloned-${planId}`,
          createdAt: now,
        };
        inMemoryWorkoutPlans.set(clonedId, clonedRecord);
        const parsed = parseWorkoutPlanRecordOrError(clonedRecord);
        if (!parsed.ok) {
          return createApiError(c, 'invalid_workout_plan_record', parsed.error.message, {
            status: 409,
            details: parsed.error.issues,
          });
        }
        return c.json({ data: parsed.dto }, 201);
      }

      return notFound(c, 'Workout plan not found.');
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Missing or invalid authenticated user context.'
      ) {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to clone workout plan.');
    }
  });

  // ─── POST /workout-plans/:id/publish ────────────────────────────────────
  // Evaluates movement patterns and muscle groups to generate intelligent Persona Matches
  // Updates workout_plans status/metadata with isPublished, publishedAt, personaTags, targetAudience
  // Returns { success: true, publishedPlanId, personas, targetAudience, exploreUrl }

  route.post('/workout-plans/:id/publish', async (c) => {
    try {
      const planId = c.req.param('id');
      const { user, db } = getApiRouteContext(c);
      const now = new Date().toISOString();

      let targetPlan: (typeof workoutPlans.$inferSelect) | null = null;

      if (db) {
        const rows = await db
          .select()
          .from(workoutPlans)
          .where(eq(workoutPlans.id, planId))
          .limit(1);

        if (rows[0]) {
          targetPlan = rows[0];
        }
      }

      if (!targetPlan) {
        targetPlan = inMemoryWorkoutPlans.get(planId) ?? null;
      }

      if (!targetPlan) {
        return notFound(c, 'Workout plan not found.');
      }

      let parsedPlan: Record<string, unknown> = {};
      try {
        parsedPlan =
          typeof targetPlan.planJson === 'string'
            ? JSON.parse(targetPlan.planJson)
            : (targetPlan.planJson ?? {});
      } catch {
        parsedPlan = {};
      }

      let parsedAiMetadata: Record<string, unknown> = {};
      try {
        parsedAiMetadata =
          typeof targetPlan.aiMetadataJson === 'string'
            ? JSON.parse(targetPlan.aiMetadataJson)
            : (targetPlan.aiMetadataJson ?? {});
      } catch {
        parsedAiMetadata = {};
      }

      const { personas, targetAudience, jointTags } = evaluatePlanPersonas(parsedPlan);
      const authorName = user.displayName || user.email?.split('@')[0] || 'Community Athlete';

      const updatedMetadata = {
        ...parsedAiMetadata,
        isPublished: true,
        publishedAt: now,
        authorName,
        personaTags: personas,
        targetAudience,
        jointTags,
      };

      const updatedPlan = {
        ...parsedPlan,
        isPublished: true,
        publishedAt: now,
        authorName,
        personaTags: personas,
        targetAudience,
        jointTags,
      };

      if (db) {
        await db
          .update(workoutPlans)
          .set({
            aiMetadataJson: JSON.stringify(updatedMetadata),
            planJson: JSON.stringify(updatedPlan),
          })
          .where(eq(workoutPlans.id, planId));
      }

      inMemoryWorkoutPlans.set(planId, {
        ...targetPlan,
        status: (targetPlan.status === 'draft' || targetPlan.status === 'archived' ? targetPlan.status : 'active'),
        aiMetadataJson: JSON.stringify(updatedMetadata),
        planJson: JSON.stringify(updatedPlan),
      });

      return c.json({
        success: true,
        publishedPlanId: planId,
        personas,
        targetAudience,
        exploreUrl: `/explore?plan=${planId}`,
      });
    } catch (error) {
      console.error('workout_plan.publish.error', error);
      if (
        error instanceof Error &&
        error.message === 'Missing or invalid authenticated user context.'
      ) {
        return unauthorized(c, error.message);
      }
      return internalServerError(c, 'Failed to publish workout plan.');
    }
  });

  // ─── POST /workout-plans/audit ──────────────────────────────────────────
  // Deterministic clinical safety audit. No AI/OpenRouter calls.
  // Returns structured check results, badge, and score.

  const auditBodySchema = z.object({
    planJson: z.record(z.string(), z.unknown()),
  });

  route.post('/workout-plans/audit', async (c) => {
    const startMs = Date.now();
    const body = await c.req.json().catch(() => undefined);

    if (!body || typeof body !== 'object') {
      return createApiError(c, 'invalid_request', 'Audit requires a valid JSON body with planJson.', {
        status: 409,
        details: { traceId: crypto.randomUUID() },
      });
    }

    const parseResult = auditBodySchema.safeParse(body);
    if (!parseResult.success) {
      const traceId = crypto.randomUUID();
      return createApiError(c, 'invalid_request', 'Malformed audit payload.', {
        status: 409,
        details: {
          traceId,
          issues: parseResult.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
      });
    }

    const { planJson } = parseResult.data;
    const auditLogId = crypto.randomUUID();
    const traceId = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      const result = runPlanAudit(planJson as Record<string, unknown>, auditLogId, traceId);
      const latencyMs = Date.now() - startMs;

      // Persist audit log to ai_audit_logs
      const { db, user } = getApiRouteContext(c);
      if (db) {
        try {
          await db.insert(aiAuditLogs).values({
            id: auditLogId,
            traceId,
            userId: user?.id ?? null,
            task: 'plan_audit',
            provider: 'deterministic',
            model: 'physiocoach-clinical-safety-rules-v1',
            prompt: JSON.stringify({ planJson }),
            completion: JSON.stringify({
              certified: result.certified,
              score: result.score,
              badge: result.badge,
            }),
            status: result.checks.some((c) => c.severity === 'critical' || c.severity === 'warning')
              ? 'warning'
              : 'success',
            errorMessage: null,
            schemaIssuesJson: null,
            inputHash: null,
            promptTokens: null,
            completionTokens: null,
            totalTokens: null,
            latencyMs,
            createdAt: now,
          });
        } catch (dbErr) {
          console.warn('workout_plans.audit.db_log_failed', {
            auditLogId,
            reason: dbErr instanceof Error ? dbErr.message : String(dbErr),
          });
        }
      }

      return c.json(result, 200);
    } catch (error) {
      console.error('workout_plans.audit.error', error);
      return createApiError(c, 'internal_server_error', 'Safety audit failed.', {
        details: { traceId, auditLogId },
      });
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
