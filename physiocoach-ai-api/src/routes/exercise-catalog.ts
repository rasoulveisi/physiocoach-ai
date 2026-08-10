import { and, eq, inArray, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { exerciseMedia, masterExercises } from '../db/schema';
import type { WorkerBindings } from '../env';
import { getApiRouteContext } from './context';
import { handleRouteError } from '../shared/errors/api';

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
  const route = new Hono<{ Bindings: WorkerBindings }>();

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
