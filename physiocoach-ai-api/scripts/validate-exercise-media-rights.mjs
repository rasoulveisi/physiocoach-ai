import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import process from 'node:process';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => arg.slice(2).split(/=(.*)/s, 2)),
);

if (!args.dataset || !args.manifest) {
  throw new Error(
    'Usage: node scripts/validate-exercise-media-rights.mjs --dataset=PATH --manifest=PATH',
  );
}

const datasetBytes = await readFile(args.dataset);
const dataset = JSON.parse(datasetBytes.toString('utf8'));
const manifest = JSON.parse(await readFile(args.manifest, 'utf8'));
if (!Array.isArray(dataset)) throw new Error('Dataset must be a JSON array.');

const errors = [];
const datasetSha256 = createHash('sha256').update(datasetBytes).digest('hex');
if (manifest.datasetSha256 !== datasetSha256)
  errors.push(`datasetSha256 mismatch: expected ${datasetSha256}`);
if (!manifest.rightsHolder?.trim()) errors.push('rightsHolder is required.');
if (!/gym\s*visual/i.test(manifest.rightsHolder ?? ''))
  errors.push('rightsHolder must identify Gym Visual, the media copyright holder.');
if (!manifest.permissionDocument?.trim()) errors.push('permissionDocument is required.');
if (!['noncommercial_learning', 'commercial_app'].includes(manifest.useProfile)) {
  errors.push('useProfile must be noncommercial_learning or commercial_app.');
}
if (typeof manifest.commercialUse !== 'boolean')
  errors.push('commercialUse must be explicitly true or false.');
if (manifest.useProfile === 'commercial_app' && manifest.commercialUse !== true)
  errors.push('commercial_app requires commercialUse=true.');
if (manifest.useProfile === 'noncommercial_learning' && manifest.commercialUse !== false)
  errors.push('noncommercial_learning requires commercialUse=false.');
if (!manifest.assets?.images || !manifest.assets?.gifs)
  errors.push('The manifest must authorize both images and GIFs.');
if (manifest.attributionTemplate !== '© Gym visual — https://gymvisual.com/') {
  errors.push('attributionTemplate must preserve the required Gym Visual attribution exactly.');
}
if (manifest.maxResolution?.width !== 180 || manifest.maxResolution?.height !== 180) {
  errors.push('maxResolution must be exactly 180x180 for the dataset media terms.');
}
if (manifest.healthSensitiveUse !== true)
  errors.push('healthSensitiveUse must be explicitly authorized by Gym Visual.');
if (manifest.aiPlatformUse !== true)
  errors.push('aiPlatformUse must be explicitly authorized by Gym Visual.');
if (manifest.redistribution !== false)
  errors.push('redistribution must be false; the media may not be redistributed.');

const sourceIds = new Set(dataset.map((record) => String(record.id)));
const allowedIds = Array.isArray(manifest.allowedSourceIds)
  ? new Set(manifest.allowedSourceIds.map(String))
  : sourceIds;
const missing = [...sourceIds].filter((id) => !allowedIds.has(id));
if (missing.length)
  errors.push(`${missing.length} dataset records are not licensed in the manifest.`);

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors, datasetRecords: dataset.length }, null, 2));
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        ok: true,
        datasetRecords: dataset.length,
        rightsHolder: manifest.rightsHolder,
        commercialUse: manifest.commercialUse,
        assets: manifest.assets,
        permissionDocument: manifest.permissionDocument,
      },
      null,
      2,
    ),
  );
}
