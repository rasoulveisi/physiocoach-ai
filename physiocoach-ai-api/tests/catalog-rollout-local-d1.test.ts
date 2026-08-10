import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFile = promisify(execFileCallback);
const temporaryDirectories: string[] = [];
const repository = process.cwd();
const wrangler = resolve(repository, 'node_modules/.bin/wrangler');
const tsx = resolve(repository, 'node_modules/.bin/tsx');
const sourceCatalog = resolve(repository, 'tests/fixtures/exercises-dataset-sample.json');

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('catalog rollout generated SQL in local D1', { timeout: 30_000 }, () => {
  it('fails closed when a same-source-id safety artifact has a different persisted checksum', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'physiocoach-rollout-d1-'));
    temporaryDirectories.push(directory);
    const persistTo = resolve(directory, 'd1-state');
    const config = resolve(directory, 'wrangler.toml');
    const importCatalog = resolve(directory, 'catalog.json');
    const analysisCatalog = resolve(directory, 'catalog-with-same-ids.json');
    const output = resolve(directory, 'output');
    await writeFile(importCatalog, await readFile(sourceCatalog));
    await writeFile(analysisCatalog, `${await readFile(sourceCatalog, 'utf8')}\n`);
    await writeFile(
      config,
      [
        'name = "catalog-rollout-local-test"',
        'compatibility_date = "2026-07-31"',
        '',
        '[[d1_databases]]',
        'binding = "DB"',
        'database_name = "catalog_rollout_local_test"',
        'database_id = "00000000-0000-0000-0000-000000000000"',
        `migrations_dir = "${resolve(repository, 'src/db/migrations')}"`,
        '',
      ].join('\n'),
    );

    await d1(config, persistTo, ['migrations', 'apply', 'catalog_rollout_local_test', '--local']);
    await execFile(
      tsx,
      [
        'scripts/import-exercises-dataset.mjs',
        `--file=${importCatalog}`,
        '--commit=abc1234',
        `--out=${output}`,
      ],
      { cwd: repository },
    );
    const report = JSON.parse(
      await readFile(resolve(output, 'exercises-dataset-import-report.json'), 'utf8'),
    );
    const catalogVersionId = report.summary.catalogVersionId as string;
    await execFile(
      tsx,
      [
        'scripts/enrich-exercise-catalog.mjs',
        `--report=${resolve(output, 'exercises-dataset-import-report.json')}`,
        `--out=${resolve(output, 'exercise-enrichment.sql')}`,
      ],
      { cwd: repository },
    );
    await d1(config, persistTo, [
      'execute',
      'catalog_rollout_local_test',
      '--local',
      '--file',
      resolve(output, 'exercises-dataset-import.sql'),
    ]);
    await d1(config, persistTo, [
      'execute',
      'catalog_rollout_local_test',
      '--local',
      '--file',
      resolve(output, 'exercise-enrichment.sql'),
    ]);
    await execFile(
      tsx,
      [
        'scripts/analyze-exercise-safety.mjs',
        `--catalog=${analysisCatalog}`,
        `--state=${resolve(output, 'state.json')}`,
        `--out=${resolve(output, 'safety-analysis.json')}`,
        '--analysisVersion=safety-v1',
        '--provider=fake',
      ],
      { cwd: repository },
    );
    await execFile(
      tsx,
      [
        'scripts/import-exercise-safety.mjs',
        `--artifact=${resolve(output, 'safety-analysis.json')}`,
        `--catalog=${analysisCatalog}`,
        `--catalogVersionId=${catalogVersionId}`,
        `--out=${resolve(output, 'safety-import.sql')}`,
      ],
      { cwd: repository },
    );
    await expectGeneratedFilesToBeTransactionFree(output);
    await d1(config, persistTo, [
      'execute',
      'catalog_rollout_local_test',
      '--local',
      '--file',
      resolve(output, 'safety-import.sql'),
    ]);

    const result = await d1(config, persistTo, [
      'execute',
      'catalog_rollout_local_test',
      '--local',
      '--json',
      '--command',
      `SELECT status FROM exercise_catalog_versions WHERE id='${catalogVersionId}'; SELECT COUNT(*) AS profiles FROM exercise_safety_profiles; SELECT COUNT(*) AS ratings FROM exercise_consideration_ratings; SELECT COUNT(*) AS evidence FROM exercise_analysis_evidence; SELECT COUNT(*) AS runs FROM exercise_analysis_runs;`,
    ]);
    const statements = JSON.parse(result.stdout) as Array<{
      results: Array<Record<string, unknown>>;
    }>;
    expect(statements.map((statement) => statement.results[0])).toEqual([
      { status: 'analyzing' },
      { profiles: 0 },
      { ratings: 0 },
      { evidence: 0 },
      { runs: 0 },
    ]);
  });
});

async function expectGeneratedFilesToBeTransactionFree(output: string) {
  const files = ['exercises-dataset-import.sql', 'exercise-enrichment.sql', 'safety-import.sql'];
  const generated = await Promise.all(files.map((file) => readFile(resolve(output, file), 'utf8')));
  for (const sql of generated) expect(sql).not.toMatch(/\b(?:BEGIN|COMMIT)\b/i);
}

function d1(config: string, persistTo: string, args: string[]) {
  return execFile(wrangler, ['d1', ...args, '--config', config, '--persist-to', persistTo], {
    cwd: repository,
  });
}
