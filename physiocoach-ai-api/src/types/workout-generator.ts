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

export function normalizeAiExerciseKeys(val: unknown): unknown {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    return val;
  }
  const obj = { ...val } as Record<string, unknown>;

  // Normalize masterExerciseId key
  const masterIdKeys = ['masterExerciseId', 'master_exercise_id', 'masterId', 'master_id'];
  for (const key of masterIdKeys) {
    if (obj[key] !== undefined && key !== 'masterExerciseId') {
      if (obj.masterExerciseId === undefined) {
        obj.masterExerciseId = obj[key];
      }
      delete obj[key];
    }
  }

  // Normalize id key
  const idKeys = ['id', 'exerciseId', 'exercise_id'];
  for (const key of idKeys) {
    if (obj[key] !== undefined && key !== 'id') {
      if (obj.id === undefined) {
        obj.id = obj[key];
      }
      delete obj[key];
    }
  }

  // Normalize name key
  const nameKeys = ['name', 'namename', 'exerciseName', 'exercise_name', 'title'];
  for (const key of nameKeys) {
    if (obj[key] !== undefined && key !== 'name') {
      if (obj.name === undefined) {
        obj.name = obj[key];
      }
      delete obj[key];
    }
  }

  // Normalize slot key
  const slotKeys = ['slot', 'slotNumber', 'slot_number', 'slotId', 'slot_id'];
  for (const key of slotKeys) {
    if (obj[key] !== undefined && key !== 'slot') {
      if (obj.slot === undefined) {
        obj.slot = obj[key];
      }
      delete obj[key];
    }
  }

  // Coerce slot to number if it is string
  if (obj.slot !== undefined) {
    if (typeof obj.slot === 'string') {
      const parsed = parseInt((obj.slot as string).replace(/\D/g, ''), 10);
      obj.slot = isNaN(parsed) || parsed <= 0 ? undefined : parsed;
    }
  }

  // Normalize restSeconds key
  const restKeys = ['restSeconds', 'rest_seconds', 'rest', 'restTime', 'rest_time'];
  for (const key of restKeys) {
    if (obj[key] !== undefined && key !== 'restSeconds') {
      if (obj.restSeconds === undefined) {
        obj.restSeconds = obj[key];
      }
      delete obj[key];
    }
  }

  // Coerce restSeconds to number if it is string
  if (obj.restSeconds !== undefined) {
    if (typeof obj.restSeconds === 'string') {
      const parsed = parseInt(obj.restSeconds.replace(/\D/g, ''), 10);
      obj.restSeconds = isNaN(parsed) || parsed <= 0 ? undefined : parsed;
    }
  }

  // Clean empty strings
  if (typeof obj.name === 'string') {
    if (obj.name.trim() === '') {
      delete obj.name;
    } else {
      obj.name = obj.name.trim();
    }
  }
  if (typeof obj.masterExerciseId === 'string') {
    if (obj.masterExerciseId.trim() === '') {
      delete obj.masterExerciseId;
    } else {
      obj.masterExerciseId = obj.masterExerciseId.trim();
    }
  }
  if (typeof obj.id === 'string') {
    if (obj.id.trim() === '') {
      delete obj.id;
    } else {
      obj.id = obj.id.trim();
    }
  }

  // Clean empty notes string
  if (typeof obj.notes === 'string') {
    if (obj.notes.trim() === '') {
      delete obj.notes;
    } else {
      obj.notes = obj.notes.trim();
    }
  }

  return obj;
}

export function normalizeAiDayKeys(val: unknown): unknown {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    return val;
  }
  const obj = { ...val } as Record<string, unknown>;

  // Normalize dayNumber key
  const dayNumKeys = [
    'dayNumber',
    'day_number',
    'dayNo',
    'day_no',
    'day',
    'dayIndex',
    'day_index',
    'index',
  ];
  for (const key of dayNumKeys) {
    if (obj[key] !== undefined && key !== 'dayNumber') {
      if (obj.dayNumber === undefined) {
        obj.dayNumber = obj[key];
      }
      delete obj[key];
    }
  }

  // Coerce dayNumber to number
  if (obj.dayNumber !== undefined) {
    if (typeof obj.dayNumber === 'string') {
      const parsed = parseInt(obj.dayNumber.replace(/\D/g, ''), 10);
      obj.dayNumber = isNaN(parsed) || parsed <= 0 ? undefined : parsed;
    }
  }

  // Normalize name key
  const dayNameKeys = ['name', 'dayName', 'day_name', 'title'];
  for (const key of dayNameKeys) {
    if (obj[key] !== undefined && key !== 'name') {
      if (obj.name === undefined) {
        obj.name = obj[key];
      }
      delete obj[key];
    }
  }

  // Normalize estimatedDurationMinutes key
  const dayDurationKeys = [
    'estimatedDurationMinutes',
    'estimatedDuration',
    'durationMinutes',
    'duration',
    'estimated_duration_minutes',
    'estimated_duration',
  ];
  for (const key of dayDurationKeys) {
    if (obj[key] !== undefined && key !== 'estimatedDurationMinutes') {
      if (obj.estimatedDurationMinutes === undefined) {
        obj.estimatedDurationMinutes = obj[key];
      }
      delete obj[key];
    }
  }

  if (obj.estimatedDurationMinutes !== undefined) {
    if (typeof obj.estimatedDurationMinutes === 'string') {
      const parsed = parseInt((obj.estimatedDurationMinutes as string).replace(/\D/g, ''), 10);
      obj.estimatedDurationMinutes = isNaN(parsed) || parsed <= 0 ? undefined : parsed;
    }
  }

  return obj;
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
      sets: z.number().int().min(1).optional(),
      reps: z.union([z.string().min(1), z.number().positive()]).optional(),
      restSeconds: z.number().int().min(1).optional(),
      notes: z.string().min(1).max(180).optional(),
    })
    .strict()
    .refine((data) => Boolean(data.masterExerciseId || data.id || data.name), {
      message: 'Exercise must have either masterExerciseId, id, or name.',
    }),
);

export const leanAiDaySchema = z.preprocess(
  normalizeAiDayKeys,
  z
    .object({
      dayNumber: z.number().int().min(1),
      name: z.string().min(1).optional(),
      focus: z.string().min(1).optional(),
      estimatedDurationMinutes: z.number().int().positive().optional(),
      exercises: z.array(leanAiExerciseSchema).min(1),
    })
    .strict(),
);

export const leanAiWorkoutPlanSchema = z
  .object({
    name: z.string().min(1).optional(),
    focus: z.string().min(1).optional(),
    days: z.array(leanAiDaySchema).min(1),
  })
  .strict();

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

