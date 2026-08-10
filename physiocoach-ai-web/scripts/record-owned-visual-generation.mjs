import { access, mkdir, readFile, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const manifestPath = process.argv[2] ?? 'docs/owned-visual-style/owned-visual-prompts.json';
const sourceId = process.argv[3];
const generatedPath = process.argv[4];
if (!sourceId || !generatedPath) throw new Error('Usage: node scripts/record-owned-visual-generation.mjs <manifest> <sourceId> <generated-file>');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const exercise = manifest.exercises.find((item) => item.sourceId === sourceId);
if (!exercise) throw new Error(`Unknown sourceId: ${sourceId}`);
await access(generatedPath);
const output = path.resolve(path.dirname(manifestPath), exercise.outputPath);
await mkdir(path.dirname(output), { recursive: true });
await copyFile(generatedPath, output);
exercise.status = 'generated';
exercise.generatedAt = new Date().toISOString();
exercise.assetSha256 = null;
manifest.updatedAt = new Date().toISOString();
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ sourceId, outputPath: exercise.outputPath, status: exercise.status }));
