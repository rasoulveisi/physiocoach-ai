import { z } from 'zod';
import {
  deriveExerciseAttributes,
  type ExerciseAttributeInput,
  type DerivedExerciseAttributes,
} from './exercise-attribute-deriver';
import {
  applyDeterministicSafetyRules,
  mergeSuitability,
  type DeterministicSafetyResult,
  type Severity,
  type Suitability,
} from './exercise-safety-rules';
import type { AIProvider } from '../types/ai';

const severitySchema = z.enum(['mild', 'moderate', 'severe']);
const suitabilitySchema = z.enum(['recommended', 'caution', 'avoid']);
const severities = ['mild', 'moderate', 'severe'] as const;
const suitabilityRank: Record<Suitability, number> = { recommended: 0, caution: 1, avoid: 2 };

const aiSafetyRatingSchema = z
  .object({
    considerationCode: z.string().trim().min(1),
    severity: severitySchema,
    rating: suitabilitySchema,
    reason: z.string().trim().min(1),
    requiredModification: z.string().trim().min(1).optional(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

const compactAiSafetyRatingSchema = z
  .object({
    mild: suitabilitySchema,
    moderate: suitabilitySchema,
    severe: suitabilitySchema,
    reason: z.string().trim().min(1),
    requiredModification: z.string().trim().min(1),
    confidence: z.number().min(0).max(1),
  })
  .strict();

const deterministicSafetyRatingSchema = z
  .object({
    considerationCode: z.string().trim().min(1),
    severity: severitySchema,
    rating: suitabilitySchema,
    reason: z.string().trim().min(1),
    ruleCodes: z.array(z.string().trim().min(1)),
  })
  .strict();

export const deterministicSafetyResultSchema = z
  .object({
    ratings: z.array(deterministicSafetyRatingSchema),
    ruleCodes: z.array(z.string().trim().min(1)),
    reasons: z.array(z.string().trim().min(1)),
  })
  .strict();

/** Strict, versioned contract requested from the AI provider for one exercise. */
export const exerciseSafetyAnalysisSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    ratings: z.array(aiSafetyRatingSchema),
    summaryReason: z.string().trim().min(1),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const conflictResolutionSchema = z
  .object({
    status: z.literal('resolved'),
    analysisVersion: z.string().trim().min(1),
    unresolvedConflicts: z.array(z.never()).length(0),
  })
  .strict();

export const analyzerEvidenceSchema = z
  .object({
    analysisVersion: z.string().trim().min(1),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/),
    ai: exerciseSafetyAnalysisSchema,
    deterministic: deterministicSafetyResultSchema,
    conflictResolution: conflictResolutionSchema,
  })
  .strict();

/** Ensures embedded AI evidence covers each expected consideration/severity cell exactly once. */
export function hasExactAnalyzerEvidenceMatrix(
  ratings: readonly { considerationCode: string; severity: string }[],
  expectedCells: ReadonlySet<string>,
): boolean {
  const observedCells = new Set<string>();
  for (const rating of ratings) {
    const cell = `${rating.considerationCode}:${rating.severity}`;
    if (!expectedCells.has(cell) || observedCells.has(cell)) return false;
    observedCells.add(cell);
  }
  return observedCells.size === expectedCells.size;
}

export interface ActiveConsideration {
  id: string;
  code: string;
}

export interface ExerciseSafetyAnalysisInput {
  exercise: ExerciseAttributeInput & { id: string };
  considerations: readonly ActiveConsideration[];
  analysisVersion: string;
  primaryModel?: string;
  timeoutMs?: number;
  attributes?: DerivedExerciseAttributes;
}

export interface ExerciseSafetyRating {
  considerationCode: string;
  severity: Severity;
  rating: Suitability;
  reason: string;
  requiredModification?: string;
  confidence: number;
  analysisSource: 'ai' | 'hybrid' | 'local';
  ruleCodes: string[];
}

export interface ExerciseSafetyAnalysis {
  exerciseId: string;
  analysisVersion: string;
  model: string;
  inputHash: string;
  attributes: DerivedExerciseAttributes;
  ruleResult: DeterministicSafetyResult;
  ratings: ExerciseSafetyRating[];
  coverageComplete: true;
  reviewStatus: 'pending';
  globalRating: Suitability;
  summaryReason: string;
  confidence: number;
  analysisSource: 'ai' | 'hybrid' | 'local';
  unresolvedConflicts: [];
  evidence: z.infer<typeof analyzerEvidenceSchema>;
}

type AiSafetyRating = z.infer<typeof aiSafetyRatingSchema>;

function stableJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function matrixKey(considerationCode: string, severity: Severity): string {
  return `${considerationCode}:${severity}`;
}

/** Rejects a rating sequence that becomes less restrictive as severity increases. */
export function assertMonotonicSeverity(
  ratings: ReadonlyArray<Pick<ExerciseSafetyRating, 'severity' | 'rating'>>,
): void {
  let previous = -1;
  for (const severity of severities) {
    const rating = ratings.find((candidate) => candidate.severity === severity);
    if (!rating) continue;
    const current = suitabilityRank[rating.rating];
    if (current < previous) throw new Error('Safety ratings are non-monotonic by severity.');
    previous = current;
  }
}

function validateCoverage(
  aiRatings: readonly AiSafetyRating[],
  considerations: readonly ActiveConsideration[],
): Map<string, AiSafetyRating> {
  const expected = new Set(
    considerations.flatMap((consideration) =>
      severities.map((severity) => matrixKey(consideration.code, severity)),
    ),
  );
  const values = new Map<string, AiSafetyRating>();
  const duplicateCells: string[] = [];
  for (const rating of aiRatings) {
    const key = matrixKey(rating.considerationCode, rating.severity);
    if (!expected.has(key)) {
      throw new Error(`Safety matrix contains an unexpected cell: ${key}.`);
    }
    if (values.has(key)) duplicateCells.push(key);
    values.set(key, rating);
  }
  if (values.size !== expected.size || duplicateCells.length > 0) {
    const missingCells = [...expected].filter((key) => !values.has(key));
    throw new Error(
      `Safety matrix coverage is incomplete (missing: ${missingCells.join(', ') || 'none'}; duplicates: ${duplicateCells.join(', ') || 'none'}).`,
    );
  }
  for (const consideration of considerations) {
    assertMonotonicSeverity(
      severities.map((severity) => values.get(matrixKey(consideration.code, severity))!),
    );
  }
  return values;
}

function buildPrompt(
  input: ExerciseSafetyAnalysisInput,
  attributes: DerivedExerciseAttributes,
  deterministic: DeterministicSafetyResult,
): string {
  return stableJson({
    task: 'exercise_safety_analysis',
    instructions: [
      'Return one object keyed by each consideration code, with mild, moderate, and severe ratings.',
      'Use recommended, caution, or avoid; severity must never become less restrictive.',
      'Give one concise reason and required modification per consideration based only on the supplied exercise metadata and derived attributes.',
      'This is safety triage for review, not medical advice.',
    ],
    analysisVersion: input.analysisVersion,
    exercise: input.exercise,
    attributes,
    considerations: input.considerations,
    deterministicRestrictions: deterministic.ratings,
  });
}

function buildSafetyResponseFormat(considerations: readonly ActiveConsideration[]) {
  const ratingProperties = Object.fromEntries(
    considerations.map(({ code }) => [
      code,
      {
        type: 'object',
        properties: {
          mild: { type: 'string', enum: ['recommended', 'caution', 'avoid'] },
          moderate: { type: 'string', enum: ['recommended', 'caution', 'avoid'] },
          severe: { type: 'string', enum: ['recommended', 'caution', 'avoid'] },
          reason: { type: 'string', minLength: 1 },
          requiredModification: { type: 'string', minLength: 1 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['mild', 'moderate', 'severe', 'reason', 'requiredModification', 'confidence'],
        additionalProperties: false,
      },
    ]),
  );
  return {
    name: 'exercise_safety_analysis',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        schemaVersion: { type: 'string', const: '1.0' },
        ratings: {
          type: 'object',
          properties: ratingProperties,
          required: considerations.map(({ code }) => code),
          additionalProperties: false,
        },
        summaryReason: { type: 'string', minLength: 1 },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['schemaVersion', 'ratings', 'summaryReason', 'confidence'],
      additionalProperties: false,
    },
  };
}

function buildSafetyProviderSchema(considerations: readonly ActiveConsideration[]) {
  const ratingsShape = Object.fromEntries(
    considerations.map(({ code }) => [code, compactAiSafetyRatingSchema]),
  );
  return z
    .object({
      schemaVersion: z.literal('1.0'),
      ratings: z.object(ratingsShape).strict(),
      summaryReason: z.string().trim().min(1),
      confidence: z.number().min(0).max(1),
    })
    .strict();
}

/** Merges complete AI cells with hard rules, retaining the strictest rating and all explanations. */
export function mergeExerciseSafetyAnalysis(
  ruleResult: DeterministicSafetyResult,
  aiResult: z.infer<typeof exerciseSafetyAnalysisSchema>,
): ExerciseSafetyRating[] {
  const rulesByCell = new Map(
    ruleResult.ratings.map((rating) => [
      matrixKey(rating.considerationCode, rating.severity),
      rating,
    ]),
  );
  return aiResult.ratings
    .map((aiRating) => {
      const ruleRating = rulesByCell.get(matrixKey(aiRating.considerationCode, aiRating.severity));
      return {
        considerationCode: aiRating.considerationCode,
        severity: aiRating.severity,
        rating: ruleRating ? mergeSuitability(ruleRating.rating, aiRating.rating) : aiRating.rating,
        reason: [ruleRating?.reason, aiRating.reason].filter(Boolean).join(' '),
        ...(aiRating.requiredModification
          ? { requiredModification: aiRating.requiredModification }
          : {}),
        confidence: aiRating.confidence,
        analysisSource: ruleRating ? ('hybrid' as const) : ('ai' as const),
        ruleCodes: ruleRating?.ruleCodes ?? [],
      };
    })
    .sort(
      (left, right) =>
        left.considerationCode.localeCompare(right.considerationCode) ||
        severities.indexOf(left.severity) - severities.indexOf(right.severity),
    );
}

/**
 * Classifies an exercise across every active safety consideration. The deterministic result is
 * always retained and can only be made stricter by AI output.
 */
export async function analyzeExerciseSafety(
  provider: AIProvider,
  input: ExerciseSafetyAnalysisInput,
): Promise<ExerciseSafetyAnalysis> {
  if (!input.exercise.id.trim()) throw new Error('Exercise id is required for safety analysis.');
  if (!input.analysisVersion.trim())
    throw new Error('Analysis version is required for safety analysis.');
  const duplicateConsideration = input.considerations.find(
    (consideration, index) =>
      input.considerations.findIndex(({ code }) => code === consideration.code) !== index,
  );
  if (duplicateConsideration)
    throw new Error(`Duplicate active consideration: ${duplicateConsideration.code}.`);

  const attributes = input.attributes ?? deriveExerciseAttributes(input.exercise);
  const ruleResult = applyDeterministicSafetyRules(input.exercise, attributes);
  const prompt = buildPrompt(input, attributes, ruleResult);
  const inputHash = await sha256(prompt);
  const providerSchema = buildSafetyProviderSchema(input.considerations);
  const response = await provider.generateStructured({
    task: 'exercise_safety_analysis',
    inputHash,
    prompt,
    schema: providerSchema,
    responseFormat: buildSafetyResponseFormat(input.considerations),
    ...(input.primaryModel ? { primaryModel: input.primaryModel } : {}),
    ...(typeof input.timeoutMs === 'number' ? { timeoutMs: input.timeoutMs } : {}),
  });
  const compact = providerSchema.parse(response.payload);
  const compactRatings = compact.ratings as Record<
    string,
    z.infer<typeof compactAiSafetyRatingSchema>
  >;
  const ai = exerciseSafetyAnalysisSchema.parse({
    schemaVersion: compact.schemaVersion,
    ratings: input.considerations.flatMap(({ code }) => {
      const rating = compactRatings[code];
      if (!rating) throw new Error(`Safety matrix is missing consideration: ${code}.`);
      return severities.map((severity) => ({
        considerationCode: code,
        severity,
        rating: rating[severity],
        reason: rating.reason,
        requiredModification: rating.requiredModification,
        confidence: rating.confidence,
      }));
    }),
    summaryReason: compact.summaryReason,
    confidence: compact.confidence,
  });
  validateCoverage(ai.ratings, input.considerations);
  const localAnalysis = response.model.startsWith('local-');
  const ratings = mergeExerciseSafetyAnalysis(ruleResult, ai).map((rating) => ({
    ...rating,
    ...(localAnalysis ? { analysisSource: 'local' as const } : {}),
  }));
  for (const consideration of input.considerations) {
    assertMonotonicSeverity(
      ratings.filter((rating) => rating.considerationCode === consideration.code),
    );
  }
  const globalRating = ratings.reduce<Suitability>(
    (strictest, rating) =>
      suitabilityRank[rating.rating] > suitabilityRank[strictest] ? rating.rating : strictest,
    'recommended',
  );

  return {
    exerciseId: input.exercise.id,
    analysisVersion: input.analysisVersion,
    model: response.model,
    inputHash,
    attributes,
    ruleResult,
    ratings,
    coverageComplete: true,
    reviewStatus: 'pending',
    globalRating,
    summaryReason: ai.summaryReason,
    confidence: ai.confidence,
    analysisSource: localAnalysis ? 'local' : 'hybrid',
    unresolvedConflicts: [],
    evidence: analyzerEvidenceSchema.parse({
      analysisVersion: input.analysisVersion,
      inputHash,
      ai,
      deterministic: ruleResult,
      conflictResolution: conflictResolutionSchema.parse({
        status: 'resolved',
        analysisVersion: input.analysisVersion,
        unresolvedConflicts: [],
      }),
    }),
  };
}
