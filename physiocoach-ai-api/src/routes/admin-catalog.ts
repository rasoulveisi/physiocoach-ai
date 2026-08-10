import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  bodyConsiderations,
  exerciseAnalysisEvidence,
  exerciseCatalogVersions,
  exerciseConsiderationRatings,
  exerciseDuplicateReviewGroups,
  exerciseSafetyProfiles,
  masterExercises,
} from '../db/schema';
import type { WorkerBindings } from '../env';
import {
  activateCatalogVersion,
  CatalogActivationError,
  evaluateCatalogCoverage,
  markCatalogReady,
} from '../services/catalog-activation';
import { derivedExerciseAttributesSchema } from '../services/exercise-attribute-deriver';
import { createApiError, forbidden, handleRouteError, notFound } from '../shared/errors/api';
import { suitabilitySchema } from '../types/exercise-safety-catalog';
import { hasAdminRole } from './admin';
import { getApiRouteContext, hasDbClient } from './context';
import { parseJsonPayload } from './validation';

const manualSafetyOverrideSchema = z
  .object({
    rating: suitabilitySchema,
    reason: z.string().trim().min(1).max(2_000),
    // Accepted only for backwards compatibility. The authenticated request actor is authoritative.
    reviewedBy: z.string().trim().min(1).optional(),
    analysisVersion: z.string().trim().min(1),
  })
  .strict();

const metadataOverrideSchema = z
  .object({
    catalogVersionId: z.string().trim().min(1),
    movementPattern: z.enum([
      'squat',
      'hinge',
      'push',
      'pull',
      'lunge',
      'carry',
      'core',
      'mobility',
    ]),
    attributes: derivedExerciseAttributesSchema.refine(
      (attributes) => attributes.movementPattern !== 'unclassified',
      'Manual metadata must use a classified movement pattern.',
    ),
    reason: z.string().trim().min(1),
    // Accepted only for backwards compatibility. The authenticated request actor is authoritative.
    reviewedBy: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((input) => input.movementPattern === input.attributes.movementPattern, {
    message: 'Top-level and attribute movement patterns must match.',
    path: ['attributes', 'movementPattern'],
  });

const duplicateResolutionSchema = z
  .object({
    reason: z.string().trim().min(1).max(2_000),
    // Accepted only for backwards compatibility. The authenticated request actor is authoritative.
    reviewedBy: z.string().trim().min(1).optional(),
  })
  .strict();

export function createAdminCatalogRoutes() {
  const route = new Hono<{ Bindings: WorkerBindings }>();

  route.get('/admin/catalogs/:id/coverage', async (c) => {
    try {
      const context = getApiRouteContext(c);
      if (!hasAdminRole(context.user)) {
        return forbidden(c, 'Missing admin role for catalog coverage.');
      }
      if (!hasDbClient(context)) {
        return createApiError(
          c,
          'invalid_request',
          'Catalog persistence is unavailable in this environment.',
        );
      }

      const coverage = await evaluateCatalogCoverage(context.db, c.req.param('id'));
      return c.json({ data: coverage });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to load catalog safety coverage.');
    }
  });

  route.get('/admin/catalogs/:id/red-exercises', async (c) => {
    try {
      const context = getApiRouteContext(c);
      if (!hasAdminRole(context.user)) {
        return forbidden(c, 'Missing admin role for catalog safety review.');
      }
      if (!hasDbClient(context)) {
        return createApiError(
          c,
          'invalid_request',
          'Catalog persistence is unavailable in this environment.',
        );
      }
      const considerationCode = c.req.query('consideration')?.trim();
      const severity = c.req.query('severity')?.trim();
      if (!considerationCode || !['mild', 'moderate', 'severe'].includes(severity ?? '')) {
        return createApiError(
          c,
          'invalid_request',
          'A consideration and mild, moderate, or severe severity are required.',
        );
      }

      const result = await fetchCatalogRedExercises(
        context.db,
        c.req.param('id'),
        considerationCode,
        severity!,
      );
      if (!result) {
        return notFound(c, 'Catalog version does not exist.');
      }

      return c.json({ data: result });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to load catalog red exercises.');
    }
  });

  route.post('/admin/catalogs/:id/ready', async (c) => {
    try {
      const context = getApiRouteContext(c);
      if (!hasAdminRole(context.user)) {
        return forbidden(c, 'Missing admin role for catalog readiness.');
      }
      if (!hasDbClient(context)) {
        return createApiError(
          c,
          'invalid_request',
          'Catalog persistence is unavailable in this environment.',
        );
      }
      try {
        return c.json({ data: await markCatalogReady(context.db, c.req.param('id')) });
      } catch (error) {
        if (error instanceof CatalogActivationError) {
          return createApiError(c, 'conflict', error.message, { details: error.evaluation });
        }
        throw error;
      }
    } catch (error) {
      return handleRouteError(c, error, 'Failed to mark catalog ready.');
    }
  });

  route.patch('/admin/exercises/:id/safety', async (c) => {
    try {
      const context = getApiRouteContext(c);
      if (!hasAdminRole(context.user)) {
        return forbidden(c, 'Missing admin role for manual safety override.');
      }
      const parsed = await parseJsonPayload(c, manualSafetyOverrideSchema);
      if (!parsed.success) return parsed.response;
      if (!hasDbClient(context)) {
        return createApiError(
          c,
          'invalid_request',
          'Catalog persistence is unavailable in this environment.',
        );
      }

      const exerciseId = c.req.param('id');
      const actor = authenticatedActor(context.user);
      const res = await applyManualSafetyOverride(context.db, exerciseId, actor, parsed.data);

      if (res.status === 'not_found') {
        return notFound(
          c,
          'Safety profile does not exist for this exercise and analysis version.',
        );
      }
      if (res.status === 'invalid_catalog_state') {
        return createApiError(
          c,
          'conflict',
          'Safety overrides require the catalog review_required state and its current analysis version.',
        );
      }
      if (res.status === 'conflict') {
        return createApiError(c, 'conflict', 'catalog_changed_during_review');
      }

      return c.json({ data: res.data });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to apply manual safety override.');
    }
  });

  route.patch('/admin/exercises/:id/catalog-metadata', async (c) => {
    try {
      const context = getApiRouteContext(c);
      if (!hasAdminRole(context.user)) {
        return forbidden(c, 'Missing admin role for catalog metadata override.');
      }
      const parsed = await parseJsonPayload(c, metadataOverrideSchema);
      if (!parsed.success) return parsed.response;
      if (!hasDbClient(context)) {
        return createApiError(
          c,
          'invalid_request',
          'Catalog persistence is unavailable in this environment.',
        );
      }

      const id = c.req.param('id');
      const actor = authenticatedActor(context.user);
      const res = await applyCatalogMetadataOverride(context.db, id, actor, parsed.data);

      if (res.status === 'not_found') {
        return notFound(c, 'Exercise does not belong to the catalog version.');
      }
      if (res.status === 'invalid_catalog_state') {
        return createApiError(
          c,
          'conflict',
          'Metadata overrides require review_required status.',
        );
      }
      if (res.status === 'conflict') {
        return createApiError(c, 'conflict', 'catalog_changed_during_review');
      }

      return c.json({ data: res.data });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to apply catalog metadata override.');
    }
  });

  route.get('/admin/catalogs/:id/duplicate-reviews', async (c) => {
    try {
      const context = getApiRouteContext(c);
      if (!hasAdminRole(context.user)) {
        return forbidden(c, 'Missing admin role for duplicate review.');
      }
      if (!hasDbClient(context)) {
        return createApiError(
          c,
          'invalid_request',
          'Catalog persistence is unavailable in this environment.',
        );
      }
      const rows = await context.db
        .select()
        .from(exerciseDuplicateReviewGroups)
        .where(eq(exerciseDuplicateReviewGroups.catalogVersionId, c.req.param('id')));

      return c.json({
        data: rows.map((row) => ({ ...row, sourceIds: JSON.parse(row.sourceIdsJson) })),
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to list duplicate review groups.');
    }
  });

  route.post('/admin/catalogs/:id/duplicate-reviews/:name/resolve', async (c) => {
    try {
      const context = getApiRouteContext(c);
      if (!hasAdminRole(context.user)) {
        return forbidden(c, 'Missing admin role for duplicate review.');
      }
      const parsed = await parseJsonPayload(c, duplicateResolutionSchema);
      if (!parsed.success) return parsed.response;
      if (!hasDbClient(context)) {
        return createApiError(
          c,
          'invalid_request',
          'Catalog persistence is unavailable in this environment.',
        );
      }

      const catalogVersionId = c.req.param('id');
      const normalizedName = c.req.param('name');
      const actor = authenticatedActor(context.user);
      const res = await resolveDuplicateReviewGroup(
        context.db,
        catalogVersionId,
        normalizedName,
        actor,
        parsed.data.reason,
      );

      if (res.status === 'not_found') {
        return notFound(c, 'Catalog version does not exist.');
      }
      if (res.status === 'invalid_catalog_state') {
        return createApiError(
          c,
          'conflict',
          'Duplicate resolution requires review_required status.',
        );
      }
      if (res.status === 'conflict') {
        return createApiError(c, 'conflict', 'catalog_changed_during_review');
      }

      return c.json({ data: res.data });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to resolve duplicate review group.');
    }
  });

  route.post('/admin/catalogs/:id/activate', async (c) => {
    try {
      const context = getApiRouteContext(c);
      if (!hasAdminRole(context.user)) {
        return forbidden(c, 'Missing admin role for catalog activation.');
      }
      if (!hasDbClient(context)) {
        return createApiError(
          c,
          'invalid_request',
          'Catalog persistence is unavailable in this environment.',
        );
      }

      try {
        return c.json({
          data: await activateCatalogVersion(context.db, c.req.param('id'), context.user.id),
        });
      } catch (error) {
        if (error instanceof CatalogActivationError) {
          return createApiError(c, 'conflict', error.message, { details: error.evaluation });
        }
        throw error;
      }
    } catch (error) {
      return handleRouteError(c, error, 'Failed to activate catalog.');
    }
  });

  return route;
}

async function fetchCatalogRedExercises(
  db: NonNullable<ReturnType<typeof getApiRouteContext>['db']>,
  catalogId: string,
  considerationCode: string,
  severity: string,
) {
  const catalogRows = await db
    .select({ analysisVersion: exerciseCatalogVersions.analysisVersion })
    .from(exerciseCatalogVersions)
    .where(eq(exerciseCatalogVersions.id, catalogId))
    .limit(1);
  const catalog = catalogRows[0];
  if (!catalog) return null;

  const rows = await db
    .select({ exerciseId: masterExercises.id })
    .from(exerciseConsiderationRatings)
    .innerJoin(masterExercises, eq(exerciseConsiderationRatings.exerciseId, masterExercises.id))
    .innerJoin(
      bodyConsiderations,
      eq(exerciseConsiderationRatings.considerationId, bodyConsiderations.id),
    )
    .innerJoin(
      exerciseSafetyProfiles,
      and(
        eq(exerciseSafetyProfiles.exerciseId, masterExercises.id),
        eq(exerciseSafetyProfiles.analysisVersion, catalog.analysisVersion),
        eq(exerciseSafetyProfiles.reviewStatus, 'approved'),
      ),
    )
    .where(
      and(
        eq(masterExercises.catalogVersionId, catalogId),
        eq(bodyConsiderations.code, considerationCode),
        eq(exerciseConsiderationRatings.severity, severity),
        eq(exerciseConsiderationRatings.rating, 'avoid'),
        eq(exerciseConsiderationRatings.analysisVersion, catalog.analysisVersion),
      ),
    );

  return {
    catalogVersionId: catalogId,
    consideration: considerationCode,
    severity,
    exerciseIds: rows.map((row) => row.exerciseId),
  };
}

async function applyManualSafetyOverride(
  db: NonNullable<ReturnType<typeof getApiRouteContext>['db']>,
  exerciseId: string,
  actor: string,
  override: z.infer<typeof manualSafetyOverrideSchema>,
) {
  const profile = await db
    .select({
      exerciseId: exerciseSafetyProfiles.exerciseId,
      catalogVersionId: masterExercises.catalogVersionId,
      catalogStatus: exerciseCatalogVersions.status,
      catalogAnalysisVersion: exerciseCatalogVersions.analysisVersion,
      reviewRevision: exerciseCatalogVersions.reviewRevision,
      previousRating: exerciseSafetyProfiles.globalRating,
      previousReason: exerciseSafetyProfiles.summaryReason,
    })
    .from(exerciseSafetyProfiles)
    .innerJoin(masterExercises, eq(exerciseSafetyProfiles.exerciseId, masterExercises.id))
    .innerJoin(
      exerciseCatalogVersions,
      eq(masterExercises.catalogVersionId, exerciseCatalogVersions.id),
    )
    .where(
      and(
        eq(exerciseSafetyProfiles.exerciseId, exerciseId),
        eq(exerciseSafetyProfiles.analysisVersion, override.analysisVersion),
      ),
    )
    .limit(1);

  if (!profile[0]) {
    return { status: 'not_found' as const };
  }

  const catalog = profile[0];
  if (
    catalog.catalogStatus !== 'review_required' ||
    catalog.catalogAnalysisVersion !== override.analysisVersion ||
    !catalog.catalogVersionId
  ) {
    return { status: 'invalid_catalog_state' as const };
  }

  const reviewedAt = new Date().toISOString();
  const catalogGuard = sql`exists (
    select 1 from ${exerciseCatalogVersions}
    where ${exerciseCatalogVersions.id} = ${catalog.catalogVersionId}
      and ${exerciseCatalogVersions.status} = 'review_required'
      and ${exerciseCatalogVersions.reviewRevision} = ${catalog.reviewRevision}
  )`;
  const evidenceId = crypto.randomUUID();
  const profileAppliedGuard = sql`exists (
    select 1 from ${exerciseSafetyProfiles}
    where ${exerciseSafetyProfiles.exerciseId} = ${exerciseId}
      and ${exerciseSafetyProfiles.analysisVersion} = ${override.analysisVersion}
      and ${exerciseSafetyProfiles.reviewedBy} = ${actor}
      and ${exerciseSafetyProfiles.reviewedAt} = ${reviewedAt}
  )`;

  const results = await db.batch([
    db
      .update(exerciseSafetyProfiles)
      .set({
        globalRating: override.rating,
        summaryReason: override.reason,
        reviewStatus: 'approved',
        manualOverride: 1,
        reviewedBy: actor,
        reviewedAt,
        updatedAt: reviewedAt,
      })
      .where(
        and(
          eq(exerciseSafetyProfiles.exerciseId, exerciseId),
          eq(exerciseSafetyProfiles.analysisVersion, override.analysisVersion),
          catalogGuard,
        ),
      ),
    db.insert(exerciseAnalysisEvidence).select(sql`
      select ${evidenceId}, ${exerciseId}, null, ${override.analysisVersion},
        ${JSON.stringify({
          evidenceType: 'manual_safety_override',
          previous: {
            rating: catalog.previousRating,
            reason: catalog.previousReason,
          },
          next: {
            rating: override.rating,
            reason: override.reason,
          },
          analysisVersion: override.analysisVersion,
          actor,
          revision: catalog.reviewRevision,
          reason: override.reason,
          timestamp: reviewedAt,
        })}, ${reviewedAt}
      where ${catalogGuard} and ${profileAppliedGuard}
    `),
    db
      .update(exerciseCatalogVersions)
      .set({
        reviewRevision: sql`${exerciseCatalogVersions.reviewRevision} + 1`,
      })
      .where(
        and(
          eq(exerciseCatalogVersions.id, catalog.catalogVersionId),
          eq(exerciseCatalogVersions.status, 'review_required'),
          eq(exerciseCatalogVersions.reviewRevision, catalog.reviewRevision),
          sql`exists (select 1 from ${exerciseAnalysisEvidence} where ${exerciseAnalysisEvidence.id} = ${evidenceId})`,
        ),
      ),
  ]);

  if (results.some((result) => changedRows(result) !== 1)) {
    return { status: 'conflict' as const };
  }

  return {
    status: 'success' as const,
    data: {
      exerciseId,
      rating: override.rating,
      reason: override.reason,
      reviewedBy: actor,
      reviewedAt,
      analysisVersion: override.analysisVersion,
      manualOverride: true,
    },
  };
}

async function applyCatalogMetadataOverride(
  db: NonNullable<ReturnType<typeof getApiRouteContext>['db']>,
  exerciseId: string,
  actor: string,
  override: z.infer<typeof metadataOverrideSchema>,
) {
  const exists = await db
    .select({
      id: masterExercises.id,
      status: exerciseCatalogVersions.status,
      analysisVersion: exerciseCatalogVersions.analysisVersion,
      reviewRevision: exerciseCatalogVersions.reviewRevision,
      previousMovementPattern: masterExercises.movementPattern,
      previousAttributesJson: masterExercises.attributesJson,
    })
    .from(masterExercises)
    .innerJoin(
      exerciseCatalogVersions,
      eq(masterExercises.catalogVersionId, exerciseCatalogVersions.id),
    )
    .where(
      and(
        eq(masterExercises.id, exerciseId),
        eq(masterExercises.catalogVersionId, override.catalogVersionId),
      ),
    )
    .limit(1);

  if (!exists[0]) {
    return { status: 'not_found' as const };
  }
  if (exists[0].status !== 'review_required') {
    return { status: 'invalid_catalog_state' as const };
  }

  const now = new Date().toISOString();
  const revision = exists[0].reviewRevision;
  const guard = sql`exists (
    select 1 from ${exerciseCatalogVersions}
    where ${exerciseCatalogVersions.id} = ${override.catalogVersionId}
      and ${exerciseCatalogVersions.status} = 'review_required'
      and ${exerciseCatalogVersions.reviewRevision} = ${revision}
  )`;
  const evidenceId = crypto.randomUUID();
  const metadataAppliedGuard = sql`exists (
    select 1 from ${masterExercises}
    where ${masterExercises.id} = ${exerciseId}
      and ${masterExercises.catalogVersionId} = ${override.catalogVersionId}
      and ${masterExercises.updatedAt} = ${now}
  )`;

  const results = await db.batch([
    db
      .update(masterExercises)
      .set({
        movementPattern: override.movementPattern,
        attributesJson: JSON.stringify(override.attributes),
        updatedAt: now,
      })
      .where(
        and(
          eq(masterExercises.id, exerciseId),
          eq(masterExercises.catalogVersionId, override.catalogVersionId),
          guard,
        ),
      ),
    db.insert(exerciseAnalysisEvidence).select(sql`
      select ${evidenceId}, ${exerciseId}, null, 'manual_metadata_override',
        ${JSON.stringify({
          evidenceType: 'manual_metadata_override',
          previous: {
            movementPattern: exists[0].previousMovementPattern,
            attributesJson: exists[0].previousAttributesJson,
          },
          next: {
            movementPattern: override.movementPattern,
            attributes: override.attributes,
          },
          catalogVersionId: override.catalogVersionId,
          analysisVersion: exists[0].analysisVersion,
          actor,
          revision,
          reason: override.reason,
          timestamp: now,
        })}, ${now}
      where ${guard} and ${metadataAppliedGuard}
    `),
    db
      .update(exerciseCatalogVersions)
      .set({ reviewRevision: sql`${exerciseCatalogVersions.reviewRevision} + 1` })
      .where(
        and(
          eq(exerciseCatalogVersions.id, override.catalogVersionId),
          eq(exerciseCatalogVersions.status, 'review_required'),
          eq(exerciseCatalogVersions.reviewRevision, revision),
          sql`exists (select 1 from ${exerciseAnalysisEvidence} where ${exerciseAnalysisEvidence.id} = ${evidenceId})`,
        ),
      ),
  ]);

  if (results.some((result) => changedRows(result) !== 1)) {
    return { status: 'conflict' as const };
  }

  return {
    status: 'success' as const,
    data: {
      exerciseId,
      catalogVersionId: override.catalogVersionId,
      movementPattern: override.movementPattern,
      reviewedBy: actor,
      reviewedAt: now,
    },
  };
}

async function resolveDuplicateReviewGroup(
  db: NonNullable<ReturnType<typeof getApiRouteContext>['db']>,
  catalogVersionId: string,
  normalizedName: string,
  actor: string,
  reason: string,
) {
  const catalogRows = await db
    .select({
      status: exerciseCatalogVersions.status,
      reviewRevision: exerciseCatalogVersions.reviewRevision,
    })
    .from(exerciseCatalogVersions)
    .where(eq(exerciseCatalogVersions.id, catalogVersionId))
    .limit(1);
  const catalog = catalogRows[0];
  if (!catalog) return { status: 'not_found' as const };
  if (catalog.status !== 'review_required') {
    return { status: 'invalid_catalog_state' as const };
  }

  const now = new Date().toISOString();
  const results = await db.batch([
    db
      .update(exerciseDuplicateReviewGroups)
      .set({
        status: 'resolved',
        reason,
        reviewedBy: actor,
        reviewedAt: now,
      })
      .where(
        and(
          eq(exerciseDuplicateReviewGroups.catalogVersionId, catalogVersionId),
          eq(exerciseDuplicateReviewGroups.normalizedName, normalizedName),
          eq(exerciseDuplicateReviewGroups.status, 'pending'),
          sql`exists (select 1 from ${exerciseCatalogVersions} where ${exerciseCatalogVersions.id} = ${catalogVersionId} and ${exerciseCatalogVersions.status} = 'review_required' and ${exerciseCatalogVersions.reviewRevision} = ${catalog.reviewRevision})`,
        ),
      ),
    db
      .update(exerciseCatalogVersions)
      .set({ reviewRevision: sql`${exerciseCatalogVersions.reviewRevision} + 1` })
      .where(
        and(
          eq(exerciseCatalogVersions.id, catalogVersionId),
          eq(exerciseCatalogVersions.status, 'review_required'),
          eq(exerciseCatalogVersions.reviewRevision, catalog.reviewRevision),
          sql`exists (select 1 from ${exerciseDuplicateReviewGroups} where ${exerciseDuplicateReviewGroups.catalogVersionId} = ${catalogVersionId} and ${exerciseDuplicateReviewGroups.normalizedName} = ${normalizedName} and ${exerciseDuplicateReviewGroups.status} = 'resolved')`,
        ),
      ),
  ]);

  if (changedRows(results[0]) !== 1 || changedRows(results[1]) !== 1) {
    return { status: 'conflict' as const };
  }

  return {
    status: 'success' as const,
    data: {
      catalogVersionId,
      normalizedName,
      status: 'resolved',
      reason,
      reviewedBy: actor,
      reviewedAt: now,
    },
  };
}

function changedRows(result: unknown): number {
  const changes = (result as { meta?: { changes?: unknown } })?.meta?.changes;
  return typeof changes === 'number' ? changes : 0;
}

function authenticatedActor(user: { id: string; email: string }): string {
  const id = user.id.trim();
  if (!id) throw new Error('Authenticated review actor is missing an id.');
  return id;
}
