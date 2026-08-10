import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  buildExerciseDatasetImportSql,
  mapExerciseDataset,
} from '../src/services/exercise-dataset-mapper.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT_DIR = resolve(SCRIPT_DIR, '..', 'seed-output');

export function isGitCommitSha(value) {
  return /^[0-9a-f]{7,40}$/i.test(value);
}

function parseCliArgs(argv) {
  return Object.fromEntries(
    argv
      .filter((argument) => argument.startsWith('--'))
      .map((argument) => argument.slice(2).split(/=(.*)/s, 2))
      .map(([key, value]) => [key, value ?? 'true']),
  );
}

export async function runExerciseDatasetImport(cliArgs = parseCliArgs(process.argv.slice(2))) {
  if (cliArgs.help) {
    console.log(
      'Usage: pnpm import:exercises-dataset -- --file=PATH --commit=SHA [--out=DIR] [--dryRun]',
    );
    return null;
  }
  if (!cliArgs.file) throw new Error('Missing required --file=PATH option.');
  if (!cliArgs.commit || cliArgs.commit === 'true')
    throw new Error('Missing required --commit=SHA option.');
  if (!isGitCommitSha(cliArgs.commit))
    throw new Error('--commit must be a 7-to-40 character Git SHA.');

  const inputFile = resolve(process.cwd(), cliArgs.file);
  const bytes = await readFile(inputFile);
  const records = JSON.parse(bytes.toString('utf8'));
  if (!Array.isArray(records)) throw new Error('Dataset file must contain a JSON array.');
  const imported = mapExerciseDataset(records, {
    sourceCommitSha: cliArgs.commit,
    datasetSha256: createHash('sha256').update(bytes).digest('hex'),
    importedAt: new Date().toISOString(),
  });
  const summary = {
    accounted: imported.accounted,
    imported: imported.exercises.length,
    rejected: imported.rejected.length,
    media: imported.media.length,
    duplicateNameGroups: imported.duplicateNameGroups.length,
    catalogVersionId: imported.catalogVersion.id,
  };

  if (!cliArgs.dryRun) {
    const outDir = resolve(process.cwd(), cliArgs.out ?? DEFAULT_OUT_DIR);
    await mkdir(outDir, { recursive: true });
    await Promise.all([
      writeFile(
        resolve(outDir, 'exercises-dataset-import-report.json'),
        `${JSON.stringify({ summary, ...imported }, null, 2)}\n`,
      ),
      writeFile(
        resolve(outDir, 'exercises-dataset-import.sql'),
        `${buildExerciseDatasetImportSql(imported)}\n`,
      ),
    ]);
  }
  console.log(JSON.stringify(summary));
  return { summary, imported };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runExerciseDatasetImport().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
