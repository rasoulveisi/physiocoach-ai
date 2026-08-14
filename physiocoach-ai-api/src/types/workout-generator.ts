import type { WorkoutPlan } from './workout';
import type {
  AIProvider,
  ConsiderationSeverity,
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

export type { WorkoutPlanConsideration };

export interface WorkoutPlanOrchestrationResult {
  source: 'ai' | 'fallback' | 'repaired';
  model: string;
  plan: WorkoutPlan;
  warnings: string[];
  generation?: {
    fallbackUsed: boolean;
    errorCode?:
      | 'rate_limited'
      | 'provider_timeout'
      | 'provider_error'
      | 'fallback_used'
      | undefined;
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
      fallbackUsed: boolean;
      errorCode?:
        | 'rate_limited'
        | 'provider_timeout'
        | 'provider_error'
        | 'fallback_used'
        | undefined;
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
  status: 'draft' | 'active' | 'archived';
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
    fallbackUsed: boolean;
    errorCode?:
      | 'rate_limited'
      | 'provider_timeout'
      | 'provider_error'
      | 'fallback_used'
      | undefined;
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
  | { ok: true; dto: WorkoutPlanDto }
  | { ok: false; error: WorkoutPlanParseError };
