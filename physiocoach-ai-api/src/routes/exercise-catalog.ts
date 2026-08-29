import { and, eq, inArray, like, not, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  bodyConsiderations,
  exerciseConsiderationRatings,
  exerciseEquipment,
  exerciseMedia,
  masterEquipment,
  masterExercises,
} from '../db/schema';
import { createExpressRouter } from './express-adapter';
import { getApiRouteContext } from './context';
import { handleRouteError, notFound } from '../shared/errors/api';

const PUBLIC_MEDIA_OWNERSHIP_STATUSES = ['owned', 'commissioned', 'generated_approved', 'licensed'];

const exerciseCatalogMediaBatchSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(240).optional(),
        exerciseId: z.string().trim().max(120).optional(),
        name: z.string().trim().max(240).optional(),
        movementPattern: z.string().trim().max(80).optional(),
        muscleGroup: z.string().trim().max(120).optional(),
      }),
    )
    .max(60),
});

export function createExerciseCatalogRoutes() {
  const route = createExpressRouter();

  // 1. GET /exercise-catalog/filters
  route.get('/exercise-catalog/filters', async (c) => {
    try {
      const { db } = getApiRouteContext(c);
      if (!db) {
        return c.json({
          data: {
            bodyParts: [
              { id: 'chest', name: 'Chest', count: 0 },
              { id: 'back', name: 'Back', count: 0 },
              { id: 'upper legs', name: 'Upper Legs', count: 0 },
              { id: 'lower legs', name: 'Lower Legs', count: 0 },
              { id: 'shoulders', name: 'Shoulders', count: 0 },
              { id: 'upper arms', name: 'Arms', count: 0 },
              { id: 'waist', name: 'Core & Waist', count: 0 },
            ],
            muscles: [
              { id: 'quadriceps', name: 'Quadriceps', bodyRegion: 'anterior', count: 0 },
              { id: 'hamstrings', name: 'Hamstrings', bodyRegion: 'posterior', count: 0 },
              { id: 'glutes', name: 'Glutes', bodyRegion: 'posterior', count: 0 },
              { id: 'pectorals', name: 'Pectorals', bodyRegion: 'anterior', count: 0 },
              { id: 'lats', name: 'Latissimus Dorsi', bodyRegion: 'posterior', count: 0 },
              { id: 'delts', name: 'Deltoids', bodyRegion: 'anterior', count: 0 },
              { id: 'biceps', name: 'Biceps', bodyRegion: 'anterior', count: 0 },
              { id: 'triceps', name: 'Triceps', bodyRegion: 'posterior', count: 0 },
              { id: 'abs', name: 'Abdominals', bodyRegion: 'anterior', count: 0 },
              { id: 'calves', name: 'Calves', bodyRegion: 'posterior', count: 0 },
            ],
            movementPatterns: [
              { id: 'squat', name: 'Squat', count: 0 },
              { id: 'hinge', name: 'Hinge / Deadlift', count: 0 },
              { id: 'horizontal_push', name: 'Horizontal Push', count: 0 },
              { id: 'horizontal_pull', name: 'Horizontal Pull', count: 0 },
              { id: 'vertical_push', name: 'Vertical Push', count: 0 },
              { id: 'vertical_pull', name: 'Vertical Pull', count: 0 },
              { id: 'lunge', name: 'Lunge', count: 0 },
              { id: 'carry', name: 'Carry', count: 0 },
              { id: 'isolation', name: 'Isolation', count: 0 },
            ],
            equipment: [
              { id: 'barbell', name: 'Barbell', count: 0 },
              { id: 'dumbbell', name: 'Dumbbell', count: 0 },
              { id: 'cable', name: 'Cable', count: 0 },
              { id: 'machine', name: 'Machine', count: 0 },
              { id: 'bodyweight', name: 'Bodyweight', count: 0 },
              { id: 'band', name: 'Resistance Band', count: 0 },
              { id: 'kettlebell', name: 'Kettlebell', count: 0 },
            ],
            safetyTags: [
              { id: 'low_spine_load', name: 'Low Spine Load', count: 0 },
              { id: 'knee_friendly', name: 'Knee-Friendly', count: 0 },
              { id: 'shoulder_friendly', name: 'Shoulder-Friendly', count: 0 },
              { id: 'neck_safe', name: 'Neck-Safe', count: 0 },
              { id: 'wrist_neutral', name: 'Wrist-Neutral', count: 0 },
            ],
          },
        });
      }

      const bodyPartRows = await db
        .select({
          id: masterExercises.bodyPart,
          count: sql<number>`count(*)::int`,
        })
        .from(masterExercises)
        .where(sql`${masterExercises.bodyPart} is not null and ${masterExercises.bodyPart} != ''`)
        .groupBy(masterExercises.bodyPart);

      const muscleRows = await db
        .select({
          id: masterExercises.primaryMuscle,
          count: sql<number>`count(*)::int`,
        })
        .from(masterExercises)
        .where(sql`${masterExercises.primaryMuscle} is not null and ${masterExercises.primaryMuscle} != ''`)
        .groupBy(masterExercises.primaryMuscle);

      const patternRows = await db
        .select({
          id: masterExercises.movementPattern,
          count: sql<number>`count(*)::int`,
        })
        .from(masterExercises)
        .where(sql`${masterExercises.movementPattern} is not null and ${masterExercises.movementPattern} != ''`)
        .groupBy(masterExercises.movementPattern);

      const equipmentRows = await db
        .select({
          id: masterEquipment.canonicalId,
          name: masterEquipment.name,
          count: sql<number>`count(${exerciseEquipment.exerciseId})::int`,
        })
        .from(masterEquipment)
        .leftJoin(exerciseEquipment, eq(exerciseEquipment.equipmentId, masterEquipment.id))
        .groupBy(masterEquipment.canonicalId, masterEquipment.name);

      const formatLabel = (str: string) =>
        str
          .split(/[-_ ]+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');

      const posteriorMuscles = new Set([
        'hamstrings',
        'glutes',
        'lats',
        'traps',
        'triceps',
        'calves',
        'lower_back',
      ]);

      const muscles = muscleRows.map((r) => {
        const id = (r.id || '').toLowerCase();
        return {
          id: r.id || '',
          name: formatLabel(r.id || ''),
          bodyRegion: posteriorMuscles.has(id) ? 'posterior' : 'anterior',
          count: Number(r.count) || 0,
        };
      });

      const bodyParts = bodyPartRows.map((r) => ({
        id: r.id || '',
        name: formatLabel(r.id || ''),
        count: Number(r.count) || 0,
      }));

      const movementPatterns = patternRows.map((r) => ({
        id: r.id || '',
        name: formatLabel(r.id || ''),
        count: Number(r.count) || 0,
      }));

      const equipment = equipmentRows.length > 0
        ? equipmentRows.map((r) => ({
            id: r.id.replace(/^eq_/, ''),
            name: r.name,
            count: Number(r.count) || 0,
          }))
        : [
            { id: 'barbell', name: 'Barbell', count: 0 },
            { id: 'dumbbell', name: 'Dumbbell', count: 0 },
            { id: 'cable', name: 'Cable', count: 0 },
            { id: 'machine', name: 'Machine', count: 0 },
            { id: 'bodyweight', name: 'Bodyweight', count: 0 },
            { id: 'band', name: 'Resistance Band', count: 0 },
            { id: 'kettlebell', name: 'Kettlebell', count: 0 },
          ];

      const safetyTags = [
        { id: 'low_spine_load', name: 'Low Spine Load', count: 0 },
        { id: 'knee_friendly', name: 'Knee-Friendly', count: 0 },
        { id: 'shoulder_friendly', name: 'Shoulder-Friendly', count: 0 },
        { id: 'neck_safe', name: 'Neck-Safe', count: 0 },
        { id: 'wrist_neutral', name: 'Wrist-Neutral', count: 0 },
      ];

      return c.json({
        data: {
          bodyParts,
          muscles,
          movementPatterns,
          equipment,
          safetyTags,
        },
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to list catalog filters.');
    }
  });

  // 2. GET /exercise-catalog/exercises
  route.get('/exercise-catalog/exercises', async (c) => {
    try {
      const { db } = getApiRouteContext(c);
      const limitStr = c.req.query('limit');
      const offsetStr = c.req.query('offset');
      const limit = limitStr ? Math.min(100, Math.max(1, Number(limitStr))) : 24;
      const offset = offsetStr ? Math.max(0, Number(offsetStr)) : 0;

      if (!db) {
        return c.json({
          data: [],
          pagination: { total: 0, hasMore: false, limit, offset },
        });
      }

      const q = c.req.query('q')?.trim().toLowerCase();
      const bodyPart = (c.req.query('bodyPart') || c.req.query('category'))?.trim();
      const primaryMuscle = (c.req.query('primaryMuscle') || c.req.query('muscle'))?.trim();
      const movementPattern = (c.req.query('movementPattern') || c.req.query('pattern'))?.trim();
      const equipmentParam = c.req.query('equipment')?.trim();
      const safetyTagsParam = c.req.query('safetyTags')?.trim();
      const level = c.req.query('level')?.trim();

      const conditions = [];

      if (q) {
        conditions.push(
          or(
            like(sql`lower(${masterExercises.name})`, `%${q}%`),
            like(sql`lower(${masterExercises.movementPattern})`, `%${q}%`),
            like(sql`lower(coalesce(${masterExercises.primaryMuscle}, ''))`, `%${q}%`),
            like(sql`lower(coalesce(${masterExercises.bodyPart}, ''))`, `%${q}%`),
            like(sql`lower(coalesce(${masterExercises.target}, ''))`, `%${q}%`),
          ),
        );
      }

      if (bodyPart && bodyPart !== 'all') {
        conditions.push(
          or(
            eq(sql`lower(${masterExercises.bodyPart})`, bodyPart.toLowerCase()),
            like(sql`lower(${masterExercises.bodyPart})`, `%${bodyPart.toLowerCase()}%`),
          ),
        );
      }

      if (primaryMuscle && primaryMuscle !== 'all') {
        conditions.push(
          or(
            eq(sql`lower(${masterExercises.primaryMuscle})`, primaryMuscle.toLowerCase()),
            like(sql`lower(coalesce(${masterExercises.primaryMuscle}, ''))`, `%${primaryMuscle.toLowerCase()}%`),
            like(sql`lower(coalesce(${masterExercises.target}, ''))`, `%${primaryMuscle.toLowerCase()}%`),
            like(sql`lower(coalesce(${masterExercises.secondaryMusclesJson}, ''))`, `%${primaryMuscle.toLowerCase()}%`),
          ),
        );
      }

      if (movementPattern && movementPattern !== 'all') {
        conditions.push(
          or(
            eq(sql`lower(${masterExercises.movementPattern})`, movementPattern.toLowerCase()),
            like(sql`lower(${masterExercises.movementPattern})`, `%${movementPattern.toLowerCase()}%`),
          ),
        );
      }

      if (level && level !== 'all') {
        conditions.push(eq(sql`lower(coalesce(${masterExercises.recommendedLevel}, 'beginner'))`, level.toLowerCase()));
      }

      if (equipmentParam && equipmentParam !== 'all') {
        const eqList = equipmentParam.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
        if (eqList.length > 0) {
          const eqConditions = eqList.map((eqItem) =>
            or(
              like(sql`lower(coalesce(${masterExercises.attributesJson}, ''))`, `%"${eqItem}"%`),
              like(sql`lower(coalesce(${masterExercises.instructions}, ''))`, `%${eqItem}%`),
              like(sql`lower(${masterExercises.name})`, `%${eqItem}%`),
            ),
          );
          conditions.push(or(...eqConditions));
        }
      }

      if (safetyTagsParam && safetyTagsParam !== 'all') {
        const tags = safetyTagsParam.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
        for (const tag of tags) {
          if (tag === 'low_spine_load') {
            conditions.push(
              or(
                like(sql`lower(coalesce(${masterExercises.attributesJson}, ''))`, '%"spinalload":"low"%'),
                not(like(sql`lower(coalesce(${masterExercises.excludedLimitationsJson}, ''))`, '%lower_back_pain%')),
              ),
            );
          } else if (tag === 'knee_friendly') {
            conditions.push(
              not(like(sql`lower(coalesce(${masterExercises.excludedLimitationsJson}, ''))`, '%knee_pain%')),
            );
          } else if (tag === 'shoulder_friendly') {
            conditions.push(
              not(like(sql`lower(coalesce(${masterExercises.excludedLimitationsJson}, ''))`, '%shoulder_pain%')),
            );
          } else if (tag === 'neck_safe') {
            conditions.push(
              not(like(sql`lower(coalesce(${masterExercises.excludedLimitationsJson}, ''))`, '%neck_pain%')),
            );
          }
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(masterExercises)
        .where(whereClause);
      const total = Number(countResult[0]?.count) || 0;

      const rows = await db
        .select({
          id: masterExercises.id,
          canonicalId: masterExercises.canonicalId,
          name: masterExercises.name,
          nameLocalized: masterExercises.nameLocalized,
          bodyPart: masterExercises.bodyPart,
          target: masterExercises.target,
          primaryMuscle: masterExercises.primaryMuscle,
          secondaryMusclesJson: masterExercises.secondaryMusclesJson,
          movementPattern: masterExercises.movementPattern,
          recommendedLevel: masterExercises.recommendedLevel,
          excludedLimitationsJson: masterExercises.excludedLimitationsJson,
          attributesJson: masterExercises.attributesJson,
          mediaStorageUrl: exerciseMedia.storageUrl,
          mediaType: exerciseMedia.mediaType,
          mediaAltText: exerciseMedia.altText,
        })
        .from(masterExercises)
        .leftJoin(exerciseMedia, eq(exerciseMedia.exerciseId, masterExercises.id))
        .where(whereClause)
        .limit(limit)
        .offset(offset);

      const mapped = rows.map((r) => {
        let secondaryMuscles: string[] = [];
        try {
          if (r.secondaryMusclesJson) {
            secondaryMuscles = JSON.parse(r.secondaryMusclesJson);
          }
        } catch {
          secondaryMuscles = [];
        }

        let equipmentList: string[] = [];
        try {
          if (r.attributesJson) {
            const attrs = JSON.parse(r.attributesJson);
            if (Array.isArray(attrs.equipmentRequired) && attrs.equipmentRequired.length > 0) {
              equipmentList = attrs.equipmentRequired;
            }
          }
        } catch {
          equipmentList = [];
        }
        if (equipmentList.length === 0) {
          const lowerName = r.name.toLowerCase();
          if (lowerName.includes('barbell')) equipmentList = ['barbell'];
          else if (lowerName.includes('dumbbell')) equipmentList = ['dumbbell'];
          else if (lowerName.includes('cable')) equipmentList = ['cable'];
          else if (lowerName.includes('machine')) equipmentList = ['machine'];
          else if (lowerName.includes('band')) equipmentList = ['band'];
          else if (lowerName.includes('kettlebell')) equipmentList = ['kettlebell'];
          else equipmentList = ['bodyweight'];
        }

        let excludedLimitations: string[] = [];
        try {
          if (r.excludedLimitationsJson) {
            excludedLimitations = JSON.parse(r.excludedLimitationsJson);
          }
        } catch {
          excludedLimitations = [];
        }

        const highlightTags: string[] = [];
        if (!excludedLimitations.includes('lower_back_pain')) highlightTags.push('Low Spine Load');
        if (!excludedLimitations.includes('knee_pain')) highlightTags.push('Knee-Friendly');
        if (!excludedLimitations.includes('shoulder_pain')) highlightTags.push('Shoulder-Friendly');

        return {
          id: r.id,
          canonicalId: r.canonicalId,
          name: r.name,
          nameLocalized: r.nameLocalized,
          bodyPart: r.bodyPart || 'full_body',
          primaryMuscle: r.primaryMuscle || r.target || r.bodyPart || 'general',
          secondaryMuscles,
          movementPattern: r.movementPattern,
          recommendedLevel: r.recommendedLevel || 'beginner',
          equipment: equipmentList,
          media: r.mediaStorageUrl
            ? {
                imageUrl: r.mediaStorageUrl,
                thumbnailUrl: r.mediaStorageUrl,
                altText: r.mediaAltText || `${r.name} exercise visual`,
              }
            : null,
          safetySummary: {
            overallRating: excludedLimitations.length > 2 ? 'caution' : 'safe',
            highlightTags: highlightTags.slice(0, 2),
            excludedLimitations,
          },
        };
      });

      return c.json({
        data: mapped,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + mapped.length < total,
        },
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to list catalog exercises.');
    }
  });

  // 3. GET /exercise-catalog/exercises/:id
  route.get('/exercise-catalog/exercises/:id', async (c) => {
    try {
      const { db } = getApiRouteContext(c);
      if (!db) return notFound(c, 'Exercise not found.');

      const id = c.req.param('id')?.trim();
      const rows = await db
        .select()
        .from(masterExercises)
        .where(
          or(
            eq(masterExercises.id, id),
            eq(masterExercises.canonicalId, id),
            sql`lower(${masterExercises.name}) = lower(${id})`,
          ),
        )
        .limit(1);

      const exercise = rows[0];
      if (!exercise) {
        return notFound(c, `Exercise not found for id: ${id}`);
      }

      const ratings = await db
        .select({
          code: bodyConsiderations.code,
          displayName: bodyConsiderations.displayName,
          severity: exerciseConsiderationRatings.severity,
          rating: exerciseConsiderationRatings.rating,
          reason: exerciseConsiderationRatings.reason,
          requiredModification: exerciseConsiderationRatings.requiredModification,
        })
        .from(exerciseConsiderationRatings)
        .innerJoin(
          bodyConsiderations,
          eq(exerciseConsiderationRatings.considerationId, bodyConsiderations.id),
        )
        .where(eq(exerciseConsiderationRatings.exerciseId, exercise.id))
        .limit(25);

      let instructionsList: string[] = [];
      if (exercise.instructionsJson) {
        try {
          const parsed = JSON.parse(exercise.instructionsJson);
          if (Array.isArray(parsed)) instructionsList = parsed;
        } catch {
          instructionsList = [];
        }
      }
      if (instructionsList.length === 0 && exercise.instructions) {
        instructionsList = exercise.instructions
          .split(/\r?\n+|\.\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 3);
      }
      if (instructionsList.length === 0) {
        instructionsList = [
          'Assume stable initial posture with core braced and neutral spine.',
          'Execute the primary movement pattern under controlled tempo.',
          'Pause briefly at peak contraction or full range before controlled return.',
        ];
      }

      let secondaryMuscles: string[] = [];
      try {
        if (exercise.secondaryMusclesJson) {
          secondaryMuscles = JSON.parse(exercise.secondaryMusclesJson);
        }
      } catch {
        secondaryMuscles = [];
      }

      let equipmentList: string[] = [];
      try {
        if (exercise.attributesJson) {
          const attrs = JSON.parse(exercise.attributesJson);
          if (Array.isArray(attrs.equipmentRequired) && attrs.equipmentRequired.length > 0) {
            equipmentList = attrs.equipmentRequired;
          }
        }
      } catch {
        equipmentList = [];
      }
      if (equipmentList.length === 0) {
        const lowerName = exercise.name.toLowerCase();
        if (lowerName.includes('barbell')) equipmentList = ['barbell'];
        else if (lowerName.includes('dumbbell')) equipmentList = ['dumbbell'];
        else if (lowerName.includes('cable')) equipmentList = ['cable'];
        else if (lowerName.includes('machine')) equipmentList = ['machine'];
        else if (lowerName.includes('band')) equipmentList = ['band'];
        else equipmentList = ['bodyweight'];
      }

      const alternatives = await db
        .select({
          id: masterExercises.id,
          canonicalId: masterExercises.canonicalId,
          name: masterExercises.name,
          movementPattern: masterExercises.movementPattern,
          primaryMuscle: masterExercises.primaryMuscle,
          bodyPart: masterExercises.bodyPart,
          recommendedLevel: masterExercises.recommendedLevel,
        })
        .from(masterExercises)
        .where(
          and(
            eq(masterExercises.movementPattern, exercise.movementPattern),
            not(eq(masterExercises.id, exercise.id)),
          ),
        )
        .limit(3);

      return c.json({
        data: {
          id: exercise.id,
          canonicalId: exercise.canonicalId,
          name: exercise.name,
          nameLocalized: exercise.nameLocalized,
          bodyPart: exercise.bodyPart || 'full_body',
          primaryMuscle: exercise.primaryMuscle || exercise.target || exercise.bodyPart || 'general',
          secondaryMuscles,
          movementPattern: exercise.movementPattern,
          recommendedLevel: exercise.recommendedLevel || 'beginner',
          equipment: equipmentList,
          instructions: instructionsList,
          safetyConsiderations: ratings,
          saferAlternatives: alternatives.map((alt) => ({
            id: alt.id,
            canonicalId: alt.canonicalId,
            name: alt.name,
            movementPattern: alt.movementPattern,
            primaryMuscle: alt.primaryMuscle || alt.bodyPart || 'target',
            reason: `Safer variation for ${alt.movementPattern} pattern.`,
          })),
        },
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to fetch exercise details.');
    }
  });

  route.get('/exercise-catalog/swap-candidates', async (c) => {
    try {
      const { db } = getApiRouteContext(c);
      if (!db) {
        return c.json({ data: [] });
      }

      const pattern = c.req.query('movementPattern')?.trim();
      const muscle = c.req.query('muscleGroup')?.trim();

      const conditions = [];
      if (pattern) {
        conditions.push(eq(masterExercises.movementPattern, pattern));
      }
      if (muscle) {
        conditions.push(
          or(
            eq(masterExercises.primaryMuscle, muscle),
            eq(masterExercises.bodyPart, muscle),
          ),
        );
      }

      const rows = await db
        .select({
          id: masterExercises.id,
          masterExerciseId: masterExercises.canonicalId,
          name: masterExercises.name,
          movementPattern: masterExercises.movementPattern,
          primaryMuscle: masterExercises.primaryMuscle,
          bodyPart: masterExercises.bodyPart,
        })
        .from(masterExercises)
        .where(conditions.length > 0 ? or(...conditions) : undefined)
        .limit(20);

      const mapped = rows.map((r) => ({
        id: r.id,
        masterExerciseId: r.masterExerciseId,
        name: r.name,
        movementPattern: r.movementPattern,
        muscleGroups: [r.primaryMuscle || r.bodyPart || 'target'],
      }));

      return c.json({ data: mapped });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to find swap candidates.');
    }
  });

  route.get('/exercise-catalog/media', async (c) => {
    try {
      const { db } = getApiRouteContext(c);
      const media = await resolveExerciseCatalogMedia(db, {
        exerciseId: c.req.query('exerciseId')?.trim(),
        name: c.req.query('name')?.trim(),
      });

      return c.json({ data: media });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to load exercise catalog media.');
    }
  });

  route.post('/exercise-catalog/media/batch', async (c) => {
    try {
      const { db } = getApiRouteContext(c);
      const payload = await c.req.json().catch(() => ({ items: [] }));
      const parsed = exerciseCatalogMediaBatchSchema.safeParse(payload);
      if (!parsed.success) {
        return c.json({ data: {} });
      }

      const result: Record<string, ReturnType<typeof buildExerciseCatalogMediaResponse> | null> =
        {};
      const mediaByLookupKey = new Map<
        string,
        Promise<ReturnType<typeof buildExerciseCatalogMediaResponse> | null>
      >();

      for (const item of parsed.data.items) {
        const key = item.key || exerciseMediaRequestKey(item);
        if (!key) {
          continue;
        }

        const lookupKey = exerciseMediaRequestKey(item);
        if (!lookupKey) {
          result[key] = null;
          continue;
        }

        if (!mediaByLookupKey.has(lookupKey)) {
          mediaByLookupKey.set(lookupKey, resolveExerciseCatalogMedia(db, item));
        }

        result[key] = await mediaByLookupKey.get(lookupKey)!;
      }

      return c.json({ data: result });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to load batch exercise catalog media.');
    }
  });

  return route;
}

export const exerciseCatalogRouter = createExerciseCatalogRoutes();

export interface ExerciseCatalogMediaRow {
  exerciseId: string | null;
  name: string | null;
  mediaUrl: string;
  mediaType: string | null;
  isAiGenerated?: boolean | null;
  source?: string | null;
  sourceId?: string | null;
  licenseName?: string | null;
  licenseUrl?: string | null;
  licenseAuthor?: string | null;
  attributionText?: string | null;
}

export function buildExerciseCatalogMediaResponse(row: ExerciseCatalogMediaRow) {
  return {
    exerciseId: row.exerciseId,
    name: row.name,
    ...mediaUrlField(row.mediaType, row.mediaUrl),
    mediaUrl: row.mediaUrl,
    ...(row.isAiGenerated !== undefined && row.isAiGenerated !== null
      ? { isAiGenerated: row.isAiGenerated }
      : {}),
    ...(row.source ? { source: row.source } : {}),
    ...(row.sourceId ? { sourceId: row.sourceId } : {}),
    ...(row.licenseName ? { licenseName: row.licenseName } : {}),
    ...(row.licenseUrl ? { licenseUrl: row.licenseUrl } : {}),
    ...(row.licenseAuthor ? { licenseAuthor: row.licenseAuthor } : {}),
    ...(row.attributionText ? { attributionText: row.attributionText } : {}),
  };
}

export function mediaUrlField(mediaType: string | null, url: string) {
  switch ((mediaType ?? '').trim().toLowerCase()) {
    case 'thumbnail':
    case 'thumb':
      return { thumbnailUrl: url };
    case 'animated_gif':
    case 'animated-gif':
      return { animatedGifUrl: url };
    case 'gif':
      return { gifUrl: url };
    case 'image':
      return { imageUrl: url };
    default:
      return { mediaUrl: url };
  }
}

interface ExerciseCatalogMediaLookupInput {
  exerciseId?: string | null | undefined;
  name?: string | null | undefined;
  movementPattern?: string | null | undefined;
  muscleGroup?: string | null | undefined;
}

async function resolveExerciseCatalogMedia(
  db: ReturnType<typeof getApiRouteContext>['db'],
  request: ExerciseCatalogMediaLookupInput,
): Promise<ReturnType<typeof buildExerciseCatalogMediaResponse> | null> {
  const exerciseId = request.exerciseId?.trim();
  const name = request.name?.trim();
  if (!exerciseId && !name) {
    return null;
  }
  if (!db) {
    return null;
  }

  const lookupCondition = exerciseId
    ? eq(masterExercises.canonicalId, exerciseId)
    : sql`lower(${masterExercises.name}) = lower(${name ?? ''})`;
  const rows = await db
    .select({
      exerciseId: masterExercises.canonicalId,
      name: masterExercises.name,
      mediaUrl: exerciseMedia.storageUrl,
      mediaType: exerciseMedia.mediaType,
      source: exerciseMedia.source,
      sourceId: exerciseMedia.sourceId,
      licenseName: exerciseMedia.licenseName,
      licenseUrl: exerciseMedia.licenseUrl,
      licenseAuthor: exerciseMedia.licenseAuthor,
      attributionText: exerciseMedia.attributionText,
    })
    .from(exerciseMedia)
    .innerJoin(masterExercises, eq(exerciseMedia.exerciseId, masterExercises.id))
    .where(
      and(
        lookupCondition,
        eq(exerciseMedia.reviewStatus, 'approved'),
        inArray(exerciseMedia.ownershipStatus, PUBLIC_MEDIA_OWNERSHIP_STATUSES),
      ),
    )
    .limit(1);

  return rows[0] ? buildExerciseCatalogMediaResponse(rows[0]) : null;
}

function exerciseMediaRequestKey(request: ExerciseCatalogMediaLookupInput): string {
  return [
    request.exerciseId?.trim() ?? '',
    request.name?.trim() ?? '',
    request.movementPattern?.trim() ?? '',
    request.muscleGroup?.trim() ?? '',
  ].join('|');
}
