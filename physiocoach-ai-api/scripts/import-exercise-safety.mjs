import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { sourceExerciseSchema } from '../src/services/exercise-dataset-mapper.ts';
import {
  analyzerEvidenceSchema,
  conflictResolutionSchema,
  hasExactAnalyzerEvidenceMatrix,
} from '../src/services/exercise-safety-analyzer.ts';
import { INITIAL_BODY_CONSIDERATIONS } from '../src/types/exercise-safety-catalog.ts';

const severities = ['mild', 'moderate', 'severe'];
const ratings = new Set(['recommended', 'caution', 'avoid']);
const ratingRank = { recommended: 0, caution: 1, avoid: 2 };
const ACTIVE_CONSIDERATIONS_BY_CODE = new Map(
  INITIAL_BODY_CONSIDERATIONS.map(({ code }) => [code, `bc_${code}`]),
);

export function parseCliArgs(argv) {
  return Object.fromEntries(
    argv
      .filter((argument) => argument.startsWith('--'))
      .map((argument) => argument.slice(2).split(/=(.*)/s, 2))
      .map(([key, value]) => [key, value ?? 'true']),
  );
}

function sqlValue(value) {
  if (value === undefined || value === null || value === '') return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function guardedInsert(table, values, catalogVersionId, datasetSha256, analysisVersion) {
  const columns = Object.keys(values);
  const escapedCatalogId = String(catalogVersionId).replaceAll("'", "''");
  const escapedAnalysisVersion = String(analysisVersion).replaceAll("'", "''");
  const escapedDatasetSha256 = String(datasetSha256).replaceAll("'", "''");
  return `INSERT INTO ${table} (${columns.join(', ')}) SELECT ${columns.map((column) => sqlValue(values[column])).join(', ')} WHERE EXISTS (SELECT 1 FROM exercise_catalog_versions WHERE id='${escapedCatalogId}' AND dataset_sha256='${escapedDatasetSha256}' AND status='analyzing' AND analysis_version='${escapedAnalysisVersion}');`;
}

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_]+/g, '_');
}

function expectedCells(considerations) {
  return new Set(
    considerations.flatMap((consideration) =>
      severities.map((severity) => `${consideration.code}:${severity}`),
    ),
  );
}

function assertExactActiveConsiderations(considerations) {
  if (
    !Array.isArray(considerations) ||
    considerations.length !== ACTIVE_CONSIDERATIONS_BY_CODE.size ||
    new Set(considerations.map((consideration) => consideration?.code)).size !==
      ACTIVE_CONSIDERATIONS_BY_CODE.size ||
    considerations.some(
      (consideration) =>
        !consideration ||
        ACTIVE_CONSIDERATIONS_BY_CODE.get(consideration.code) !== consideration.id,
    )
  ) {
    throw new Error('Analysis artifact must include exactly the active considerations.');
  }
}

function validateArtifact(artifact, catalogChecksum, catalogSourceIds) {
  if (!artifact || typeof artifact !== 'object')
    throw new Error('Analysis artifact must be an object.');
  if (artifact.datasetSha256 !== catalogChecksum)
    throw new Error('Analysis artifact has a mismatched dataset checksum.');
  assertExactActiveConsiderations(artifact.considerations);
  const considerations = artifact.considerations.map((consideration) => {
    return { id: consideration.id, code: consideration.code };
  });
  if (!Array.isArray(artifact.exercises))
    throw new Error('Analysis artifact exercises must be an array.');
  if (artifact.exercises.length !== catalogSourceIds.size)
    throw new Error('Analysis artifact does not contain every catalog exercise.');
  const cells = expectedCells(considerations);
  const sourceIds = new Set();
  for (const exercise of artifact.exercises) {
    if (
      !exercise ||
      typeof exercise.sourceId !== 'string' ||
      !catalogSourceIds.has(exercise.sourceId)
    ) {
      throw new Error('Analysis artifact contains an exercise absent from the catalog.');
    }
    if (sourceIds.has(exercise.sourceId))
      throw new Error(`Analysis artifact contains duplicate source ID: ${exercise.sourceId}.`);
    sourceIds.add(exercise.sourceId);
    if (exercise.coverageComplete !== true)
      throw new Error(`Safety matrix coverage is incomplete for ${exercise.sourceId}.`);
    if (!Array.isArray(exercise.unresolvedConflicts) || exercise.unresolvedConflicts.length !== 0) {
      throw new Error(`Analysis artifact has unresolved conflicts for ${exercise.sourceId}.`);
    }
    assertAnalyzerEvidence(exercise, artifact.analysisVersion, cells);
    if (!Array.isArray(exercise.ratings))
      throw new Error(`Safety matrix coverage is incomplete for ${exercise.sourceId}.`);
    const exerciseCells = new Set();
    for (const rating of exercise.ratings) {
      const key = `${rating?.considerationCode}:${rating?.severity}`;
      if (
        !cells.has(key) ||
        exerciseCells.has(key) ||
        !ratings.has(rating?.rating) ||
        !String(rating?.reason ?? '').trim()
      ) {
        throw new Error(`Safety matrix coverage is incomplete for ${exercise.sourceId}.`);
      }
      exerciseCells.add(key);
    }
    if (exerciseCells.size !== cells.size)
      throw new Error(`Safety matrix coverage is incomplete for ${exercise.sourceId}.`);
    for (const consideration of considerations) {
      let previousRank = -1;
      for (const severity of severities) {
        const rating = exercise.ratings.find(
          (item) => item.considerationCode === consideration.code && item.severity === severity,
        );
        const currentRank = ratingRank[rating.rating];
        if (currentRank < previousRank)
          throw new Error(`Safety ratings are non-monotonic for ${exercise.sourceId}.`);
        previousRank = currentRank;
      }
    }
  }
  return considerations;
}

function assertAnalyzerEvidence(exercise, analysisVersion, expectedCells) {
  if (
    !exercise.evidence ||
    typeof exercise.evidence !== 'object' ||
    Array.isArray(exercise.evidence)
  ) {
    throw new Error(
      `Analysis artifact is missing conflict-resolution proof for ${exercise.sourceId}.`,
    );
  }
  const parsed = conflictResolutionSchema.safeParse(exercise.evidence.conflictResolution);
  if (!parsed.success || parsed.data.analysisVersion !== analysisVersion) {
    throw new Error(
      `Analysis artifact has invalid conflict-resolution proof for ${exercise.sourceId}.`,
    );
  }
  if (
    exercise.evidence.unresolvedConflicts !== undefined &&
    (!Array.isArray(exercise.evidence.unresolvedConflicts) ||
      exercise.evidence.unresolvedConflicts.length !== 0)
  ) {
    throw new Error(
      `Analysis artifact has inconsistent conflict-resolution proof for ${exercise.sourceId}.`,
    );
  }
  const evidence = analyzerEvidenceSchema.safeParse(exercise.evidence);
  if (
    !evidence.success ||
    evidence.data.analysisVersion !== analysisVersion ||
    exercise.analysisVersion !== analysisVersion ||
    evidence.data.inputHash !== exercise.inputHash
  ) {
    throw new Error(
      `Analysis artifact is missing complete analyzer evidence for ${exercise.sourceId}.`,
    );
  }
  if (!hasExactAnalyzerEvidenceMatrix(evidence.data.ai.ratings, expectedCells)) {
    throw new Error(
      `Analysis artifact is missing complete analyzer evidence for ${exercise.sourceId}.`,
    );
  }
}

export function buildExerciseSafetyImportSql(artifact, options) {
  const timestamp = options.importedAt;
  const runId = `analysis_run_${safeId(options.catalogVersionId)}_${safeId(artifact.analysisVersion)}_${artifact.datasetSha256.slice(0, 16)}`;
  const reviewRequiredCount = artifact.exercises.length;
  const lines = [
    guardedInsert(
      'exercise_analysis_runs',
      {
        id: runId,
        catalog_version_id: options.catalogVersionId,
        analysis_version: artifact.analysisVersion,
        status: 'review_required',
        processed_count: artifact.exercises.length,
        approved_count: 0,
        rejected_count: 0,
        review_required_count: reviewRequiredCount,
        started_at: artifact.generatedAt ?? timestamp,
        completed_at: timestamp,
        last_error: null,
        created_at: timestamp,
        updated_at: timestamp,
      },
      options.catalogVersionId,
      artifact.datasetSha256,
      artifact.analysisVersion,
    ),
  ];
  for (const exercise of artifact.exercises) {
    const exerciseId = `ex_${options.catalogVersionId}_${exercise.sourceId}`;
    lines.push(
      guardedInsert(
        'exercise_safety_profiles',
        {
          exercise_id: exerciseId,
          analysis_version: artifact.analysisVersion,
          review_status: 'pending',
          global_rating: exercise.globalRating,
          coverage_complete: 1,
          confidence: exercise.confidence,
          summary_reason: exercise.summaryReason,
          analysis_source: exercise.analysisSource ?? 'hybrid',
          manual_override: 0,
          reviewed_by: null,
          reviewed_at: null,
          created_at: timestamp,
          updated_at: timestamp,
        },
        options.catalogVersionId,
        artifact.datasetSha256,
        artifact.analysisVersion,
      ),
    );
    for (const rating of exercise.ratings) {
      const consideration = options.considerationsByCode.get(rating.considerationCode);
      lines.push(
        guardedInsert(
          'exercise_consideration_ratings',
          {
            id: `rating_${safeId(runId)}_${safeId(exercise.sourceId)}_${safeId(rating.considerationCode)}_${rating.severity}`,
            exercise_id: exerciseId,
            consideration_id: consideration.id,
            severity: rating.severity,
            rating: rating.rating,
            reason: rating.reason,
            required_modification: rating.requiredModification ?? null,
            confidence: rating.confidence,
            analysis_source: rating.analysisSource,
            rule_codes_json: JSON.stringify(rating.ruleCodes ?? []),
            analysis_version: artifact.analysisVersion,
            manual_override: 0,
            created_at: timestamp,
            updated_at: timestamp,
          },
          options.catalogVersionId,
          artifact.datasetSha256,
          artifact.analysisVersion,
        ),
      );
    }
    lines.push(
      guardedInsert(
        'exercise_analysis_evidence',
        {
          id: `evidence_${safeId(runId)}_${safeId(exercise.sourceId)}`,
          exercise_id: exerciseId,
          analysis_run_id: runId,
          analysis_version: artifact.analysisVersion,
          evidence_json: JSON.stringify(exercise.evidence),
          created_at: timestamp,
        },
        options.catalogVersionId,
        artifact.datasetSha256,
        artifact.analysisVersion,
      ),
    );
  }
  lines.push(
    `UPDATE exercise_catalog_versions SET status='review_required', review_revision=review_revision+1 WHERE id='${String(options.catalogVersionId).replaceAll("'", "''")}' AND dataset_sha256='${String(artifact.datasetSha256).replaceAll("'", "''")}' AND status='analyzing' AND analysis_version='${String(artifact.analysisVersion).replaceAll("'", "''")}';`,
  );
  return lines.join('\n');
}

/** Validates a completed artifact against its exact catalog snapshot and emits additive review SQL. */
export async function runExerciseSafetyImport(cliArgs = parseCliArgs(process.argv.slice(2))) {
  if (cliArgs.help) {
    console.log(
      'Usage: import:exercise-safety -- --artifact=PATH --catalog=PATH --catalogVersionId=ID --out=PATH',
    );
    return null;
  }
  for (const option of ['artifact', 'catalog', 'catalogVersionId', 'out']) {
    if (!cliArgs[option] || cliArgs[option] === 'true')
      throw new Error(`Missing required --${option} option.`);
  }
  const artifactPath = resolve(process.cwd(), cliArgs.artifact);
  const catalogPath = resolve(process.cwd(), cliArgs.catalog);
  const outPath = resolve(process.cwd(), cliArgs.out);
  const catalogBytes = await readFile(catalogPath);
  const rawCatalog = JSON.parse(catalogBytes.toString('utf8'));
  if (!Array.isArray(rawCatalog)) throw new Error('Catalog must contain a JSON array.');
  const catalogSourceIds = new Set(
    rawCatalog.map((record) => sourceExerciseSchema.parse(record).id),
  );
  if (catalogSourceIds.size !== rawCatalog.length)
    throw new Error('Catalog contains duplicate source IDs.');
  const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
  const considerations = validateArtifact(
    artifact,
    createHash('sha256').update(catalogBytes).digest('hex'),
    catalogSourceIds,
  );
  const importedAt = new Date().toISOString();
  const sql = buildExerciseSafetyImportSql(artifact, {
    catalogVersionId: cliArgs.catalogVersionId,
    considerationsByCode: new Map(
      considerations.map((consideration) => [consideration.code, consideration]),
    ),
    importedAt,
  });
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${sql}\n`);
  const summary = {
    exercises: artifact.exercises.length,
    ratings: artifact.exercises.reduce((count, exercise) => count + exercise.ratings.length, 0),
    out: outPath,
  };
  console.log(JSON.stringify(summary));
  return { summary, sql };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runExerciseSafetyImport().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
