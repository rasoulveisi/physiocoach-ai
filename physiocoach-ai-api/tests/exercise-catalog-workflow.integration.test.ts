import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { createDb } from '../src/db/client';
import { createAdminCatalogRoutes } from '../src/routes/admin-catalog';
import { activateCatalogVersion, markCatalogReady } from '../src/services/catalog-activation';
import type { WorkerBindings } from '../src/env';
import type { AuthenticatedUser } from '../src/types/auth';
import { createSqliteD1 } from './support/sqlite-d1';

const execFile = promisify(execFileCallback);
const tsxPath = resolve(process.cwd(), 'node_modules/.bin/tsx');
const fixturePath = resolve(process.cwd(), 'tests/fixtures/exercises-dataset-sample.json');
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('exercise catalog import and enrichment workflow', { timeout: 15_000 }, () => {
  it('persists generated attributes and advances a fully classified import only to analyzing', async () => {
    const workflow = await runImportAndEnrichment(JSON.parse(await readFile(fixturePath, 'utf8')));

    expect(
      await query(workflow.databasePath, 'SELECT status FROM exercise_catalog_versions;'),
    ).toBe('analyzing');
    expect(
      await query(
        workflow.databasePath,
        "SELECT movement_pattern || '|' || json_extract(attributes_json, '$.movementPattern') FROM master_exercises WHERE name='Bodyweight Squat';",
      ),
    ).toBe('squat|squat');
    expect(
      await query(
        workflow.databasePath,
        "SELECT movement_pattern || '|' || json_extract(attributes_json, '$.loadedRegions[0]') FROM master_exercises WHERE name='Lever Chest Press';",
      ),
    ).toBe('push|shoulder');
    expect(workflow.summary.reviewRequired).toEqual([]);
  });

  it('keeps unknown movements unclassified, reports review, and never marks the catalog ready', async () => {
    const records = JSON.parse(await readFile(fixturePath, 'utf8')) as Array<
      Record<string, unknown>
    >;
    const baseRecord = records[0]!;
    records.push({
      ...baseRecord,
      id: '0003',
      name: 'Mysterious Motion',
      instructions: {
        ...(baseRecord.instructions as Record<string, string>),
        en: 'Move with control.',
      },
      instruction_steps: {
        ...(baseRecord.instruction_steps as Record<string, string[]>),
        en: ['Move with control.'],
      },
      body_part: 'whole body',
      muscle_group: 'general',
      secondary_muscles: [],
      target: 'general',
      equipment: 'body weight',
    });

    const workflow = await runImportAndEnrichment(records);

    expect(
      await query(workflow.databasePath, 'SELECT status FROM exercise_catalog_versions;'),
    ).toBe('analyzing');
    expect(
      await query(
        workflow.databasePath,
        "SELECT movement_pattern FROM master_exercises WHERE name='Mysterious Motion';",
      ),
    ).toBe('unclassified');
    expect(workflow.summary.reviewRequired).toContainEqual(
      expect.objectContaining({ type: 'unclassified' }),
    );
  });

  it('runs the guarded lifecycle through replacement and rollback snapshots on real SQLite', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'physiocoach-catalog-lifecycle-'));
    temporaryDirectories.push(directory);
    const databasePath = resolve(directory, 'catalog.sqlite');
    await applyMigrations(databasePath, directory);
    const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Array<
      Record<string, unknown>
    >;
    const reviewedRecords = [
      ...fixture,
      { ...fixture[0], id: '0003', name: 'Mysterious Motion' },
      { ...fixture[0], id: '0004' },
    ];

    const first = await importAnalyzeAndReview(
      databasePath,
      directory,
      reviewedRecords,
      'abcdef1',
      'lever chest press',
    );
    const db = createDb(createSqliteD1(databasePath));
    await expect(markCatalogReady(db, first)).resolves.toMatchObject({ status: 'ready' });
    await activateCatalogVersion(db, first, 'admin-1');

    const replacement = await importAnalyzeAndReview(databasePath, directory, fixture, 'abcdef2');
    await markCatalogReady(db, replacement);
    await activateCatalogVersion(db, replacement, 'admin-1');
    expect(
      await query(
        databasePath,
        `SELECT status FROM exercise_catalog_versions WHERE id='${first}';`,
      ),
    ).toBe('retired');

    // Rollback never reopens a retired row: it activates a newly reviewed snapshot.
    const rollback = await importAnalyzeAndReview(databasePath, directory, fixture, 'abcdef3');
    await markCatalogReady(db, rollback);
    await activateCatalogVersion(db, rollback, 'admin-1');
    expect(
      await query(
        databasePath,
        `SELECT status FROM exercise_catalog_versions WHERE id='${replacement}';`,
      ),
    ).toBe('retired');
    expect(
      await query(
        databasePath,
        `SELECT status FROM exercise_catalog_versions WHERE id='${rollback}';`,
      ),
    ).toBe('active');
    expect(
      await query(
        databasePath,
        `SELECT status FROM exercise_catalog_versions WHERE id='${first}';`,
      ),
    ).toBe('retired');
  }, 30_000);
});

async function importAnalyzeAndReview(
  databasePath: string,
  directory: string,
  records: Array<Record<string, unknown>>,
  commit: string,
  expectedDuplicateName?: string,
) {
  const stageDirectory = resolve(directory, commit);
  const datasetPath = resolve(stageDirectory, 'catalog.json');
  const outputPath = resolve(stageDirectory, 'output');
  await mkdir(stageDirectory, { recursive: true });
  await writeFile(datasetPath, JSON.stringify(records));
  await execFile(tsxPath, [
    'scripts/import-exercises-dataset.mjs',
    `--file=${datasetPath}`,
    `--commit=${commit}`,
    `--out=${outputPath}`,
  ]);
  const reportPath = resolve(outputPath, 'exercises-dataset-import-report.json');
  const report = JSON.parse(await readFile(reportPath, 'utf8')) as {
    summary: { catalogVersionId: string };
  };
  const catalogVersionId = report.summary.catalogVersionId;
  await execFile('sqlite3', [
    databasePath,
    `.read '${resolve(outputPath, 'exercises-dataset-import.sql')}'`,
  ]);
  const enrichmentPath = resolve(outputPath, 'enrichment.sql');
  await execFile(tsxPath, [
    'scripts/enrich-exercise-catalog.mjs',
    `--report=${reportPath}`,
    `--out=${enrichmentPath}`,
  ]);
  await execFile('sqlite3', [databasePath, `.read '${enrichmentPath}'`]);
  expect(
    await query(
      databasePath,
      `SELECT status FROM exercise_catalog_versions WHERE id='${catalogVersionId}';`,
    ),
  ).toBe('analyzing');

  const artifactPath = resolve(outputPath, 'safety.json');
  await execFile(tsxPath, [
    'scripts/analyze-exercise-safety.mjs',
    `--catalog=${datasetPath}`,
    `--out=${artifactPath}`,
    `--state=${resolve(outputPath, 'state.json')}`,
    '--provider=fake',
  ]);
  const safetySqlPath = resolve(outputPath, 'safety.sql');
  await execFile(tsxPath, [
    'scripts/import-exercise-safety.mjs',
    `--artifact=${artifactPath}`,
    `--catalog=${datasetPath}`,
    `--catalogVersionId=${catalogVersionId}`,
    `--out=${safetySqlPath}`,
  ]);
  await execFile('sqlite3', [databasePath, `.read '${safetySqlPath}'`]);
  expect(
    await query(
      databasePath,
      `SELECT status FROM exercise_catalog_versions WHERE id='${catalogVersionId}';`,
    ),
  ).toBe('review_required');

  const api = createAdminApp();
  const binding = { DB: createSqliteD1(databasePath) } as unknown as WorkerBindings;
  const exerciseIds = (
    await query(
      databasePath,
      `SELECT group_concat(id, ',') FROM master_exercises WHERE catalog_version_id='${catalogVersionId}';`,
    )
  )
    .split(',')
    .filter(Boolean);
  for (const exerciseId of exerciseIds) {
    const response = await api.request(
      `/api/v1/admin/exercises/${exerciseId}/safety`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rating: 'recommended',
          reason: 'Human-reviewed fixture safety matrix.',
          reviewedBy: 'admin-1',
          analysisVersion: 'safety-v1',
        }),
      },
      binding,
    );
    expect(response.status).toBe(200);
  }

  const unclassifiedId = await query(
    databasePath,
    `SELECT id FROM master_exercises WHERE catalog_version_id='${catalogVersionId}' AND movement_pattern='unclassified' LIMIT 1;`,
  );
  if (unclassifiedId) {
    const response = await api.request(
      `/api/v1/admin/exercises/${unclassifiedId}/catalog-metadata`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          catalogVersionId,
          movementPattern: 'core',
          attributes: completeCoreAttributes(),
          reason: 'Manual fixture classification.',
          reviewedBy: 'admin-1',
        }),
      },
      binding,
    );
    expect(response.status).toBe(200);
  }
  const duplicateNames = (
    await query(
      databasePath,
      `SELECT group_concat(normalized_name, '|') FROM exercise_duplicate_review_groups WHERE catalog_version_id='${catalogVersionId}' AND status='pending';`,
    )
  )
    .split('|')
    .filter(Boolean);
  if (expectedDuplicateName) expect(duplicateNames).toContain(expectedDuplicateName);
  for (const name of duplicateNames) {
    const response = await api.request(
      `/api/v1/admin/catalogs/${catalogVersionId}/duplicate-reviews/${encodeURIComponent(name)}/resolve`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reason: 'Both source exercises are intentional and retain distinct IDs.',
          reviewedBy: 'admin-1',
        }),
      },
      binding,
    );
    expect(response.status).toBe(200);
  }
  return catalogVersionId;
}

function completeCoreAttributes() {
  return {
    movementPattern: 'core',
    loadedRegions: [],
    impactLevel: 'low',
    spinalLoad: 'low',
    balanceDemand: 'low',
    technicalComplexity: 'beginner',
    overhead: false,
    behindNeck: false,
    deepFlexion: false,
    explosive: false,
    unilateral: false,
    rotational: false,
    inverted: false,
  };
}

function createAdminApp() {
  const app = new Hono<{ Bindings: WorkerBindings; Variables: { authUser: AuthenticatedUser } }>();
  app.use('*', async (c, next) => {
    c.set('authUser', {
      id: 'admin-1',
      email: 'admin@example.test',
      role: 'admin',
      roles: ['admin'],
    });
    await next();
  });
  app.route('/api/v1', createAdminCatalogRoutes());
  return app;
}

async function runImportAndEnrichment(records: unknown[]) {
  const directory = await mkdtemp(resolve(tmpdir(), 'physiocoach-catalog-workflow-'));
  temporaryDirectories.push(directory);
  const datasetPath = resolve(directory, 'catalog.json');
  const outputPath = resolve(directory, 'output');
  const databasePath = resolve(directory, 'catalog.sqlite');
  await writeFile(datasetPath, JSON.stringify(records));
  await execFile(tsxPath, [
    'scripts/import-exercises-dataset.mjs',
    `--file=${datasetPath}`,
    '--commit=abcdef1',
    `--out=${outputPath}`,
  ]);
  const reportPath = resolve(outputPath, 'exercises-dataset-import-report.json');
  const enrichmentPath = resolve(outputPath, 'exercise-enrichment.sql');
  const result = await execFile(tsxPath, [
    'scripts/enrich-exercise-catalog.mjs',
    `--report=${reportPath}`,
    `--out=${enrichmentPath}`,
  ]);

  await applyMigrations(databasePath, directory);
  await execFile('sqlite3', [
    databasePath,
    `.read '${resolve(outputPath, 'exercises-dataset-import.sql')}'`,
  ]);
  expect(await query(databasePath, 'SELECT status FROM exercise_catalog_versions;')).toBe(
    'importing',
  );
  await execFile('sqlite3', [databasePath, `.read '${enrichmentPath}'`]);
  return { databasePath, summary: JSON.parse(result.stdout) as { reviewRequired: unknown[] } };
}

async function applyMigrations(databasePath: string, directory: string) {
  const migrationsDirectory = resolve(process.cwd(), 'src/db/migrations');
  for (const filename of (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    const source = await readFile(resolve(migrationsDirectory, filename), 'utf8');
    const runnablePath = resolve(directory, filename);
    await writeFile(runnablePath, source.replaceAll('--> statement-breakpoint', ''));
    await execFile('sqlite3', [databasePath, `.read '${runnablePath}'`]);
  }
}

async function query(databasePath: string, sql: string) {
  return (await execFile('sqlite3', ['-noheader', databasePath, sql])).stdout.trim();
}
