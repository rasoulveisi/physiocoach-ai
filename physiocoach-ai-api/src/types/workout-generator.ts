import { z } from 'zod';
import type { WorkoutPlan } from './workout';
import type {
  AIProvider,
  ConsiderationSeverity,
  ConsiderationSide,
  WorkoutPlanConsideration,
  WorkoutPlanGenerationContext,
} from './ai';

export type CandidateCluster = 'green' | 'amber' | 'red';
export type CandidateSafetyRating = 'recommended' | 'caution' | 'avoid';

export interface CandidateSafetyRatingCell {
  considerationCode: string;
  severity: ConsiderationSeverity;
  rating: CandidateSafetyRating;
  reason: string;
  requiredModification?: string;
}

export interface CatalogCandidate {
  masterExerciseId: string;
  sourceId?: string;
  name: string;
  movementPattern: WorkoutPlan['days'][number]['exercises'][number]['movementPattern'];
  allowedEquipment: readonly string[];
  recommendedLevel?: WorkoutPlanGenerationContext['experienceLevel'];
  goalTags?: readonly string[];
  excludedLimitations?: readonly string[];
  primaryMuscleGroup?: string;
  safetyRatings?: readonly CandidateSafetyRatingCell[];
  cluster?: CandidateCluster;
  cautionReasons?: readonly string[];
  requiredModifications?: readonly string[];
}

export interface CandidateExclusion {
  masterExerciseId: string;
  reasons: readonly string[];
}

export interface CandidateClusterResult {
  green: readonly CatalogCandidate[];
  amber: readonly CatalogCandidate[];
  red: readonly CatalogCandidate[];
  exclusions: readonly CandidateExclusion[];
}

export type { WorkoutPlanConsideration, ConsiderationSide };

export interface WorkoutPlanOrchestrationResult {
  source: 'ai' | 'fallback' | 'repaired';
  model: string;
  plan: WorkoutPlan;
  warnings: string[];
  generation?: {
    modelUsed: string;
    fallbackUsed?: boolean;
    errorCode?:
      'rate_limited' | 'provider_timeout' | 'provider_error' | 'fallback_used' | undefined;
  };
}

export interface WorkoutPlanModelConfig {
  primaryModel: string;
  fallbackModels: string[];
  timeoutMs: number;
  maxRetries?: number;
}

import type { createDb } from '../db/client';

export interface WorkoutPlanOrchestrationOptions {
  forceFresh?: boolean;
  /** Development-only triage: treat empty rule-code caution cells as green. */
  provisionalNoRuleCautions?: boolean;
  db?: ReturnType<typeof createDb> | undefined;
  userId?: string | undefined;
  traceId?: string | undefined;
  inputHash?: string | undefined;
}

export interface WorkoutPlanGenerationFailureDetails {
  reason: string;
  attemptCount?: number;
  issues?: string[];
}

export interface WorkoutPlanRecordInput {
  id: string;
  userId: string;
  assessmentId: string;
  inputHash: string;
  createdAt: string;
  result: {
    source: 'ai' | 'fallback' | 'repaired';
    model: string;
    plan: WorkoutPlan;
    warnings: string[];
    generation?: {
      modelUsed: string;
      fallbackUsed?: boolean;
      errorCode?:
        'rate_limited' | 'provider_timeout' | 'provider_error' | 'fallback_used' | undefined;
    };
    providerMetadata?: {
      attempts?: number;
      providerRequestId?: string;
      usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
      };
      providerRawResponse?: unknown;
    };
  };
}

export interface WorkoutPlanRecord {
  id: string;
  userId: string;
  assessmentId: string;
  status: 'draft' | 'active' | 'archived' | 'deleted';
  planJson: string;
  safetyWarningsJson: string;
  aiMetadataJson: string;
  version: number;
  inputHash: string;
  createdAt: string;
}

export type WorkoutPlanRecordFromDb = Omit<WorkoutPlanRecord, 'status'> & {
  status: string;
};

export interface WorkoutPlanProviderConfig {
  GEMINI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_BASE_URL?: string;
  OPENROUTER_REFERER?: string;
  OPENROUTER_TITLE?: string;
  WORKOUT_MODEL_PRIMARY?: string;
  WORKOUT_MODEL_FALLBACKS?: string;
  OPENROUTER_TIMEOUT_MS?: string | number;
  OPENROUTER_MAX_RETRIES?: string | number;
}

export interface PostureFlags {
  roundedShoulders: boolean;
  shoulderPain: boolean;
  kneePain: boolean;
  lowerBackPain: boolean;
  neckPain: boolean;
}

export interface WorkoutPlanContext {
  goal: string;
  goals?: readonly string[];
  archetype?: string;
  frequencyDays: number;
  sessionMinutes?: number;
  equipment: string[];
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  limitations: string[];
  postureFlags: PostureFlags;
  considerations?: readonly WorkoutPlanConsideration[];
  age?: number;
  sex?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  heightCm?: number;
  weightKg?: number;
  bodyFatEstimate?: number;
  lifestyle?: 'desk_job' | 'standing_job' | 'active';
}

export interface WorkoutPlanProviderResult {
  provider: AIProvider;
  modelConfig: WorkoutPlanModelConfig;
}

export interface WorkoutPlanDto {
  id: string;
  source: 'ai' | 'fallback' | 'repaired';
  model: string;
  plan: WorkoutPlan;
  warnings: string[];
  generation?: {
    modelUsed: string;
    fallbackUsed?: boolean;
    errorCode?:
      'rate_limited' | 'provider_timeout' | 'provider_error' | 'fallback_used' | undefined;
  };
  createdAt: string;
  inputHash: string;
  cached: boolean;
}

export interface WorkoutPlanParseError {
  code: 'invalid_workout_plan_record';
  message: string;
  issues: string[];
}

export type WorkoutPlanParseResult =
  { ok: true; dto: WorkoutPlanDto } | { ok: false; error: WorkoutPlanParseError };

function parsePositiveInt(val: unknown): number | undefined {
  if (typeof val === 'number') return Number.isInteger(val) && val > 0 ? val : undefined;
  if (typeof val === 'string') {
    const parsed = parseInt(val.replace(/\D/g, ''), 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
  }
  return undefined;
}

function cleanString(val: unknown): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeAiExerciseKeys(val: unknown): unknown {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    return val;
  }
  const raw = val as Record<string, unknown>;

  const masterExerciseId = cleanString(
    raw.masterExerciseId ?? raw.master_exercise_id ?? raw.masterId ?? raw.master_id,
  );
  const id = cleanString(raw.id ?? raw.exerciseId ?? raw.exercise_id);
  const name = cleanString(
    raw.name ?? raw.namename ?? raw.exerciseName ?? raw.exercise_name ?? raw.title,
  );
  const slot = parsePositiveInt(
    raw.slot ?? raw.slotNumber ?? raw.slot_number ?? raw.slotId ?? raw.slot_id,
  );
  const restSeconds = parsePositiveInt(
    raw.restSeconds ?? raw.rest_seconds ?? raw.rest ?? raw.restTime ?? raw.rest_time,
  );
  const notes = cleanString(raw.notes);

  return {
    ...raw,
    ...(slot !== undefined ? { slot } : {}),
    ...(masterExerciseId !== undefined ? { masterExerciseId } : {}),
    ...(id !== undefined ? { id } : {}),
    ...(name !== undefined ? { name } : {}),
    ...(restSeconds !== undefined ? { restSeconds } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
}

export function normalizeAiDayKeys(val: unknown): unknown {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    return val;
  }
  const raw = val as Record<string, unknown>;

  const dayNumber = parsePositiveInt(
    raw.dayNumber ??
      raw.day_number ??
      raw.dayNo ??
      raw.day_no ??
      raw.day ??
      raw.dayIndex ??
      raw.day_index ??
      raw.index,
  );
  const name = cleanString(raw.name ?? raw.dayName ?? raw.day_name ?? raw.title);
  const estimatedDurationMinutes = parsePositiveInt(
    raw.estimatedDurationMinutes ??
      raw.estimatedDuration ??
      raw.durationMinutes ??
      raw.duration ??
      raw.estimated_duration_minutes ??
      raw.estimated_duration,
  );

  return {
    ...raw,
    ...(dayNumber !== undefined ? { dayNumber } : {}),
    ...(name !== undefined ? { name } : {}),
    ...(estimatedDurationMinutes !== undefined ? { estimatedDurationMinutes } : {}),
  };
}

export const leanAiExerciseSchema = z.preprocess(
  normalizeAiExerciseKeys,
  z
    .object({
      slot: z.number().int().min(1).max(12).optional(),
      masterExerciseId: z.string().min(1).optional(),
      id: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      movementPattern: z.string().optional(),
      muscleGroup: z.string().optional(),
      sets: z.number().int().positive().optional(),
      reps: z.union([z.string().min(1), z.number().positive()]).optional(),
      restSeconds: z.number().int().positive().optional(),
      notes: z.string().min(1).max(180).optional(),
    })
    .refine((data) => Boolean(data.masterExerciseId || data.id || data.name), {
      message: 'Exercise must have either masterExerciseId, id, or name.',
    }),
);

export const leanAiDaySchema = z.preprocess(
  normalizeAiDayKeys,
  z.object({
    dayNumber: z.number().int().min(1),
    name: z.string().min(1).optional(),
    focus: z.string().min(1).optional(),
    estimatedDurationMinutes: z.number().int().positive().optional(),
    exercises: z.array(leanAiExerciseSchema).min(1),
  }),
);

export const leanAiWorkoutPlanSchema = z.object({
  name: z.string().min(1).optional(),
  focus: z.string().min(1).optional(),
  days: z.array(leanAiDaySchema).min(1),
});

export type LeanAiExercise = z.infer<typeof leanAiExerciseSchema>;
export type LeanAiDay = z.infer<typeof leanAiDaySchema>;
export type LeanAiWorkoutPlan = z.infer<typeof leanAiWorkoutPlanSchema>;

export interface RawAiExerciseInput {
  slot?: number;
  masterExerciseId?: string;
  id?: string;
  name?: string;
  movementPattern?: string;
  muscleGroup?: string;
  sets?: number;
  reps?: string | number;
  restSeconds?: number;
  notes?: string;
}

export interface RawAiDayInput {
  dayNumber: number;
  name?: string;
  focus?: string;
  estimatedDurationMinutes?: number;
  exercises: RawAiExerciseInput[];
}

export interface RawAiWorkoutPlanInput {
  name?: string;
  focus?: string;
  days: RawAiDayInput[];
}

export type LeanAiExerciseInput = RawAiExerciseInput;
export type LeanAiDayInput = RawAiDayInput;
export type LeanAiWorkoutPlanInput = RawAiWorkoutPlanInput;

