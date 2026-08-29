import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import {
  assessments,
  exerciseLogs,
  masterExercises,
  workoutPlans,
  workoutSessions,
} from '../db/schema';
import { createExpressRouter } from './express-adapter';
import { getApiRouteContext } from './context';
import { handleRouteError, invalidRequest } from '../shared/errors/api';
import { SET_TYPE_VALUES } from './workout-sessions';

const importSetSchema = z.object({
  setIndex: z.number().int().min(1).default(1),
  setType: z.enum(SET_TYPE_VALUES).default('working'),
  weightKg: z.number().min(0).default(0),
  reps: z.number().int().min(0).default(0),
  rpe: z.number().min(1).max(10).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const importExerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.array(importSetSchema).min(1),
});

const importWorkoutSchema = z.object({
  title: z.string().min(1),
  date: z.string().min(1),
  notes: z.string().max(2000).optional().nullable(),
  exercises: z.array(importExerciseSchema).min(1),
});

const importConfirmSchema = z.object({
  mappings: z.record(z.string(), z.string().nullable().optional()),
  workouts: z.array(importWorkoutSchema).min(1),
  saveTemplatesAsPlans: z.boolean().default(true),
  importHistoricalLogs: z.boolean().default(true),
});

export function createImportRoutes() {
  const route = createExpressRouter();

  route.post('/import/confirm-mapping', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);

      const body = await c.req.json().catch(() => undefined);
      const parsed = importConfirmSchema.safeParse(body);
      if (!parsed.success) {
        return invalidRequest(c, 'Invalid import payload.', {
          issues: parsed.error.issues,
        });
      }

      const { mappings, workouts, saveTemplatesAsPlans, importHistoricalLogs } = parsed.data;
      const totalSets = workouts.reduce(
        (sum, w) => sum + w.exercises.reduce((sSum, ex) => sSum + ex.sets.length, 0),
        0,
      );

      if (!db) {
        return c.json({
          data: {
            success: true,
            importedWorkoutsCount: workouts.length,
            importedSetsCount: totalSets,
            importedPlansCount: saveTemplatesAsPlans ? workouts.length : 0,
          },
        });
      }

      // Collect mapped master exercise IDs
      const mappedIds = Object.values(mappings).filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      );

      const masterRecords =
        mappedIds.length > 0
          ? await db
              .select({
                id: masterExercises.id,
                canonicalId: masterExercises.canonicalId,
                name: masterExercises.name,
                movementPattern: masterExercises.movementPattern,
                primaryMuscle: masterExercises.primaryMuscle,
              })
              .from(masterExercises)
              .where(inArray(masterExercises.id, mappedIds))
          : [];

      const masterById = new Map<string, (typeof masterRecords)[0]>();
      for (const m of masterRecords) {
        masterById.set(m.id, m);
      }

      let importedPlansCount = 0;
      let importedSessionsCount = 0;
      let importedLogsCount = 0;

      await db.transaction(async (tx) => {
        const now = new Date().toISOString();

        // 1. Ensure user has a valid assessment record to link plans
        const existingAssessments = await tx
          .select({ id: assessments.id })
          .from(assessments)
          .where(eq(assessments.userId, user.id))
          .limit(1);

        const assessmentId: string =
          existingAssessments[0]?.id ?? `ass_${crypto.randomUUID()}`;
        if (!existingAssessments[0]?.id) {
          await tx.insert(assessments).values({
            id: assessmentId,
            userId: user.id,
            goalsJson: JSON.stringify(['strength', 'muscle_hypertrophy']),
            frequencyDays: 3,
            equipmentJson: JSON.stringify(['barbell', 'dumbbell']),
            limitationsJson: JSON.stringify([]),
            postureFlagsJson: JSON.stringify({}),
            completedAt: now,
            inputHash: `import_${user.id}_${now}`,
          });
        }

        // 2. Save unique routines as workout_plans
        const planIdByTitle = new Map<string, string>();

        if (saveTemplatesAsPlans) {
          const distinctTitles = Array.from(new Set(workouts.map((w) => w.title.trim())));

          for (const title of distinctTitles) {
            const representativeWorkout = workouts.find((w) => w.title.trim() === title)!;
            const planId = `plan_imp_${crypto.randomUUID()}`;
            planIdByTitle.set(title, planId);

            const dayExercises = representativeWorkout.exercises.map((ex, exIdx) => {
              const masterId = mappings[ex.name] ?? null;
              const master = masterId ? masterById.get(masterId) : null;

              return {
                id: `ex_${exIdx + 1}`,
                name: master?.name || ex.name,
                masterExerciseId: master?.id,
                muscleGroup: master?.primaryMuscle || 'full_body',
                movementPattern: master?.movementPattern || 'mobility',
                sets: ex.sets.length,
                reps: `${ex.sets[0]?.reps || 10}`,
                restSeconds: 90,
              };
            });

            const planJson = {
              schemaVersion: '1.0',
              source: 'imported',
              days: [
                {
                  dayNumber: 1,
                  name: title,
                  focus: title,
                  exercises: dayExercises,
                },
              ],
              progression: {
                baselineIntensity: 'low-moderate',
                progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
                increasePercent: 10,
                conditions: ['Two pain-free sessions'],
              },
              safetyNotes: ['Imported routine from workout log.'],
              warnings: ['Educational fitness recommendations only. Not medical advice.'],
            };

            await tx.insert(workoutPlans).values({
              id: planId,
              userId: user.id,
              assessmentId,
              status: 'active',
              planJson: JSON.stringify(planJson),
              safetyWarningsJson: JSON.stringify([]),
              aiMetadataJson: JSON.stringify({ source: 'importer' }),
              version: 1,
              inputHash: `import_${title}_${now}`,
              createdAt: now,
            });

            importedPlansCount++;
          }
        }

        // Fallback default container plan for historical sessions if none created
        let defaultPlanId: string = planIdByTitle.values().next().value || '';
        if (!defaultPlanId) {
          defaultPlanId = `plan_imp_hist_${crypto.randomUUID()}`;
          await tx.insert(workoutPlans).values({
            id: defaultPlanId,
            userId: user.id,
            assessmentId,
            status: 'archived',
            planJson: JSON.stringify({
              schemaVersion: '1.0',
              source: 'imported_history',
              days: [{ dayNumber: 1, name: 'Imported History', focus: 'General', exercises: [] }],
              progression: {
                baselineIntensity: 'low-moderate',
                progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
                increasePercent: 10,
                conditions: [],
              },
              safetyNotes: [],
              warnings: ['Educational fitness recommendations only. Not medical advice.'],
            }),
            safetyWarningsJson: JSON.stringify([]),
            aiMetadataJson: JSON.stringify({ source: 'importer' }),
            version: 1,
            inputHash: `import_history_${user.id}_${now}`,
            createdAt: now,
          });
        }

        // 3. Save completed sessions and exercise logs
        if (importHistoricalLogs) {
          for (const workout of workouts) {
            const sessionId = `ws_imp_${crypto.randomUUID()}`;
            const targetPlanId: string =
              planIdByTitle.get(workout.title.trim()) ?? defaultPlanId;
            const scheduledDate = workout.date.slice(0, 10);

            await tx.insert(workoutSessions).values({
              id: sessionId,
              userId: user.id,
              workoutPlanId: targetPlanId,
              dayIndex: 0,
              status: 'completed',
              scheduledDate,
              startedAt: workout.date,
              completedAt: workout.date,
              notes: workout.notes || null,
            });
            importedSessionsCount++;

            for (const ex of workout.exercises) {
              const masterId = mappings[ex.name] ?? null;
              const master = masterId ? masterById.get(masterId) : null;

              for (const set of ex.sets) {
                await tx.insert(exerciseLogs).values({
                  id: `log_imp_${crypto.randomUUID()}`,
                  userId: user.id,
                  workoutSessionId: sessionId,
                  exerciseName: master?.name || ex.name,
                  masterExerciseId: master?.id || null,
                  movementPattern: master?.movementPattern || 'mobility',
                  muscleGroupsJson: JSON.stringify([master?.primaryMuscle || 'full_body']),
                  setIndex: set.setIndex,
                  targetReps: `${set.reps}`,
                  reps: set.reps,
                  weight: set.weightKg,
                  rpe: set.rpe || null,
                  completed: true,
                  notes: set.notes || null,
                  exerciseType: set.setType,
                });
                importedLogsCount++;
              }
            }
          }
        }
      });

      return c.json({
        data: {
          success: true,
          importedWorkoutsCount: importedSessionsCount,
          importedPlansCount: importedPlansCount,
          importedSetsCount: importedLogsCount,
        },
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to import workouts.');
    }
  });

  return route;
}

export const importRouter = createImportRoutes();
