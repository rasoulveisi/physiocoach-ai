import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join, normalize, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import process from 'node:process';

const execFileAsync = promisify(execFile);
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => arg.slice(2).split(/=(.*)/s, 2)),
);

if (
  !args.dataset ||
  !args.manifest ||
  !args.mediaRoot ||
  !args.report ||
  !args.out ||
  !args.baseUrl
) {
  throw new Error(
    'Usage: node scripts/prepare-licensed-exercise-media.mjs --dataset=PATH --manifest=PATH --mediaRoot=DIR --report=PATH --out=PATH --baseUrl=URL',
  );
}

await execFileAsync(process.execPath, [
  'scripts/validate-exercise-media-rights.mjs',
  `--dataset=${args.dataset}`,
  `--manifest=${args.manifest}`,
]);

const dataset = JSON.parse(await readFile(args.dataset, 'utf8'));
const report = JSON.parse(await readFile(args.report, 'utf8'));
const manifest = JSON.parse(await readFile(args.manifest, 'utf8'));
const exerciseBySourceId = new Map(
  report.exercises.map((exercise) => [String(exercise.sourceId), exercise]),
);
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const now = new Date().toISOString();
const rows = [];

for (const record of dataset) {
  const exercise = exerciseBySourceId.get(String(record.id));
  if (!exercise) throw new Error(`No imported catalog exercise for source ID ${record.id}`);
  for (const media of [
    { type: 'image', sourcePath: record.image, extension: 'jpg' },
    { type: 'gif', sourcePath: record.gif_url, extension: 'gif' },
  ]) {
    const cleanPath = normalize(String(media.sourcePath)).replaceAll('\\', '/');
    if (cleanPath.startsWith('../') || cleanPath.includes('/../'))
      throw new Error(`Unsafe media path: ${media.sourcePath}`);
    const filePath = join(args.mediaRoot, cleanPath);
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error(`Media path is not a file: ${filePath}`);
    const bytes = await readFile(filePath);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const objectKey = `exercises/${record.id}/${media.type}.${media.extension}`;
    const storageUrl = `${args.baseUrl.replace(/\/$/, '')}/${objectKey}`;
    const id = `media_licensed_${record.id}_${media.type}`;
    rows.push(
      `INSERT OR REPLACE INTO exercise_media (id, exercise_id, storage_url, media_type, width_px, height_px, alt_text, storage_provider, object_key, content_hash, ownership_status, review_status, version, source, source_id, license_name, license_author, attribution_text, created_at, updated_at) VALUES (${quote(id)}, ${quote(exercise.id)}, ${quote(storageUrl)}, ${quote(media.type)}, 180, 180, ${quote(`${record.name} ${media.type}`)}, 'r2', ${quote(objectKey)}, ${quote(hash)}, 'licensed', 'approved', 1, 'hasaneyldrm_exercises_dataset', ${quote(record.id)}, ${quote(manifest.permissionDocument)}, ${quote(manifest.rightsHolder)}, ${quote(manifest.attributionTemplate)}, ${quote(now)}, ${quote(now)});`,
    );
  }
}

await writeFile(args.out, `${rows.join('\n')}\n`);
console.log(
  JSON.stringify({
    ok: true,
    datasetRecords: dataset.length,
    mediaRows: rows.length,
    catalogVersionId: report.summary.catalogVersionId,
    output: relative(process.cwd(), args.out),
  }),
);
