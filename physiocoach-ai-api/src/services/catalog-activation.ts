import { and, eq, inArray, sql } from 'drizzle-orm';

import { createDb } from '../db/client';
import { analyzerEvidenceSchema, hasExactAnalyzerEvidenceMatrix } from './exercise-safety-analyzer';
import {
  bodyConsiderations,
  exerciseAnalysisEvidence,
  exerciseCatalogVersions,
  exerciseConsiderationRatings,
  exerciseDuplicateReviewGroups,
  exerciseEquipment,
  exerciseSafetyProfiles,
  masterExercises,
} from '../db/schema';
import { derivedExerciseAttributesSchema } from './exercise-attribute-deriver';

export type CatalogActivationDb = ReturnType<typeof createDb>;

const REQUIRED_SEVERITIES = ['mild', 'moderate', 'severe'] as const;
// D1 limits the number of bound parameters per statement; keep headroom for
// non-list predicates (analysis version, status, etc.) in each query.
const D1_IN_CLAUSE_CHUNK_SIZE = 50;

function chunkValues<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size) as T[]);
  }
  return chunks;
}

export type CatalogActivationBlockerCode =
  | 'catalog_not_found'
  | 'catalog_not_ready'
  | 'catalog_not_review_required'
  | 'catalog_changed_during_readiness'
  | 'source_accounting_incomplete'
  | 'missing_required_exercise_fields'
  | 'review_status_not_approved'
  | 'incomplete_safety_coverage'
  | 'invalid_safety_rating_content'
  | 'non_monotonic_safety_ratings'
  | 'pending_duplicate_reviews'
  | 'unresolved_safety_conflicts';

export interface CatalogActivationBlocker {
  code: CatalogActivationBlockerCode;
  message: string;
  exerciseIds?: string[];
}

export interface CatalogActivationEvaluation {
  catalogVersionId: string;
  status: string | null;
  sourceRecordCount: number;
  reviewRevision: number;
  ready: boolean;
  blockers: CatalogActivationBlocker[];
  coverage: {
    totalExercises: number;
    approvedExercises: number;
    completeExercises: number;
    activeConsiderations: number;
    expectedCellsPerExercise: number;
  };
}

export interface CatalogActivationResult extends CatalogActivationEvaluation {
  activatedAt: string;
  actor: string;
}

export class CatalogActivationError extends Error {
  constructor(readonly evaluation: CatalogActivationEvaluation) {
    super(
      evaluation.blockers.some((blocker) => blocker.code === 'catalog_changed_during_readiness')
        ? 'catalog_changed_during_readiness'
        : 'Catalog activation is blocked by unresolved readiness checks.',
    );
    this.name = 'CatalogActivationError';
  }
}

/** Evaluates immutable catalog data and its reviewed safety matrix before publication. */
export async function evaluateCatalogActivation(
  db: CatalogActivationDb,
  catalogVersionId: string,
  requirement: boolean | { allowedStatuses: readonly string[] } = true,
): Promise<CatalogActivationEvaluation> {
  const catalogRows = await db
    .select()
    .from(exerciseCatalogVersions)
    .where(eq(exerciseCatalogVersions.id, catalogVersionId))
    .limit(1);
  const catalog = catalogRows[0];

  if (!catalog) {
    return emptyEvaluation(catalogVersionId, [
      {
        code: 'catalog_not_found',
        message: 'Catalog version does not exist.',
      },
    ]);
  }

  const blockers: CatalogActivationBlocker[] = [];
  const allowedStatuses =
    typeof requirement === 'boolean'
      ? requirement
        ? ['ready']
        : ['review_required']
      : requirement.allowedStatuses;
  if (!allowedStatuses.includes(catalog.status)) {
    blockers.push({
      code:
        allowedStatuses.length === 1 && allowedStatuses[0] === 'review_required'
          ? 'catalog_not_review_required'
          : 'catalog_not_ready',
      message: `Catalog status "${catalog.status}" is not eligible for this evaluation.`,
    });
  }
  if (
    catalog.sourceRecordCount <= 0 ||
    catalog.sourceRecordCount !== catalog.importedRecordCount + catalog.rejectedRecordCount
  ) {
    blockers.push({
      code: 'source_accounting_incomplete',
      message: 'Source record accounting must equal the imported plus rejected record count.',
    });
  }

  const exercises = await db
    .select({
      id: masterExercises.id,
      movementPattern: masterExercises.movementPattern,
      primaryMuscle: masterExercises.primaryMuscle,
      target: masterExercises.target,
      attributesJson: masterExercises.attributesJson,
    })
    .from(masterExercises)
    .where(eq(masterExercises.catalogVersionId, catalogVersionId));
  const activeConsiderations = await db
    .select({ id: bodyConsiderations.id, code: bodyConsiderations.code })
    .from(bodyConsiderations)
    .where(eq(bodyConsiderations.active, 1));
  const exerciseIds = exercises.map((exercise) => exercise.id);
  const exerciseIdChunks = chunkValues(exerciseIds, D1_IN_CLAUSE_CHUNK_SIZE);

  if (exercises.length !== catalog.importedRecordCount) {
    blockers.push({
      code: 'source_accounting_incomplete',
      message: 'Persisted catalog exercise rows must equal the imported record count.',
    });
  }

  if (exerciseIds.length === 0) {
    blockers.push({
      code: 'missing_required_exercise_fields',
      message: 'Catalog contains no published exercises.',
    });
    return buildEvaluation(catalogVersionId, blockers, 0, 0, 0, activeConsiderations.length);
  }

  const [profiles, ratings, evidence, equipment, pendingDuplicateGroups] = await Promise.all([
    Promise.all(
      exerciseIdChunks.map((ids) =>
        db
          .select({
            exerciseId: exerciseSafetyProfiles.exerciseId,
            reviewStatus: exerciseSafetyProfiles.reviewStatus,
            coverageComplete: exerciseSafetyProfiles.coverageComplete,
            globalRating: exerciseSafetyProfiles.globalRating,
            summaryReason: exerciseSafetyProfiles.summaryReason,
          })
          .from(exerciseSafetyProfiles)
          .where(
            and(
              eq(exerciseSafetyProfiles.analysisVersion, catalog.analysisVersion),
              inArray(exerciseSafetyProfiles.exerciseId, ids),
            ),
          ),
      ),
    ).then((rows) => rows.flat()),
    Promise.all(
      exerciseIdChunks.map((ids) =>
        db
          .select({
            exerciseId: exerciseConsiderationRatings.exerciseId,
            considerationId: exerciseConsiderationRatings.considerationId,
            severity: exerciseConsiderationRatings.severity,
            rating: exerciseConsiderationRatings.rating,
            reason: exerciseConsiderationRatings.reason,
          })
          .from(exerciseConsiderationRatings)
          .where(
            and(
              eq(exerciseConsiderationRatings.analysisVersion, catalog.analysisVersion),
              inArray(exerciseConsiderationRatings.exerciseId, ids),
            ),
          ),
      ),
    ).then((rows) => rows.flat()),
    Promise.all(
      exerciseIdChunks.map((ids) =>
        db
          .select({
            exerciseId: exerciseAnalysisEvidence.exerciseId,
            evidenceJson: exerciseAnalysisEvidence.evidenceJson,
          })
          .from(exerciseAnalysisEvidence)
          .where(
            and(
              eq(exerciseAnalysisEvidence.analysisVersion, catalog.analysisVersion),
              inArray(exerciseAnalysisEvidence.exerciseId, ids),
            ),
          ),
      ),
    ).then((rows) => rows.flat()),
    Promise.all(
      exerciseIdChunks.map((ids) =>
        db
          .select({ exerciseId: exerciseEquipment.exerciseId })
          .from(exerciseEquipment)
          .where(inArray(exerciseEquipment.exerciseId, ids)),
      ),
    ).then((rows) => rows.flat()),
    db
      .select({ normalizedName: exerciseDuplicateReviewGroups.normalizedName })
      .from(exerciseDuplicateReviewGroups)
      .where(
        and(
          eq(exerciseDuplicateReviewGroups.catalogVersionId, catalogVersionId),
          eq(exerciseDuplicateReviewGroups.status, 'pending'),
        ),
      ),
  ]);

  if (pendingDuplicateGroups.length > 0) {
    blockers.push({
      code: 'pending_duplicate_reviews',
      message: 'Every duplicate-name review group must have an explicit resolution.',
    });
  }

  const equipmentExerciseIds = new Set(equipment.map((row) => row.exerciseId));
  const incompleteMetadata = exercises
    .filter(
      (exercise) => !hasRequiredDerivedFields(exercise) || !equipmentExerciseIds.has(exercise.id),
    )
    .map((exercise) => exercise.id);
  if (incompleteMetadata.length > 0) {
    blockers.push({
      code: 'missing_required_exercise_fields',
      message:
        'Published exercises require equipment, target, primary muscle, movement pattern, and derived attributes.',
      exerciseIds: incompleteMetadata,
    });
  }

  const profilesByExerciseId = new Map(profiles.map((profile) => [profile.exerciseId, profile]));
  const unapprovedExerciseIds = exerciseIds.filter(
    (exerciseId) => profilesByExerciseId.get(exerciseId)?.reviewStatus !== 'approved',
  );
  if (unapprovedExerciseIds.length > 0) {
    blockers.push({
      code: 'review_status_not_approved',
      message: 'Every published exercise must have an approved safety review.',
      exerciseIds: unapprovedExerciseIds,
    });
  }

  const activeConsiderationIds = new Set(
    activeConsiderations.map((consideration) => consideration.id),
  );
  const expectedCells = new Set(
    [...activeConsiderationIds].flatMap((considerationId) =>
      REQUIRED_SEVERITIES.map((severity) => `${considerationId}:${severity}`),
    ),
  );
  const expectedEvidenceCells = new Set(
    activeConsiderations.flatMap((consideration) =>
      REQUIRED_SEVERITIES.map((severity) => `${consideration.code}:${severity}`),
    ),
  );
  const expectedCellsPerExercise = expectedCells.size;
  const matrixCellsByExercise = new Map<string, Set<string>>();
  for (const rating of ratings) {
    if (!activeConsiderationIds.has(rating.considerationId)) continue;
    const cell = `${rating.considerationId}:${rating.severity}`;
    if (!expectedCells.has(cell)) continue;
    const cells = matrixCellsByExercise.get(rating.exerciseId) ?? new Set<string>();
    cells.add(cell);
    matrixCellsByExercise.set(rating.exerciseId, cells);
  }
  const incompleteMatrixExerciseIds = exerciseIds.filter((exerciseId) => {
    const profile = profilesByExerciseId.get(exerciseId);
    return (
      profile?.coverageComplete !== 1 ||
      matrixCellsByExercise.get(exerciseId)?.size !== expectedCellsPerExercise
    );
  });
  if (activeConsiderationIds.size === 0 || incompleteMatrixExerciseIds.length > 0) {
    blockers.push({
      code: 'incomplete_safety_coverage',
      message:
        'Every published exercise must contain every active consideration and severity matrix cell.',
      ...(incompleteMatrixExerciseIds.length > 0
        ? { exerciseIds: incompleteMatrixExerciseIds }
        : {}),
    });
  }

  const invalidRatingExerciseIds = new Set<string>();
  const nonMonotonicExerciseIds = new Set<string>();
  const ratingRanks: Record<string, number> = { recommended: 0, caution: 1, avoid: 2 };
  const ratingsByExerciseAndConsideration = new Map<string, Map<string, number>>();
  for (const profile of profiles) {
    if (!(profile.globalRating in ratingRanks) || !profile.summaryReason?.trim()) {
      invalidRatingExerciseIds.add(profile.exerciseId);
    }
  }
  for (const rating of ratings) {
    if (!(rating.rating in ratingRanks) || !rating.reason.trim()) {
      invalidRatingExerciseIds.add(rating.exerciseId);
      continue;
    }
    if (!REQUIRED_SEVERITIES.includes(rating.severity as (typeof REQUIRED_SEVERITIES)[number])) {
      if (activeConsiderationIds.has(rating.considerationId)) {
        invalidRatingExerciseIds.add(rating.exerciseId);
      }
      continue;
    }
    const key = `${rating.exerciseId}:${rating.considerationId}`;
    const bySeverity = ratingsByExerciseAndConsideration.get(key) ?? new Map<string, number>();
    bySeverity.set(rating.severity, ratingRanks[rating.rating]!);
    ratingsByExerciseAndConsideration.set(key, bySeverity);
  }
  for (const [key, bySeverity] of ratingsByExerciseAndConsideration) {
    const ordered = REQUIRED_SEVERITIES.map((severity) => bySeverity.get(severity));
    if (
      ordered.every((rank) => rank !== undefined) &&
      (ordered[0]! > ordered[1]! || ordered[1]! > ordered[2]!)
    ) {
      nonMonotonicExerciseIds.add(key.split(':')[0]!);
    }
  }
  if (invalidRatingExerciseIds.size > 0) {
    blockers.push({
      code: 'invalid_safety_rating_content',
      message: 'Safety ratings require a valid rating enum and a nonempty reason.',
      exerciseIds: [...invalidRatingExerciseIds],
    });
  }
  if (nonMonotonicExerciseIds.size > 0) {
    blockers.push({
      code: 'non_monotonic_safety_ratings',
      message: 'Safety strictness cannot decrease from mild to moderate to severe.',
      exerciseIds: [...nonMonotonicExerciseIds],
    });
  }

  const evidenceByExerciseId = new Map<string, string[]>();
  for (const row of evidence) {
    const rows = evidenceByExerciseId.get(row.exerciseId) ?? [];
    rows.push(row.evidenceJson);
    evidenceByExerciseId.set(row.exerciseId, rows);
  }
  const conflictingExerciseIds = exerciseIds.filter(
    (exerciseId) =>
      !evidenceByExerciseId
        .get(exerciseId)
        ?.some(
          (evidenceJson) =>
            !hasUnresolvedConflicts(evidenceJson, catalog.analysisVersion, expectedEvidenceCells),
        ),
  );
  if (conflictingExerciseIds.length > 0) {
    blockers.push({
      code: 'unresolved_safety_conflicts',
      message: 'Published exercises cannot have unresolved deterministic and AI safety conflicts.',
      exerciseIds: conflictingExerciseIds,
    });
  }

  const approvedExercises = exerciseIds.filter(
    (exerciseId) => profilesByExerciseId.get(exerciseId)?.reviewStatus === 'approved',
  ).length;
  const completeExercises = exerciseIds.filter(
    (exerciseId) => !incompleteMatrixExerciseIds.includes(exerciseId),
  ).length;
  return buildEvaluation(
    catalogVersionId,
    blockers,
    exerciseIds.length,
    approvedExercises,
    completeExercises,
    activeConsiderationIds.size,
    catalog.sourceRecordCount,
    catalog.status,
    catalog.reviewRevision,
  );
}

/** Evaluates substantive catalog health without treating an active catalog as transitionable. */
export function evaluateCatalogCoverage(
  db: CatalogActivationDb,
  catalogVersionId: string,
): Promise<CatalogActivationEvaluation> {
  return evaluateCatalogActivation(db, catalogVersionId, {
    allowedStatuses: ['review_required', 'ready', 'active'],
  });
}

/** Sets ready only after every substantive activation gate passes. */
export async function markCatalogReady(db: CatalogActivationDb, catalogVersionId: string) {
  const evaluation = await evaluateCatalogActivation(db, catalogVersionId, false);
  if (!evaluation.ready) throw new CatalogActivationError(evaluation);
  const result = await db
    .update(exerciseCatalogVersions)
    .set({ status: 'ready' })
    .where(
      and(
        eq(exerciseCatalogVersions.id, catalogVersionId),
        eq(exerciseCatalogVersions.status, 'review_required'),
        eq(exerciseCatalogVersions.reviewRevision, evaluation.reviewRevision),
      ),
    )
    .run();
  if (changedRows(result) !== 1) {
    throw new CatalogActivationError({
      ...evaluation,
      ready: false,
      blockers: [
        ...evaluation.blockers,
        {
          code: 'catalog_changed_during_readiness',
          message: 'Catalog changed while readiness was being evaluated; evaluate it again.',
        },
      ],
    });
  }
  return { ...evaluation, status: 'ready' };
}

/** Retires any current catalog and activates the reviewed replacement in one transaction. */
export async function activateCatalogVersion(
  db: CatalogActivationDb,
  catalogVersionId: string,
  actor: string,
): Promise<CatalogActivationResult> {
  const normalizedActor = actor.trim();
  if (!normalizedActor) throw new Error('An activation actor is required.');

  const activatedAt = new Date().toISOString();
  const evaluation = await evaluateCatalogActivation(db, catalogVersionId);
  if (!evaluation.ready) throw new CatalogActivationError(evaluation);
  const targetIsReady = sql`exists (
    select 1 from ${exerciseCatalogVersions} target
    where target.id = ${catalogVersionId} and target.status = 'ready'
  )`;
  const results = await db.batch([
    db
      .update(exerciseCatalogVersions)
      .set({ status: 'retired' })
      .where(and(eq(exerciseCatalogVersions.status, 'active'), targetIsReady)),
    db
      .update(exerciseCatalogVersions)
      .set({ status: 'active', activatedAt })
      .where(
        and(
          eq(exerciseCatalogVersions.id, catalogVersionId),
          eq(exerciseCatalogVersions.status, 'ready'),
        ),
      ),
  ]);
  if (changedRows(results[1]) !== 1) {
    throw new CatalogActivationError({
      ...evaluation,
      ready: false,
      blockers: [
        ...evaluation.blockers,
        { code: 'catalog_not_ready', message: 'Catalog was no longer ready during activation.' },
      ],
    });
  }
  return { ...evaluation, activatedAt, actor: normalizedActor };
}

function changedRows(result: unknown): number {
  const changes = (result as { meta?: { changes?: unknown } })?.meta?.changes;
  return typeof changes === 'number' ? changes : 0;
}

function hasRequiredDerivedFields(exercise: {
  movementPattern: string;
  primaryMuscle: string | null;
  target: string | null;
  attributesJson: string | null;
}): boolean {
  if (!exercise.movementPattern.trim() || exercise.movementPattern === 'unclassified') return false;
  if (!exercise.primaryMuscle?.trim() || !exercise.target?.trim()) return false;
  if (!exercise.attributesJson?.trim()) return false;

  try {
    const attributes = derivedExerciseAttributesSchema.safeParse(
      JSON.parse(exercise.attributesJson),
    );
    return (
      attributes.success &&
      attributes.data.movementPattern !== 'unclassified' &&
      attributes.data.movementPattern === exercise.movementPattern
    );
  } catch {
    return false;
  }
}

function hasUnresolvedConflicts(
  evidenceJson: string | undefined,
  analysisVersion: string,
  expectedEvidenceCells: ReadonlySet<string>,
): boolean {
  if (!evidenceJson) return true;
  try {
    const evidence = analyzerEvidenceSchema.safeParse(JSON.parse(evidenceJson));
    if (!evidence.success) return true;
    const resolution = evidence.data.conflictResolution;
    return !(
      evidence.data.analysisVersion === analysisVersion &&
      resolution?.status === 'resolved' &&
      resolution.analysisVersion === analysisVersion &&
      Array.isArray(resolution.unresolvedConflicts) &&
      resolution.unresolvedConflicts.length === 0 &&
      hasExactAnalyzerEvidenceMatrix(evidence.data.ai.ratings, expectedEvidenceCells)
    );
  } catch {
    return true;
  }
}

function emptyEvaluation(
  catalogVersionId: string,
  blockers: CatalogActivationBlocker[],
): CatalogActivationEvaluation {
  return buildEvaluation(catalogVersionId, blockers, 0, 0, 0, 0);
}

function buildEvaluation(
  catalogVersionId: string,
  blockers: CatalogActivationBlocker[],
  totalExercises: number,
  approvedExercises: number,
  completeExercises: number,
  activeConsiderations: number,
  sourceRecordCount = 0,
  status: string | null = null,
  reviewRevision = 0,
): CatalogActivationEvaluation {
  return {
    catalogVersionId,
    status,
    sourceRecordCount,
    reviewRevision,
    ready: blockers.length === 0,
    blockers,
    coverage: {
      totalExercises,
      approvedExercises,
      completeExercises,
      activeConsiderations,
      expectedCellsPerExercise: activeConsiderations * 3,
    },
  };
}
