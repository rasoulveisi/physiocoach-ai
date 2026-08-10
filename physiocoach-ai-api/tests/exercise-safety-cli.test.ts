import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFile = promisify(execFileCallback);
const temporaryDirectories: string[] = [];
const catalogPath = resolve(process.cwd(), 'tests/fixtures/exercises-dataset-sample.json');
const tsxPath = resolve(process.cwd(), 'node_modules/.bin/tsx');

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createSubsetArtifact(
  includeExercises: boolean,
): Promise<{ directory: string; artifactPath: string }> {
  const directory = await mkdtemp(resolve(tmpdir(), 'physiocoach-safety-cli-'));
  temporaryDirectories.push(directory);
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as Array<{
    id: string;
    name: string;
  }>;
  const datasetSha256 = createHash('sha256')
    .update(await readFile(catalogPath))
    .digest('hex');
  const ratings = ['mild', 'moderate', 'severe'].map((severity) => ({
    considerationCode: 'shoulder_pain',
    severity,
    rating: 'recommended',
    reason: 'Subset-only test artifact.',
    confidence: 1,
    analysisSource: 'ai',
    ruleCodes: [],
  }));
  const artifact = {
    schemaVersion: '1.0',
    datasetSha256,
    analysisVersion: 'safety-v1',
    model: 'fake',
    generatedAt: '2026-07-31T00:00:00.000Z',
    considerations: [{ id: 'bc_shoulder_pain', code: 'shoulder_pain' }],
    exercises: includeExercises
      ? catalog.map((exercise) => ({
          sourceId: exercise.id,
          name: exercise.name,
          coverageComplete: true,
          unresolvedConflicts: [],
          ratings,
          globalRating: 'recommended',
          confidence: 1,
          summaryReason: 'Subset-only test artifact.',
          analysisSource: 'hybrid',
        }))
      : [],
  };
  const artifactPath = resolve(directory, 'analysis.json');
  await writeFile(artifactPath, JSON.stringify(artifact));
  return { directory, artifactPath };
}

describe('exercise safety CLI active-consideration validation', { timeout: 15_000 }, () => {
  it('rejects a resumable artifact that omits active considerations', async () => {
    const { directory, artifactPath } = await createSubsetArtifact(false);

    await expect(
      execFile(tsxPath, [
        'scripts/analyze-exercise-safety.mjs',
        `--catalog=${catalogPath}`,
        `--out=${artifactPath}`,
        `--state=${resolve(directory, 'state.json')}`,
        '--provider=fake',
      ]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('must include exactly the active considerations'),
    });
  });

  it('rejects an import artifact that omits active considerations', async () => {
    const { directory, artifactPath } = await createSubsetArtifact(true);

    await expect(
      execFile(tsxPath, [
        'scripts/import-exercise-safety.mjs',
        `--artifact=${artifactPath}`,
        `--catalog=${catalogPath}`,
        '--catalogVersionId=catalog_test',
        `--out=${resolve(directory, 'import.sql')}`,
      ]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('must include exactly the active considerations'),
    });
  });

  it('imports analyzer evidence that contains a resolved-conflict declaration', async () => {
    const { artifactPath, directory } = await createCompleteArtifact();
    const sqlPath = resolve(directory, 'import.sql');
    await execFile(tsxPath, [
      'scripts/import-exercise-safety.mjs',
      `--artifact=${artifactPath}`,
      `--catalog=${catalogPath}`,
      '--catalogVersionId=catalog_test',
      `--out=${sqlPath}`,
    ]);

    const sql = await readFile(sqlPath, 'utf8');
    expect(sql).toContain('"conflictResolution":{"status":"resolved"');
    expect(sql).toContain(
      "UPDATE exercise_catalog_versions SET status='review_required', review_revision=review_revision+1 WHERE id='catalog_test' AND dataset_sha256='",
    );
    expect(sql).toContain("AND status='analyzing' AND analysis_version='safety-v1';");
    expect(sql).toMatch(/INSERT INTO exercise_safety_profiles[\s\S]*dataset_sha256='/);
    const writes = sql
      .split('\n')
      .filter((statement) =>
        /^(?:INSERT INTO exercise_|UPDATE exercise_catalog_versions)/.test(statement),
      );
    expect(writes.length).toBeGreaterThan(0);
    expect(
      writes.every(
        (statement) =>
          statement.includes("id='catalog_test'") &&
          statement.includes("dataset_sha256='") &&
          statement.includes("status='analyzing'") &&
          statement.includes("analysis_version='safety-v1'"),
      ),
    ).toBe(true);
    expect(sql).not.toMatch(/\b(?:BEGIN|COMMIT)\b/i);
    expect(sql).not.toContain("status='ready'");
  });

  it('rejects an artifact with a missing conflict-resolution declaration', async () => {
    const { artifact, artifactPath, directory } = await createCompleteArtifact();
    for (const exercise of artifact.exercises) {
      delete exercise.evidence?.conflictResolution;
    }
    await writeFile(artifactPath, JSON.stringify(artifact));

    await expect(
      importArtifact(artifactPath, resolve(directory, 'import.sql')),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('conflict-resolution proof'),
    });
  });

  it('rejects an artifact with malformed conflict-resolution proof', async () => {
    const { artifact, artifactPath, directory } = await createCompleteArtifact();
    for (const exercise of artifact.exercises) {
      exercise.evidence.conflictResolution = {
        status: 'resolved',
        analysisVersion: 'wrong-version',
        unresolvedConflicts: [],
      };
    }
    await writeFile(artifactPath, JSON.stringify(artifact));

    await expect(
      importArtifact(artifactPath, resolve(directory, 'import.sql')),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('conflict-resolution proof'),
    });
  });

  it('rejects a proof-only evidence envelope without analyzer AI and deterministic evidence', async () => {
    const { artifact, artifactPath, directory } = await createCompleteArtifact();
    for (const exercise of artifact.exercises) {
      exercise.evidence = { conflictResolution: exercise.evidence.conflictResolution };
    }
    await writeFile(artifactPath, JSON.stringify(artifact));

    await expect(
      importArtifact(artifactPath, resolve(directory, 'import.sql')),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('complete analyzer evidence'),
    });
  });

  it('rejects analyzer evidence whose AI matrix omits required cells', async () => {
    const { artifact, artifactPath, directory } = await createCompleteArtifact();
    for (const exercise of artifact.exercises) {
      (exercise.evidence as { ai: { ratings: unknown[] } }).ai.ratings = [];
    }
    await writeFile(artifactPath, JSON.stringify(artifact));

    await expect(
      importArtifact(artifactPath, resolve(directory, 'import.sql')),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('complete analyzer evidence'),
    });
  });
});

async function createCompleteArtifact() {
  const directory = await mkdtemp(resolve(tmpdir(), 'physiocoach-safety-cli-'));
  temporaryDirectories.push(directory);
  const artifactPath = resolve(directory, 'analysis.json');
  await execFile(tsxPath, [
    'scripts/analyze-exercise-safety.mjs',
    `--catalog=${catalogPath}`,
    `--out=${artifactPath}`,
    `--state=${resolve(directory, 'state.json')}`,
    '--provider=fake',
  ]);
  return {
    directory,
    artifactPath,
    artifact: JSON.parse(await readFile(artifactPath, 'utf8')) as {
      exercises: Array<{
        evidence: Record<string, unknown>;
      }>;
    },
  };
}

function importArtifact(artifactPath: string, sqlPath: string) {
  return execFile(tsxPath, [
    'scripts/import-exercise-safety.mjs',
    `--artifact=${artifactPath}`,
    `--catalog=${catalogPath}`,
    '--catalogVersionId=catalog_test',
    `--out=${sqlPath}`,
  ]);
}
