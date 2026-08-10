import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { deriveExerciseAttributes } from '../src/services/exercise-attribute-deriver.ts';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => arg.slice(2).split(/=(.*)/s, 2)),
);
if (!args.report || !args.out)
  throw new Error('Usage: enrich:exercise-catalog -- --report=PATH --out=PATH');
const report = JSON.parse(await readFile(resolve(args.report), 'utf8'));
const exercises = report.exercises ?? report.imported?.exercises;
if (!Array.isArray(exercises)) throw new Error('Import report must contain mapped exercises.');
const duplicates = report.duplicateNameGroups ?? report.imported?.duplicateNameGroups ?? [];
const enriched = exercises.map((exercise) => {
  const attributes = deriveExerciseAttributes({
    name: exercise.name,
    instructions: exercise.instructions,
    target: exercise.target,
    primaryMuscle: exercise.primaryMuscle,
    bodyPart: exercise.bodyPart,
  });
  return { id: exercise.id, movementPattern: attributes.movementPattern, attributes };
});
const reviewRequired = [
  ...duplicates.map((group) => ({ type: 'duplicate_name', ...group })),
  ...enriched
    .filter((item) => item.movementPattern === 'unclassified')
    .map((item) => ({ type: 'unclassified', exerciseId: item.id })),
];
const catalogVersionId = report.summary?.catalogVersionId ?? report.catalogVersion?.id;
if (typeof catalogVersionId !== 'string' || !catalogVersionId.trim()) {
  throw new Error('Import report must contain a catalog version ID.');
}
const sql = enriched
  .map(
    (item) =>
      `UPDATE master_exercises SET movement_pattern='${item.movementPattern}', attributes_json='${JSON.stringify(item.attributes).replaceAll("'", "''")}', updated_at=datetime('now') WHERE id='${item.id.replaceAll("'", "''")}' AND catalog_version_id='${catalogVersionId.replaceAll("'", "''")}' AND EXISTS (SELECT 1 FROM exercise_catalog_versions WHERE id='${catalogVersionId.replaceAll("'", "''")}' AND status IN ('importing', 'analyzing'));`,
  )
  .join('\n');
const statusSql = `UPDATE exercise_catalog_versions SET status='analyzing', review_revision=review_revision+1 WHERE id='${catalogVersionId.replaceAll("'", "''")}' AND status IN ('importing', 'analyzing');`;
await writeFile(resolve(args.out), `${sql}\n${statusSql}\n`);
console.log(
  JSON.stringify({
    accounted: exercises.length,
    enriched: enriched.length,
    reviewRequired,
    autoApproved: 0,
  }),
);
