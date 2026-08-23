import { z } from 'zod';
import { validateCandidatePlan, validateWorkoutPlan } from './plan-validator';
import type { AssessmentInput } from '../types/assessment';
import type { ProfileInput } from '../types/profile';
import type { AIProvider, WorkoutPlanGenerationContext } from '../types/ai';
import type {
  WorkoutPlanContext,
  WorkoutPlanParseResult,
  WorkoutPlanProviderConfig,
  WorkoutPlanRecord,
  WorkoutPlanRecordFromDb,
  WorkoutPlanRecordInput,
  WorkoutPlanOrchestrationOptions,
  WorkoutPlanOrchestrationResult,
  WorkoutPlanGenerationFailureDetails,
  WorkoutPlanModelConfig,
  PostureFlags,
  WorkoutPlanDto,
  CatalogCandidate,
} from '../types/workout-generator';
import { createDb } from '../db/client';

import { buildWorkoutPlanModelConfig, createWorkoutPlanProvider } from './workout-generator/config';
import {
  generatePlanInputSchema,
  type GeneratePlanInput,
  buildPlanInputHash,
  buildWorkoutPlanContext,
  mapPostureFlags,
} from './workout-generator/context';
import {
  buildWorkoutPlanRecord,
  parseWorkoutPlanRecord,
  parseWorkoutPlanRecordOrError,
} from './workout-generator/record';
import {
  buildCandidateExerciseSet,
  loadCatalogCandidatesFromDb,
} from './workout-generator/candidates';
import {
  buildWorkoutPlanPrompt,
  getPromptCandidateTargets,
} from './workout-generator/prompt-builder';
import {
  hydratePlanFromCatalog,
  leanAiWorkoutPlanSchema,
  uniqueUserVisibleWarnings,
  validateAiGenerationQuality,
} from './workout-generator/plan-hydration';
import { WorkoutPlanGenerationError } from './workout-generator/errors';

export { type AssessmentInput, type ProfileInput, generatePlanInputSchema, type GeneratePlanInput };
export { buildPlanInputHash, buildWorkoutPlanContext, mapPostureFlags };
export { buildWorkoutPlanModelConfig, createWorkoutPlanProvider };
export { buildWorkoutPlanRecord, parseWorkoutPlanRecord, parseWorkoutPlanRecordOrError };
export { loadCatalogCandidatesFromDb, buildCandidateExerciseSet, hydratePlanFromCatalog };
export { WorkoutPlanGenerationError };
export type { CatalogCandidate };
export { z };

export type {
  WorkoutPlanOrchestrationResult,
  WorkoutPlanModelConfig,
  WorkoutPlanOrchestrationOptions,
  WorkoutPlanGenerationFailureDetails,
  WorkoutPlanRecordInput,
  WorkoutPlanRecord,
  WorkoutPlanRecordFromDb,
  WorkoutPlanProviderConfig,
  WorkoutPlanContext,
  PostureFlags,
  WorkoutPlanParseResult,
  WorkoutPlanDto,
};

type DbClient = ReturnType<typeof createDb>;

function safetyContextFromGenerationContext(context: WorkoutPlanGenerationContext) {
  return {
    experienceLevel: context.experienceLevel,
    limitations: context.limitations,
    postureFlags: context.postureFlags,
  };
}

export async function generateWorkoutPlanWithSafety(
  provider: AIProvider,
  context: WorkoutPlanGenerationContext,
  modelConfig: WorkoutPlanModelConfig,
  inputHash = 'legacy',
  options: WorkoutPlanOrchestrationOptions = {},
  db?: DbClient,
  catalogCandidates?: readonly CatalogCandidate[],
): Promise<WorkoutPlanOrchestrationResult> {
  console.info('workout_plan.generation.input_context', {
    inputHash,
    models: [modelConfig.primaryModel, ...(modelConfig.fallbackModels ?? [])].filter(Boolean),
    timeoutMs: modelConfig.timeoutMs,
    maxRetries: modelConfig.maxRetries ?? 0,
    hasDb: Boolean(db),
    hasInjectedCatalog: Boolean(catalogCandidates && catalogCandidates.length > 0),
    options: {
      forceFresh: options.forceFresh ?? false,
      provisionalNoRuleCautions: options.provisionalNoRuleCautions ?? false,
    },
    context: {
      goal: context.goal,
      goals: context.goals ?? [],
      frequencyDays: context.frequencyDays,
      sessionMinutes: context.sessionMinutes,
      experienceLevel: context.experienceLevel,
      equipment: context.equipment,
      limitations: context.limitations,
      postureFlags: context.postureFlags,
      considerations: context.considerations ?? [],
      age: context.age,
      sex: context.sex,
      heightCm: context.heightCm,
      weightKg: context.weightKg,
      bodyFatEstimate: context.bodyFatEstimate,
      lifestyle: context.lifestyle,
    },
  });

  const resolvedCatalogCandidates =
    catalogCandidates && catalogCandidates.length > 0
      ? catalogCandidates
      : db
        ? await loadCatalogCandidatesFromDb(
            db,
            context.considerations ?? [],
            options.provisionalNoRuleCautions ?? false,
          )
        : [];

  console.info('workout_plan.catalog.hydration_result', {
    inputHash,
    source: catalogCandidates && catalogCandidates.length > 0 ? 'injected' : db ? 'db' : 'none',
    candidateCount: resolvedCatalogCandidates.length,
  });

  if (resolvedCatalogCandidates.length === 0) {
    throw new WorkoutPlanGenerationError(
      'Catalog-backed AI generation is unavailable because no catalog candidates are loaded.',
      {
        reason: 'catalog_candidates_unavailable',
        issues: [
          'Catalog exercise candidates are required for production AI generation and must come from D1, not a hardcoded fallback.',
        ],
      },
    );
  }

  const models = [modelConfig.primaryModel, ...(modelConfig.fallbackModels ?? [])].filter(Boolean);

  const candidateBuild = buildCandidateExerciseSet(context, resolvedCatalogCandidates);
  console.info('workout_plan.catalog.candidate_build_result', {
    inputHash,
    compatibleCandidates: candidateBuild.candidates.length,
    allCandidates: candidateBuild.allCandidates.length,
    green: candidateBuild.clusters.green.length,
    amber: candidateBuild.clusters.amber.length,
    red: candidateBuild.clusters.red.length,
    exclusions: candidateBuild.clusters.exclusions.length,
    requiredMovementPatterns: candidateBuild.requiredMovementPatterns,
    missingSafeMovementPatterns: candidateBuild.missingSafeMovementPatterns,
  });

  if (candidateBuild.candidates.length === 0) {
    if (candidateBuild.clusters.red.length > 0) {
      throw new WorkoutPlanGenerationError(
        'Safety exclusions leave insufficient safe exercise candidates for this request.',
        {
          reason: 'insufficient_safe_candidates',
          issues: candidateBuild.clusters.exclusions.flatMap(({ masterExerciseId, reasons }) =>
            reasons.map((reason) => `${masterExerciseId}: ${reason}`),
          ),
        },
      );
    }
    throw new WorkoutPlanGenerationError('No catalog candidates match the request constraints.', {
      reason: 'catalog_filtering_empty',
      issues: ['No approved catalog exercises were found for the provided profile.'],
    });
  }

  if (
    candidateBuild.candidates.length < context.frequencyDays &&
    candidateBuild.clusters.red.length > 0
  ) {
    throw new WorkoutPlanGenerationError(
      'Safety exclusions leave insufficient safe exercise candidates for the requested training frequency.',
      {
        reason: 'insufficient_safe_candidates',
        issues: [
          `Only ${candidateBuild.candidates.length} safe candidate(s) remain for ${context.frequencyDays} training day(s).`,
        ],
      },
    );
  }

  const unsafeMissingMovementPatterns = candidateBuild.missingSafeMovementPatterns.filter(
    (pattern) =>
      candidateBuild.clusters.red.some((candidate) => candidate.movementPattern === pattern),
  );
  if (unsafeMissingMovementPatterns.length > 0) {
    throw new WorkoutPlanGenerationError(
      'Safety exclusions leave required movement patterns without safe candidate coverage.',
      {
        reason: 'insufficient_safe_candidates',
        issues: unsafeMissingMovementPatterns.map(
          (pattern) => `No safe ${pattern} candidate remains after safety exclusions.`,
        ),
      },
    );
  }

  const candidateTargets = getPromptCandidateTargets(context.frequencyDays);
  if (candidateBuild.candidates.length < candidateTargets.minimumPromptCandidateCount) {
    console.warn('workout_plan.catalog_candidate_pool.below_target', {
      compatibleCandidates: candidateBuild.candidates.length,
      minimumPromptCandidateCount: candidateTargets.minimumPromptCandidateCount,
    });
  }

  let lastError: unknown;
  const promptValidationCandidates = candidateBuild;
  const prompt = buildWorkoutPlanPrompt(
    context,
    candidateBuild.requiredMovementPatterns,
    candidateBuild.candidates,
  );

  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const model = models[modelIndex];
    if (!model) continue;

    const currentTimeoutMs = modelConfig.timeoutMs;

    console.info('workout_plan.generation.attempt_start', {
      inputHash,
      model,
      modelIndex,
      modelCount: models.length,
      isFallback: modelIndex > 0,
      timeoutMs: currentTimeoutMs,
      promptLength: prompt.length,
      availableCandidates: candidateBuild.candidates.length,
    });

    try {
      const response = await provider.generateStructured({
        task: 'workout_plan',
        inputHash,
        prompt,
        schema: leanAiWorkoutPlanSchema,
        primaryModel: model,
        timeoutMs: currentTimeoutMs,
        options,
      });

      console.info('workout_plan.generation.provider_response', {
        inputHash,
        model: response.model,
        payloadDays: (response.payload as { days?: unknown[] } | undefined)?.days?.length ?? 0,
      });

      const catalogValidation = hydratePlanFromCatalog(
        response.payload,
        promptValidationCandidates,
      );
      if (!catalogValidation.ok) {
        throw new WorkoutPlanGenerationError(
          'AI plan output failed catalog filtering validation.',
          {
            reason: 'catalog_validation',
            issues: [...catalogValidation.warnings, ...catalogValidation.corrections],
          },
        );
      }

      const candidateSafetyValidation = validateCandidatePlan(
        catalogValidation.plan,
        promptValidationCandidates.allCandidates,
        promptValidationCandidates,
      );
      if (!candidateSafetyValidation.ok) {
        throw new WorkoutPlanGenerationError('AI plan output failed catalog safety validation.', {
          reason: 'catalog_safety_validation',
          issues: candidateSafetyValidation.issues,
        });
      }

      const qualityResult = validateAiGenerationQuality(
        catalogValidation.plan,
        context,
        promptValidationCandidates,
      );
      if (!qualityResult.ok) {
        throw new WorkoutPlanGenerationError(
          'AI plan output failed generation quality validation.',
          {
            reason: 'quality_validation',
            issues: [...qualityResult.warnings, ...qualityResult.corrections],
          },
        );
      }

      const safetyResult = validateWorkoutPlan(
        catalogValidation.plan,
        safetyContextFromGenerationContext(context),
      );

      if (!safetyResult.ok) {
        throw new WorkoutPlanGenerationError('AI plan output failed safety validation.', {
          reason: 'safety_validation',
          issues: [...safetyResult.warnings, ...safetyResult.corrections],
        });
      }

      const warnings = uniqueUserVisibleWarnings([
        ...catalogValidation.warnings,
        ...qualityResult.warnings,
        ...safetyResult.warnings,
      ]);

      console.info('workout_plan.generation.verification_status', {
        inputHash,
        model,
        status: 'ok',
        totalWarnings: warnings.length,
        planDays: safetyResult.correctedPlan.days.length,
        source: 'ai',
      });

      return {
        source: 'ai',
        model: response.model,
        plan: safetyResult.correctedPlan,
        warnings,
        generation: {
          fallbackUsed: modelIndex > 0,
        },
      };
    } catch (error) {
      console.warn('workout_plan.generation.attempt_failed', {
        inputHash,
        model,
        modelIndex,
        reason:
          error instanceof WorkoutPlanGenerationError
            ? (error.details?.reason ?? 'workout_plan_generation_error')
            : error instanceof Error
              ? error.name
              : typeof error,
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      lastError = error;
    }
  }

  // All models failed — if last error is a WorkoutPlanGenerationError, re-throw it
  if (lastError instanceof WorkoutPlanGenerationError) {
    throw lastError;
  }

  const isTimeout =
    lastError instanceof Error &&
    (lastError.name === 'AbortError' ||
      lastError.message.toLowerCase().includes('timeout') ||
      lastError.message.toLowerCase().includes('aborted'));

  const finalError =
    lastError instanceof Error ? lastError : new Error('All models failed to generate plan.');

  throw new WorkoutPlanGenerationError(
    finalError.message,
    {
      reason: isTimeout ? 'provider_timeout' : 'provider_error',
      issues: [finalError.message],
    },
    finalError,
  );
}
