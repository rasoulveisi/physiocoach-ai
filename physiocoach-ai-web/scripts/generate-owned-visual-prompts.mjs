import { mkdir, readFile, writeFile } from 'node:fs/promises';

const datasetPath = process.argv[2] ?? '../physiocoach-ai-api/seed-input/exercises.json';
const outputPath = process.argv[3] ?? 'docs/owned-visual-style/owned-visual-prompts.json';
const dataset = JSON.parse(await readFile(datasetPath, 'utf8'));
const style = 'Professional exercise anatomy illustration for PhysioCoach: a clean athletic human silhouette in a realistic exercise pose, neutral white background, restrained charcoal/slate body tones, translucent anatomical muscle overlays, active muscles highlighted in vivid orange-to-red with a subtle glow, accurate joint alignment and equipment, premium medical fitness app quality, centered full-body composition with generous margins, no labels, no text, no logo, no watermark.';

const clean = (value) => String(value ?? '').replaceAll(/\s+/g, ' ').trim();
const muscles = (exercise) => [exercise.target, exercise.muscle_group, ...(exercise.secondary_muscles ?? [])].map(clean).filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).slice(0, 5).join(', ');

const records = dataset.map((exercise) => ({
  sourceId: String(exercise.id),
  name: exercise.name,
  outputPath: `assets/generated/${String(exercise.id).padStart(4, '0')}.png`,
  status: 'prompt_only',
  prompt: `${style} Exercise: ${clean(exercise.name)}. Equipment: ${clean(exercise.equipment)}. Target and active muscles to highlight: ${muscles(exercise) || 'the primary muscles involved in this movement'}. Show the correct starting or working position clearly and keep the entire body and required equipment inside the frame.`,
}));

await mkdir(new URL('.', `file://${process.cwd()}/${outputPath}`).pathname, { recursive: true }).catch(() => {});
await writeFile(outputPath, `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), source: 'hasaneyldrm/exercises-dataset metadata only', style, count: records.length, exercises: records }, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, count: records.length }));
