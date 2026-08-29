import { desc, eq } from 'drizzle-orm';
import { createExpressRouter } from './express-adapter';
import { workoutPlans } from '../db/schema';
import {
  getVerifiedExplorePlans,
  findExplorePlanById,
  type ExplorePlanDto,
  type WorkoutSplitType,
} from '../types/explore';
import { evaluatePlanPersonas } from '../services/persona-matching';
import { parseWorkoutPlanRecordOrError } from '../services/workout-generator';
import { inMemoryWorkoutPlans, inMemoryWorkoutPlanRatings } from './workout-plans';
import { getApiRouteContext, hasDbClient } from './context';
import { notFound } from '../shared/errors/api';
import type { MovementPattern } from '../types/workout';

function normalizeFilterString(value: string): string {
  return value.toLowerCase().replace(/[-_\s]/g, '');
}

function convertWorkoutPlanRecordToExploreDto(
  row: typeof workoutPlans.$inferSelect,
  aggregatedRatings?: { rating: number; reviewsCount: number },
): ExplorePlanDto | null {
  const parsed = parseWorkoutPlanRecordOrError(row);
  if (!parsed.ok || !parsed.dto.plan?.days?.length) return null;

  const planData = parsed.dto.plan;
  let rawPlan: Record<string, unknown>;
  try {
    rawPlan = typeof row.planJson === 'string' ? JSON.parse(row.planJson) : (row.planJson ?? {});
  } catch {
    rawPlan = {};
  }

  let aiMetadata: Record<string, unknown>;
  try {
    aiMetadata =
      typeof row.aiMetadataJson === 'string'
        ? JSON.parse(row.aiMetadataJson)
        : (row.aiMetadataJson ?? {});
  } catch {
    aiMetadata = {};
  }

  const personaEvaluation = evaluatePlanPersonas(rawPlan);
  const targetPersonas =
    Array.isArray(aiMetadata.personaTags) && aiMetadata.personaTags.length > 0
      ? (aiMetadata.personaTags as string[])
      : Array.isArray(rawPlan.personaTags) && rawPlan.personaTags.length > 0
        ? (rawPlan.personaTags as string[])
        : personaEvaluation.personas;

  const jointTags =
    Array.isArray(aiMetadata.jointTags) && aiMetadata.jointTags.length > 0
      ? (aiMetadata.jointTags as string[])
      : Array.isArray(rawPlan.jointTags) && rawPlan.jointTags.length > 0
        ? (rawPlan.jointTags as string[])
        : personaEvaluation.jointTags;

  const totalSets = planData.days.reduce(
    (sum, d) => sum + d.exercises.reduce((exSum, ex) => exSum + (ex.sets || 3), 0),
    0,
  );

  const rawSplit = typeof rawPlan.scheduleType === 'string' ? rawPlan.scheduleType : 'custom';
  const split: WorkoutSplitType =
    rawSplit === 'push_pull_legs' ||
    rawSplit === 'upper_lower' ||
    rawSplit === 'full_body' ||
    rawSplit === 'custom'
      ? rawSplit
      : rawSplit === 'ppl'
        ? 'push_pull_legs'
        : 'custom';

  const firstExercise = planData.days[0]?.exercises[0];
  const primaryExercise = firstExercise
    ? {
        name: firstExercise.name,
        masterExerciseId: firstExercise.masterExerciseId || firstExercise.id,
        movementPattern: firstExercise.movementPattern,
        muscleGroup: firstExercise.muscleGroup,
      }
    : undefined;

  const cloneCount = typeof aiMetadata.cloneCount === 'number' ? aiMetadata.cloneCount : 0;
  const rating =
    aggregatedRatings?.rating ??
    (typeof aiMetadata.rating === 'number' ? aiMetadata.rating : 5.0);
  const reviewsCount =
    aggregatedRatings?.reviewsCount ??
    (typeof aiMetadata.reviewsCount === 'number' ? aiMetadata.reviewsCount : 0);

  const forkedFrom =
    typeof aiMetadata.forkedFromPlanId === 'string' && aiMetadata.forkedFromPlanId
      ? {
          planId: aiMetadata.forkedFromPlanId,
          authorName:
            (typeof aiMetadata.forkedFromAuthor === 'string' && aiMetadata.forkedFromAuthor) ||
            'Original Author',
          planTitle:
            (typeof aiMetadata.forkedFromTitle === 'string' && aiMetadata.forkedFromTitle) ||
            undefined,
        }
      : undefined;

  return {
    id: row.id,
    title:
      typeof rawPlan.name === 'string' && rawPlan.name
        ? rawPlan.name
        : `Community Plan (${row.id.slice(0, 6)})`,
    description:
      typeof rawPlan.description === 'string' && rawPlan.description
        ? rawPlan.description
        : typeof rawPlan.summary === 'string' && rawPlan.summary
          ? rawPlan.summary
          : (typeof aiMetadata.targetAudience === 'string'
              ? aiMetadata.targetAudience
              : 'Community customized strength and hypertrophy routine.'),
    split,
    frequencyDays: planData.days.length,
    experienceLevel: 'intermediate',
    equipment: ['dumbbells', 'barbell', 'bench'],
    jointTags,
    targetPersonas,
    totalWeeklySets: totalSets,
    author: {
      name: typeof aiMetadata.authorName === 'string' ? aiMetadata.authorName : 'Community Athlete',
      role: typeof aiMetadata.authorRole === 'string' ? aiMetadata.authorRole : 'PhysioCoach Member',
      verified: false,
    },
    cloneCount,
    rating,
    reviewsCount,
    createdAt: row.createdAt,
    isVerified: false,
    primaryExercise,
    forkedFrom,
    summary: typeof rawPlan.summary === 'string' ? rawPlan.summary : undefined,
    safetyNotes: planData.safetyNotes,
    progression: planData.progression
      ? {
          baselineIntensity: planData.progression.baselineIntensity || 'low-moderate',
          progressionRule:
            planData.progression.progressionRule ||
            'Increase load or reps by +10% after 2 pain-free sessions.',
          increasePercent: planData.progression.increasePercent || 10,
          conditions: planData.progression.conditions || ['Two pain-free sessions'],
        }
      : undefined,
    days: planData.days.map((d) => ({
      dayNumber: d.dayNumber,
      name: d.name,
      focus: d.focus,
      exercises: d.exercises.map((ex) => ({
        id: ex.id,
        name: ex.name,
        movementPattern: ex.movementPattern as MovementPattern,
        muscleGroup: ex.muscleGroup,
        sets: ex.sets,
        reps: String(ex.reps),
        restSeconds: ex.restSeconds ?? 60,
        rpe: ex.rpe,
        notes: ex.notes,
        masterExerciseId: ex.masterExerciseId,
      })),
    })),
  };
}

function matchesSearch(plan: ExplorePlanDto, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;

  if (plan.title.toLowerCase().includes(q)) return true;
  if (plan.description.toLowerCase().includes(q)) return true;
  if (plan.split.toLowerCase().includes(q)) return true;
  if (plan.author.name.toLowerCase().includes(q)) return true;
  if (plan.targetPersonas.some((p) => p.toLowerCase().includes(q))) return true;
  if (plan.jointTags.some((t) => t.toLowerCase().includes(q))) return true;
  if (plan.equipment.some((e) => e.toLowerCase().includes(q))) return true;

  // Search within exercises
  for (const day of plan.days) {
    if (day.name.toLowerCase().includes(q) || day.focus.toLowerCase().includes(q)) return true;
    for (const ex of day.exercises) {
      if (
        ex.name.toLowerCase().includes(q) ||
        ex.muscleGroup.toLowerCase().includes(q) ||
        ex.movementPattern.toLowerCase().includes(q)
      ) {
        return true;
      }
    }
  }

  return false;
}

export function createExploreRoutes() {
  const route = createExpressRouter();

  route.get('/explore/plans', async (c) => {
    try {
      const url = new URL(c.req.url, 'http://localhost');
      const splitParam = url.searchParams.get('split')?.trim();
      const equipmentParam = url.searchParams.get('equipment')?.trim();
      const injuryFilterParam = url.searchParams.get('injuryFilter')?.trim();
      const experienceLevelParam = url.searchParams.get('experienceLevel')?.trim();
      const searchParam = url.searchParams.get('search')?.trim();

      // Start with curated clinical verified templates
      let plans = getVerifiedExplorePlans();

      // If database is available, load published/active user plans
      const routeContext = getApiRouteContext(c);
      if (hasDbClient(routeContext)) {
        try {
          const dbRows = await routeContext.db
            .select()
            .from(workoutPlans)
            .orderBy(desc(workoutPlans.createdAt))
            .limit(20);

          for (const row of dbRows) {
            let aiMetadata: Record<string, unknown> = {};
            try {
              aiMetadata =
                typeof row.aiMetadataJson === 'string'
                  ? JSON.parse(row.aiMetadataJson)
                  : (row.aiMetadataJson ?? {});
            } catch {
              aiMetadata = {};
            }

            // Include if status is active or explicitly published
            if (row.status === 'active' || aiMetadata.isPublished === true) {
              const customExplorePlan = convertWorkoutPlanRecordToExploreDto(row);
              if (customExplorePlan && !plans.some((p) => p.id === customExplorePlan.id)) {
                plans.push(customExplorePlan);
              }
            }
          }
        } catch (dbError) {
          console.warn('explore.db_fetch_fallback', dbError);
        }
      }

      // Include published plans from inMemoryWorkoutPlans
      for (const row of inMemoryWorkoutPlans.values()) {
        let aiMetadata: Record<string, unknown> = {};
        try {
          aiMetadata =
            typeof row.aiMetadataJson === 'string'
              ? JSON.parse(row.aiMetadataJson)
              : (row.aiMetadataJson ?? {});
        } catch {
          aiMetadata = {};
        }

        if (row.status === 'active' || aiMetadata.isPublished === true) {
          const customExplorePlan = convertWorkoutPlanRecordToExploreDto(row);
          if (customExplorePlan && !plans.some((p) => p.id === customExplorePlan.id)) {
            plans.push(customExplorePlan);
          }
        }
      }

      // Overlay live ratings if any exist
      for (const p of plans) {
        const memRatings = Array.from(inMemoryWorkoutPlanRatings.values()).filter(
          (r) => r.workoutPlanId === p.id,
        );
        if (memRatings.length > 0) {
          const sum = memRatings.reduce((acc, r) => acc + r.rating, 0);
          p.reviewsCount = memRatings.length;
          p.rating = Number((sum / memRatings.length).toFixed(1));
        }
      }

      // Filter by Split
      if (splitParam && splitParam.toLowerCase() !== 'all') {
        const normalizedSplit = normalizeFilterString(splitParam);
        plans = plans.filter((p) => normalizeFilterString(p.split) === normalizedSplit);
      }

      // Filter by Equipment
      if (equipmentParam && equipmentParam.toLowerCase() !== 'all') {
        const normalizedEq = normalizeFilterString(equipmentParam);
        plans = plans.filter((p) =>
          p.equipment.some((eqItem) => {
            const norm = normalizeFilterString(eqItem);
            return norm.includes(normalizedEq) || normalizedEq.includes(norm);
          }),
        );
      }

      // Filter by Injury / Joint safety
      if (injuryFilterParam && injuryFilterParam.toLowerCase() !== 'all') {
        const normalizedInjury = normalizeFilterString(injuryFilterParam);
        plans = plans.filter((p) => {
          const jointMatch = p.jointTags.some((tag) =>
            normalizeFilterString(tag).includes(normalizedInjury),
          );
          const personaMatch = p.targetPersonas.some((persona) =>
            normalizeFilterString(persona).includes(normalizedInjury),
          );
          return jointMatch || personaMatch;
        });
      }

      // Filter by Experience Level
      if (experienceLevelParam && experienceLevelParam.toLowerCase() !== 'all') {
        const normalizedExp = experienceLevelParam.toLowerCase();
        plans = plans.filter((p) => p.experienceLevel.toLowerCase() === normalizedExp);
      }

      // Search Query Filter
      if (searchParam) {
        plans = plans.filter((p) => matchesSearch(p, searchParam));
      }

      return c.json({
        data: plans,
        total: plans.length,
      });
    } catch (error) {
      console.error('explore.plans.error', error);
      return c.json(
        {
          data: getVerifiedExplorePlans(),
          total: getVerifiedExplorePlans().length,
        },
        200,
      );
    }
  });

  route.get('/explore/plans/:id', async (c) => {
    try {
      const planId = c.req.param('id');
      const template = findExplorePlanById(planId);
      if (template) {
        const memRatings = Array.from(inMemoryWorkoutPlanRatings.values()).filter(
          (r) => r.workoutPlanId === planId,
        );
        if (memRatings.length > 0) {
          const sum = memRatings.reduce((acc, r) => acc + r.rating, 0);
          return c.json({
            data: {
              ...template,
              rating: Number((sum / memRatings.length).toFixed(1)),
              reviewsCount: memRatings.length,
            },
          });
        }
        return c.json({ data: template });
      }

      // Check DB for custom plan
      const routeContext = getApiRouteContext(c);
      if (hasDbClient(routeContext)) {
        const rows = await routeContext.db
          .select()
          .from(workoutPlans)
          .where(eq(workoutPlans.id, planId))
          .limit(1);

        if (rows[0]) {
          const exploreDto = convertWorkoutPlanRecordToExploreDto(rows[0]);
          if (exploreDto) {
            return c.json({ data: exploreDto });
          }
          const parsed = parseWorkoutPlanRecordOrError(rows[0]);
          if (parsed.ok) {
            return c.json({ data: parsed.dto });
          }
        }
      }

      // Check inMemoryWorkoutPlans
      const inMem = inMemoryWorkoutPlans.get(planId);
      if (inMem) {
        const exploreDto = convertWorkoutPlanRecordToExploreDto(inMem);
        if (exploreDto) {
          return c.json({ data: exploreDto });
        }
      }

      return notFound(c, 'Workout plan not found.');
    } catch {
      return notFound(c, 'Workout plan not found.');
    }
  });

  return route;
}

export const exploreRouter = createExploreRoutes();
