import { and, eq, inArray, like, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  bodyConsiderations,
  exerciseConsiderationRatings,
  exerciseMedia,
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

  route.get('/exercise-catalog/exercises', async (c) => {
    try {
      const { db } = getApiRouteContext(c);
      if (!db) {
        return c.json({ data: [] });
      }

      const q = c.req.query('q')?.trim().toLowerCase();
      const category = c.req.query('category')?.trim();
      const muscle = c.req.query('muscle')?.trim();
      const pattern = c.req.query('movementPattern')?.trim();
      const limitStr = c.req.query('limit');
      const limit = limitStr ? Math.min(100, Math.max(1, Number(limitStr))) : 50;

      const queryBuilder = db
        .select({
          id: masterExercises.id,
          canonicalId: masterExercises.canonicalId,
          name: masterExercises.name,
          bodyPart: masterExercises.bodyPart,
          primaryMuscle: masterExercises.primaryMuscle,
          movementPattern: masterExercises.movementPattern,
          recommendedLevel: masterExercises.recommendedLevel,
        })
        .from(masterExercises);

      const conditions = [];
      if (q) {
        conditions.push(
          or(
            like(sql`lower(${masterExercises.name})`, `%${q}%`),
            like(sql`lower(${masterExercises.movementPattern})`, `%${q}%`),
            like(sql`lower(coalesce(${masterExercises.primaryMuscle}, ''))`, `%${q}%`),
            like(sql`lower(coalesce(${masterExercises.bodyPart}, ''))`, `%${q}%`),
          ),
        );
      }
      if (category && category !== 'all') {
        conditions.push(eq(masterExercises.bodyPart, category));
      }
      if (muscle && muscle !== 'all') {
        conditions.push(eq(masterExercises.primaryMuscle, muscle));
      }
      if (pattern && pattern !== 'all') {
        conditions.push(eq(masterExercises.movementPattern, pattern));
      }

      const rows =
        conditions.length > 0
          ? await queryBuilder.where(and(...conditions)).limit(limit)
          : await queryBuilder.limit(limit);

      return c.json({ data: rows });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to list catalog exercises.');
    }
  });

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
          condition: bodyConsiderations.displayName,
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

      return c.json({
        data: {
          ...exercise,
          safetyConsiderations: ratings,
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
