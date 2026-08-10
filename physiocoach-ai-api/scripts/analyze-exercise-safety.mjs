import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { analyzeExerciseSafety } from '../src/services/exercise-safety-analyzer.ts';
import { sourceExerciseSchema } from '../src/services/exercise-dataset-mapper.ts';
import { OpenRouterProvider } from '../src/services/openrouter-provider.ts';
import { INITIAL_BODY_CONSIDERATIONS } from '../src/types/exercise-safety-catalog.ts';

const DEFAULT_ANALYSIS_VERSION = 'safety-v1';
const DEFAULT_MODEL = 'google/gemma-4-26b-a4b-it:free';
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

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function replaceFileAtomically(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporaryPath, `${JSON.stringify(contents, null, 2)}\n`);
  await rename(temporaryPath, path);
}

function createFakeProvider() {
  return {
    generateWorkoutPlan: async () => ({ model: 'fake', text: '' }),
    generateStructured: async (request) => {
      const prompt = JSON.parse(request.prompt);
      const payload = {
        schemaVersion: '1.0',
        ratings: Object.fromEntries(
          prompt.considerations.map((consideration) => [
            consideration.code,
            {
              mild: 'recommended',
              moderate: 'recommended',
              severe: 'recommended',
              reason: 'Deterministic fake-provider classification for offline artifact validation.',
              requiredModification: 'None required for the offline test fixture.',
              confidence: 1,
            },
          ]),
        ),
        summaryReason: 'Deterministic fake-provider analysis; requires human safety review.',
        confidence: 1,
      };
      return { model: 'fake', payload: request.schema.parse(payload) };
    },
  };
}

function createLocalProvider() {
  return {
    generateWorkoutPlan: async () => ({ model: 'local-safety-v1', text: '' }),
    generateStructured: async (request) => {
      const prompt = JSON.parse(request.prompt);
      const restrictions = new Map(
        (prompt.deterministicRestrictions ?? []).map((rating) => [
          `${rating.considerationCode}:${rating.severity}`,
          rating,
        ]),
      );
      const ratings = Object.fromEntries(
        prompt.considerations.map((consideration) => {
          const cells = Object.fromEntries(
            ['mild', 'moderate', 'severe'].map((severity) => {
              const restriction = restrictions.get(`${consideration.code}:${severity}`);
              return [severity, restriction?.rating ?? 'caution'];
            }),
          );
          const reasons = ['mild', 'moderate', 'severe']
            .map((severity) => restrictions.get(`${consideration.code}:${severity}`)?.reason)
            .filter(Boolean);
          return [
            consideration.code,
            {
              ...cells,
              reason: reasons[0] ?? 'No rule-specific clearance; manual safety review is required.',
              requiredModification:
                reasons.length > 0
                  ? 'Use the documented modification and stop if symptoms occur.'
                  : 'Manual safety review is required before use.',
              confidence: reasons.length > 0 ? 0.85 : 0.35,
            },
          ];
        }),
      );
      const payload = {
        schemaVersion: '1.0',
        ratings,
        summaryReason: 'Local deterministic safety analysis; every result requires human review.',
        confidence: 0.35,
      };
      return { model: 'local-safety-v1', payload: request.schema.parse(payload) };
    },
  };
}

function createProvider(providerName, model) {
  if (providerName === 'fake') return createFakeProvider();
  if (providerName === 'local') return createLocalProvider();
  if (providerName && providerName !== 'openrouter') {
    throw new Error(`Unsupported --provider=${providerName}; use fake, local, or openrouter.`);
  }
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required unless --provider=fake is used.');
  return new OpenRouterProvider({
    apiKey,
    baseUrl: process.env.OPENROUTER_BASE_URL,
    referer: process.env.OPENROUTER_REFERER,
    title: process.env.OPENROUTER_TITLE,
    defaultPrimaryModel: model,
    defaultTimeoutMs: Number(process.env.OPENROUTER_TIMEOUT_MS ?? 180_000),
    defaultMaxRetries: 0,
  });
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

function normalizeArtifact(value, datasetSha256, analysisVersion, model) {
  if (!value || typeof value !== 'object') {
    return {
      schemaVersion: '1.0',
      datasetSha256,
      analysisVersion,
      model,
      generatedAt: new Date().toISOString(),
      considerations: INITIAL_BODY_CONSIDERATIONS.map(({ code }) => ({ id: `bc_${code}`, code })),
      exercises: [],
    };
  }
  if (value.datasetSha256 !== datasetSha256)
    throw new Error('Existing analysis artifact has a mismatched dataset checksum.');
  if (value.analysisVersion !== analysisVersion)
    throw new Error('Existing analysis artifact has a mismatched analysis version.');
  assertExactActiveConsiderations(value.considerations);
  if (!Array.isArray(value.exercises))
    throw new Error('Existing analysis artifact exercises must be an array.');
  return value;
}

function normalizeState(value, datasetSha256, analysisVersion) {
  if (!value || typeof value !== 'object') {
    return { datasetSha256, analysisVersion, completedSourceIds: [], nextSourceId: null };
  }
  if (value.datasetSha256 !== datasetSha256)
    throw new Error('Analysis state has a mismatched dataset checksum.');
  if (value.analysisVersion !== analysisVersion)
    throw new Error('Analysis state has a mismatched analysis version.');
  if (!Array.isArray(value.completedSourceIds))
    throw new Error('Analysis state completedSourceIds must be an array.');
  return value;
}

function sourceToExercise(record) {
  return {
    id: record.id,
    name: record.name,
    instructions: record.instructions.en,
    target: record.target,
    primaryMuscle: record.target,
    muscleGroup: record.muscle_group,
    secondaryMuscles: record.secondary_muscles,
    equipment: record.equipment,
    bodyPart: record.body_part,
  };
}

/** Runs a resumable analysis over a local dataset without fetching source media. */
export async function runExerciseSafetyAnalysis(cliArgs = parseCliArgs(process.argv.slice(2))) {
  if (cliArgs.help) {
    console.log(
      'Usage: analyze:exercise-safety -- --catalog=PATH --out=PATH --state=PATH [--analysisVersion=safety-v1] [--model=MODEL] [--provider=fake|local|openrouter]',
    );
    return null;
  }
  for (const option of ['catalog', 'out', 'state']) {
    if (!cliArgs[option] || cliArgs[option] === 'true')
      throw new Error(`Missing required --${option}=PATH option.`);
  }
  const catalogPath = resolve(process.cwd(), cliArgs.catalog);
  const outPath = resolve(process.cwd(), cliArgs.out);
  const statePath = resolve(process.cwd(), cliArgs.state);
  const catalogBytes = await readFile(catalogPath);
  const datasetSha256 = createHash('sha256').update(catalogBytes).digest('hex');
  const rawCatalog = JSON.parse(catalogBytes.toString('utf8'));
  if (!Array.isArray(rawCatalog)) throw new Error('Catalog must contain a JSON array.');
  const records = rawCatalog.map((record) => sourceExerciseSchema.parse(record));
  const sourceIds = new Set(records.map((record) => record.id));
  if (sourceIds.size !== records.length) throw new Error('Catalog contains duplicate source IDs.');
  const analysisVersion = cliArgs.analysisVersion ?? DEFAULT_ANALYSIS_VERSION;
  const model = cliArgs.model ?? DEFAULT_MODEL;
  const artifact = normalizeArtifact(
    await readJson(outPath).catch((error) =>
      error?.code === 'ENOENT' ? null : Promise.reject(error),
    ),
    datasetSha256,
    analysisVersion,
    model,
  );
  const state = normalizeState(
    await readJson(statePath).catch((error) =>
      error?.code === 'ENOENT' ? null : Promise.reject(error),
    ),
    datasetSha256,
    analysisVersion,
  );
  const provider = createProvider(cliArgs.provider, model);
  const completed = new Set(state.completedSourceIds);
  const existingBySourceId = new Map(
    artifact.exercises.map((exercise) => [exercise.sourceId, exercise]),
  );
  for (const sourceId of completed) {
    if (!existingBySourceId.has(sourceId))
      throw new Error(`Analysis state references ${sourceId} but its artifact entry is missing.`);
  }

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (completed.has(record.id)) continue;
    const analysis = await analyzeExerciseSafety(provider, {
      exercise: sourceToExercise(record),
      considerations: artifact.considerations,
      analysisVersion,
      primaryModel: model,
      timeoutMs: Number(process.env.OPENROUTER_TIMEOUT_MS ?? 180_000),
    });
    existingBySourceId.set(record.id, { sourceId: record.id, name: record.name, ...analysis });
    artifact.exercises = records.map((item) => existingBySourceId.get(item.id)).filter(Boolean);
    artifact.generatedAt = new Date().toISOString();
    await replaceFileAtomically(outPath, artifact);
    completed.add(record.id);
    state.completedSourceIds = [...completed];
    state.nextSourceId = records[index + 1]?.id ?? null;
    await replaceFileAtomically(statePath, state);
  }
  const summary = {
    datasetSha256,
    analyzed: artifact.exercises.length,
    total: records.length,
    complete: artifact.exercises.length === records.length,
  };
  console.log(JSON.stringify(summary));
  return { artifact, state, summary };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runExerciseSafetyAnalysis().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
