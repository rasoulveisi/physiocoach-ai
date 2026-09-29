import { matchExerciseToCatalog } from '../exercise-matching';
import {
  CANONICAL_PROGRESSION_RULE,
  WORKOUT_PLAN_MOVEMENT_PATTERNS,
} from '../../types/workout-plan-contract';
import { DISCLAIMER, workoutPlanSchema, type WorkoutPlan } from '../../types/workout';
import type { WorkoutPlanGenerationContext } from '../../types/ai';
import {
  leanAiExerciseSchema,
  leanAiDaySchema,
  leanAiWorkoutPlanSchema,
  normalizeAiExerciseKeys,
  normalizeAiDayKeys,
  type LeanAiExercise,
  type LeanAiDay,
  type LeanAiWorkoutPlan,
  type RawAiExerciseInput,
  type RawAiDayInput,
  type RawAiWorkoutPlanInput,
  type LeanAiExerciseInput,
  type LeanAiDayInput,
  type LeanAiWorkoutPlanInput,
  type CatalogCandidate,
} from '../../types/workout-generator';
import type { CandidateBuildResult } from './candidates';
import { WorkoutPlanGenerationError } from './errors';
import { calculateWorkoutDayDurationMinutes } from '../workout-duration';
import {
  getDaySlotBlueprint,
  getDayTrainingType,
  getSessionSizingGuidance,
  type DaySlotBlueprint,
  type DayTrainingType,
} from './prompt-builder';

export {
  leanAiExerciseSchema,
  leanAiDaySchema,
  leanAiWorkoutPlanSchema,
  normalizeAiExerciseKeys,
  normalizeAiDayKeys,
  type LeanAiExercise,
  type LeanAiDay,
  type LeanAiWorkoutPlan,
  type RawAiExerciseInput,
  type RawAiDayInput,
  type RawAiWorkoutPlanInput,
  type LeanAiExerciseInput,
  type LeanAiDayInput,
  type LeanAiWorkoutPlanInput,
};

type WorkoutDayWithExercises = WorkoutPlan['days'][number];
type WorkoutPlanMovementPattern = (typeof WORKOUT_PLAN_MOVEMENT_PATTERNS)[number];

const MAX_DAY_CATALOG_OVERLAP_RATIO = 0.75;

export type CandidateValidationResult = {
  plan: WorkoutPlan;
  ok: boolean;
  warnings: string[];
  corrections: string[];
  repaired: boolean;
};

export function getCandidateLookupKey(exercise: {
  id?: unknown;
  masterExerciseId?: unknown;
}): string | undefined {
  if (
    typeof exercise.masterExerciseId === 'string' &&
    exercise.masterExerciseId.trim().length > 0
  ) {
    return exercise.masterExerciseId.trim();
  }
  if (typeof exercise.id === 'string' && exercise.id.trim().length > 0) {
    return exercise.id.trim();
  }
  return undefined;
}

export function inferMovementPatternFromName(name: string): WorkoutPlanMovementPattern {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('squat')) return 'squat';
  if (lowerName.includes('deadlift') || lowerName.includes('hinge') || lowerName.includes('rdl')) {
    return 'hinge';
  }
  if (lowerName.includes('press') || lowerName.includes('push')) return 'push';
  if (lowerName.includes('row') || lowerName.includes('pull') || lowerName.includes('curl')) {
    return 'pull';
  }
  if (lowerName.includes('lunge')) return 'lunge';
  if (lowerName.includes('carry') || lowerName.includes('walk')) return 'carry';
  if (lowerName.includes('plank') || lowerName.includes('crunch') || lowerName.includes('core')) {
    return 'core';
  }
  return 'mobility';
}

function normalizeCandidateText(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function isUpperBodyCandidate(candidate: CatalogCandidate): boolean {
  if (candidate.movementPattern === 'push' || candidate.movementPattern === 'pull') {
    return true;
  }
  const muscle = normalizeCandidateText(candidate.primaryMuscleGroup);
  const name = normalizeCandidateText(candidate.name);
  const upperTerms = [
    'chest', 'pectoral', 'pec', 'bench', 'dip', 'pushup', 'push-up',
    'shoulder', 'delt', 'deltoid', 'overhead', 'military', 'lateral raise', 'front raise',
    'back', 'lat', 'lats', 'latissimus', 'row', 'pull', 'chin-up', 'chinup', 'pulldown', 'pullover',
    'shrug', 'trapezius', 'trap', 'traps', 'rhomboid',
    'bicep', 'biceps', 'curl', 'tricep', 'triceps', 'pushdown', 'arm', 'forearm',
  ];
  if (upperTerms.some((term) => muscle.includes(term) || name.includes(term))) {
    return true;
  }
  if (
    candidate.movementPattern === 'isolation' &&
    !isLowerBodyCandidate(candidate) &&
    !isCoreCandidate(candidate)
  ) {
    return true;
  }
  return false;
}

function isLowerBodyCandidate(candidate: CatalogCandidate): boolean {
  if (['squat', 'hinge', 'lunge'].includes(candidate.movementPattern)) {
    return true;
  }
  const muscle = normalizeCandidateText(candidate.primaryMuscleGroup);
  const name = normalizeCandidateText(candidate.name);
  const lowerTerms = [
    'quad', 'quadriceps', 'hamstring', 'hamstrings', 'glute', 'glutes', 'gluteus',
    'calf', 'calves', 'gastrocnemius', 'soleus', 'hip', 'adductor', 'abductor', 'leg', 'thigh',
  ];
  return lowerTerms.some((term) => muscle.includes(term) || name.includes(term));
}

function isCoreCandidate(candidate: CatalogCandidate): boolean {
  if (candidate.movementPattern === 'core') {
    return true;
  }
  const muscle = normalizeCandidateText(candidate.primaryMuscleGroup);
  const name = normalizeCandidateText(candidate.name);
  const coreTerms = [
    'core', 'ab', 'abs', 'abdominals', 'rectus abdominis', 'oblique', 'obliques',
    'plank', 'crunch', 'dead bug', 'deadbug', 'pallof', 'hollow', 'bird dog', 'woodchop',
  ];
  return coreTerms.some((term) => muscle.includes(term) || name.includes(term));
}

function isCarryCandidate(candidate: CatalogCandidate): boolean {
  if (candidate.movementPattern === 'carry') {
    return true;
  }
  const name = normalizeCandidateText(candidate.name);
  return name.includes('carry') || name.includes('walk') || name.includes('farmer');
}

function isUnilateralExercise(candidate: CatalogCandidate): boolean {
  if (candidate.movementPattern === 'lunge') {
    return true;
  }
  const name = normalizeCandidateText(candidate.name);
  const unilateralTerms = [
    'split squat', 'bulgarian', 'single leg', 'single-leg', 'single arm', 'single-arm',
    'step up', 'step-up', 'stepup', 'pistol', 'b-stance', 'kickstand', 'one arm', 'one-arm',
    'unilateral',
  ];
  return unilateralTerms.some((term) => name.includes(term));
}

function isPosturalUpperBackCandidate(candidate: CatalogCandidate): boolean {
  if (candidate.movementPattern === 'pull') {
    return true;
  }
  const muscle = normalizeCandidateText(candidate.primaryMuscleGroup);
  const name = normalizeCandidateText(candidate.name);
  const posturalTerms = [
    'delt', 'deltoid', 'rear delt', 'trap', 'traps', 'trapezius',
    'upper back', 'rhomboid', 'face pull', 'pull-apart', 'pull apart', 'shrug', 'y-raise', 'w-raise', 'reverse fly',
  ];
  return posturalTerms.some((term) => muscle.includes(term) || name.includes(term));
}

function isGluteHipCandidate(candidate: CatalogCandidate): boolean {
  const muscle = normalizeCandidateText(candidate.primaryMuscleGroup);
  const name = normalizeCandidateText(candidate.name);
  const gluteHipTerms = [
    'glute', 'glutes', 'gluteus', 'hip', 'abductor', 'abduction', 'kickback',
    'clam', 'clamshell', 'bridge', 'thrust', 'monster walk',
  ];
  const hasGluteHipTerms = gluteHipTerms.some((term) => muscle.includes(term) || name.includes(term));

  if (candidate.movementPattern === 'hinge' && hasGluteHipTerms) {
    return true;
  }
  if (candidate.movementPattern === 'isolation' && hasGluteHipTerms) {
    return true;
  }
  if (
    name.includes('glute bridge') ||
    name.includes('hip thrust') ||
    name.includes('hip abduction') ||
    name.includes('clamshell') ||
    name.includes('cable kickback')
  ) {
    return true;
  }
  return false;
}

export function isCandidateEligibleForSlot(
  candidate: CatalogCandidate,
  slotNumber: number,
  dayType: DayTrainingType,
): boolean {
  if (dayType === 'upper') {
    if (slotNumber >= 1 && slotNumber <= 4) {
      return (
        candidate.movementPattern === 'push' ||
        candidate.movementPattern === 'pull' ||
        (candidate.movementPattern === 'isolation' && isUpperBodyCandidate(candidate))
      );
    }
    if (slotNumber === 5) {
      return isPosturalUpperBackCandidate(candidate);
    }
    if (slotNumber === 6) {
      return isCoreCandidate(candidate);
    }
    return true;
  }

  if (dayType === 'lower') {
    if (slotNumber === 1 || slotNumber === 2) {
      return candidate.movementPattern === 'squat' || candidate.movementPattern === 'hinge';
    }
    if (slotNumber === 3) {
      return (
        candidate.movementPattern === 'lunge' ||
        ((candidate.movementPattern === 'squat' || candidate.movementPattern === 'hinge') &&
          isUnilateralExercise(candidate))
      );
    }
    if (slotNumber === 4) {
      const muscle = normalizeCandidateText(candidate.primaryMuscleGroup);
      const name = normalizeCandidateText(candidate.name);
      const lowerIsoTerms = [
        'quad', 'quadriceps', 'hamstring', 'hamstrings', 'calf', 'calves',
        'gastrocnemius', 'soleus', 'leg extension', 'leg curl', 'calf raise',
      ];
      const isQuadHamCalf = lowerIsoTerms.some((term) => muscle.includes(term) || name.includes(term));
      if (isQuadHamCalf) {
        return true;
      }
      if (candidate.movementPattern === 'isolation') {
        return !isUpperBodyCandidate(candidate);
      }
      return false;
    }
    if (slotNumber === 5) {
      return isGluteHipCandidate(candidate);
    }
    if (slotNumber === 6) {
      return isCoreCandidate(candidate) || isCarryCandidate(candidate);
    }
    return true;
  }

  if (dayType === 'full_body') {
    if (slotNumber === 1) {
      return candidate.movementPattern === 'squat' || candidate.movementPattern === 'hinge';
    }
    if (slotNumber === 2) {
      return candidate.movementPattern === 'push' || candidate.movementPattern === 'pull';
    }
    if (slotNumber === 3) {
      return (
        candidate.movementPattern === 'lunge' ||
        candidate.movementPattern === 'squat' ||
        candidate.movementPattern === 'hinge' ||
        candidate.movementPattern === 'push' ||
        candidate.movementPattern === 'pull' ||
        isUnilateralExercise(candidate)
      );
    }
    if (slotNumber === 4) {
      return (
        candidate.movementPattern === 'isolation' ||
        candidate.movementPattern === 'push' ||
        candidate.movementPattern === 'pull' ||
        isUpperBodyCandidate(candidate) ||
        isLowerBodyCandidate(candidate)
      );
    }
    if (slotNumber === 5) {
      return isPosturalUpperBackCandidate(candidate);
    }
    if (slotNumber === 6) {
      return isCoreCandidate(candidate) || isCarryCandidate(candidate);
    }
    return true;
  }

  // Fallback for 'general' dayType
  if (slotNumber === 1 || slotNumber === 2) {
    return ['squat', 'hinge', 'push', 'pull'].includes(candidate.movementPattern);
  }
  if (slotNumber === 3) {
    return ['squat', 'hinge', 'push', 'pull', 'lunge'].includes(candidate.movementPattern);
  }
  if (slotNumber === 4) {
    return (
      candidate.movementPattern === 'isolation' ||
      ['push', 'pull'].includes(candidate.movementPattern)
    );
  }
  if (slotNumber === 5) {
    return isPosturalUpperBackCandidate(candidate) || isCoreCandidate(candidate);
  }
  if (slotNumber === 6) {
    return isCoreCandidate(candidate) || isCarryCandidate(candidate);
  }
  return true;
}

export function validateBlueprintSlotFeasibility(
  blueprints: DaySlotBlueprint[],
  candidates: readonly CatalogCandidate[],
): { ok: true } | { ok: false; missingSlots: Array<{ dayIndex: number; slot: number; label: string }> } {
  const missingSlots: Array<{ dayIndex: number; slot: number; label: string }> = [];

  for (let bIdx = 0; bIdx < blueprints.length; bIdx += 1) {
    const blueprint = blueprints[bIdx];
    if (!blueprint) continue;
    const dayIndex = blueprint.dayNumber ?? bIdx + 1;

    for (const slotDef of blueprint.slots) {
      const hasEligibleCandidate = candidates.some((candidate) =>
        isCandidateEligibleForSlot(candidate, slotDef.slot, blueprint.dayType),
      );
      if (!hasEligibleCandidate) {
        missingSlots.push({
          dayIndex,
          slot: slotDef.slot,
          label: slotDef.label,
        });
      }
    }
  }

  if (missingSlots.length > 0) {
    return { ok: false, missingSlots };
  }

  return { ok: true };
}

export function buildCanonicalProgression() {
  return {
    baselineIntensity: 'low-moderate' as const,
    progressionRule: CANONICAL_PROGRESSION_RULE,
    increasePercent: 10,
    conditions: ['Two pain-free sessions'],
  };
}

export function buildDefaultSafetyNotes(): string[] {
  return [
    'Use pain-free range of motion and stop if symptoms increase.',
    'Keep effort conservative while learning the movements.',
  ];
}

export function buildDefaultWarnings(): string[] {
  return [
    DISCLAIMER,
    'Stop immediately if pain increases during an exercise.',
    'Do not continue if dizziness, lightheadedness, or chest pressure appears.',
  ];
}

export function coercePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('-')) {
      return fallback;
    }
    const match = trimmed.match(/\d+/);
    if (match) {
      const parsed = Number.parseInt(match[0], 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return fallback;
}

export function coerceReps(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return String(value);
  }
  return '8-12';
}

export function buildMinimalInvalidPlan(
  candidateBuild: CandidateBuildResult | readonly CatalogCandidate[],
): WorkoutPlan {
  const candidate = Array.isArray(candidateBuild)
    ? candidateBuild[0]
    : 'candidates' in candidateBuild
      ? candidateBuild.candidates[0] ?? candidateBuild.allCandidates?.[0]
      : undefined;
  if (!candidate) {
    throw new WorkoutPlanGenerationError('No catalog candidates match the request constraints.', {
      reason: 'catalog_filtering_empty',
      issues: ['No approved catalog exercises were found for the provided profile.'],
    });
  }

  return workoutPlanSchema.parse({
    schemaVersion: '1.0',
    source: 'ai',
    days: [
      {
        dayNumber: 1,
        name: 'Day 1',
        focus: 'Full body strength',
        exercises: [
          {
            id: candidate.masterExerciseId,
            masterExerciseId: candidate.masterExerciseId,
            name: candidate.name,
            muscleGroup: candidate.primaryMuscleGroup ?? candidate.movementPattern,
            movementPattern: candidate.movementPattern,
            sets: 3,
            reps: '8-12',
            restSeconds: 60,
          },
        ],
      },
    ],
    progression: buildCanonicalProgression(),
    safetyNotes: buildDefaultSafetyNotes(),
    warnings: buildDefaultWarnings(),
  });
}

export function buildLocalWorkoutPlan(
  candidateBuild: CandidateBuildResult,
  frequencyDays: number,
  sessionMinutes?: number,
) {
  const sizing = getSessionSizingGuidance(sessionMinutes);
  const targetExerciseCount = sizing.targetExercisesPerDay;
  const pool =
    candidateBuild.candidates.length > 0 ? candidateBuild.candidates : candidateBuild.allCandidates;

  const byMovement = new Map<string, CatalogCandidate[]>();
  for (const candidate of pool) {
    const list = byMovement.get(candidate.movementPattern) ?? [];
    list.push(candidate);
    byMovement.set(candidate.movementPattern, list);
  }

  const movementPatterns = Array.from(byMovement.keys());

  const days = Array.from({ length: frequencyDays }, (_, dayIndex) => {
    const selected: CatalogCandidate[] = [];
    const usedIds = new Set<string>();

    // 1. Pick 1 exercise from distinct movement patterns rotated by dayIndex
    for (let pIdx = 0; pIdx < movementPatterns.length; pIdx += 1) {
      if (selected.length >= targetExerciseCount) break;
      const pattern = movementPatterns[(pIdx + dayIndex) % movementPatterns.length];
      const patternCandidates = pattern !== undefined ? (byMovement.get(pattern) ?? []) : [];
      const candidate = patternCandidates[(dayIndex + pIdx) % patternCandidates.length];
      if (candidate && (!usedIds.has(candidate.masterExerciseId) || selected.length < 3)) {
        usedIds.add(candidate.masterExerciseId);
        selected.push(candidate);
      }
    }

    // 2. Fill remaining slots up to targetExerciseCount from general pool
    for (let offset = 0; selected.length < targetExerciseCount && offset < pool.length * 2; offset += 1) {
      const candidateIndex = (dayIndex * 3 + offset) % pool.length;
      const candidate = pool[candidateIndex];
      if (
        candidate &&
        (!usedIds.has(candidate.masterExerciseId) || selected.length < pool.length)
      ) {
        usedIds.add(candidate.masterExerciseId);
        selected.push(candidate);
      }
    }

    const dayExercises = selected.map((candidate) => ({
      masterExerciseId: candidate.masterExerciseId,
      name: candidate.name,
      sets: 3,
      reps: candidate.movementPattern === 'mobility' ? '30-45 seconds' : '8-12',
      restSeconds: candidate.movementPattern === 'mobility' ? 45 : 60,
      ...(candidate.cluster === 'amber' && candidate.requiredModifications?.length
        ? { notes: candidate.requiredModifications.join(' ') }
        : {}),
    }));

    return {
      dayNumber: dayIndex + 1,
      name: `Day ${dayIndex + 1}`,
      focus: dayIndex % 2 === 0 ? 'Strength and posture' : 'Mobility and conditioning',
      estimatedDurationMinutes: calculateWorkoutDayDurationMinutes({ exercises: dayExercises }),
      exercises: dayExercises,
    };
  });

  return { name: 'Development catalog plan', focus: 'Catalog-backed local plan', days };
}

export function hydratePlanFromCatalog(
  rawPlan: unknown,
  candidateBuild: CandidateBuildResult | readonly CatalogCandidate[],
  context?: WorkoutPlanGenerationContext,
): CandidateValidationResult {
  const candidateById = new Map<string, CatalogCandidate>();
  const warnings: string[] = [];
  const corrections: string[] = [];
  let repaired = false;

  const allCandidates: readonly CatalogCandidate[] = Array.isArray(candidateBuild)
    ? candidateBuild
    : 'allCandidates' in candidateBuild
      ? candidateBuild.allCandidates ?? candidateBuild.candidates ?? []
      : [];

  for (const candidate of allCandidates) {
    candidateById.set(candidate.masterExerciseId, candidate);
    if (candidate.sourceId) {
      candidateById.set(candidate.sourceId, candidate);
    }
  }

  if (!rawPlan || typeof rawPlan !== 'object' || Array.isArray(rawPlan)) {
    return {
      plan: buildMinimalInvalidPlan(candidateBuild),
      ok: false,
      warnings,
      corrections: ['AI response must be a JSON object.'],
      repaired,
    };
  }

  const plan = rawPlan as {
    days?: unknown;
    source?: unknown;
  };

  if (!Array.isArray(plan.days)) {
    return {
      plan: buildMinimalInvalidPlan(candidateBuild),
      ok: false,
      warnings,
      corrections: ['AI response must include a days array.'],
      repaired,
    };
  }

  const totalDays = context?.frequencyDays ?? (plan.days.length > 0 ? plan.days.length : 1);
  const sessionMinutes = context?.sessionMinutes ?? 60;

  const hydratedDays = plan.days.map((rawDay, dayIndex) => {
    const day =
      rawDay && typeof rawDay === 'object' && !Array.isArray(rawDay)
        ? (rawDay as {
            dayNumber?: unknown;
            name?: unknown;
            focus?: unknown;
            exercises?: unknown;
          })
        : {};
    const dayNumber =
      typeof day.dayNumber === 'number' && Number.isInteger(day.dayNumber) && day.dayNumber > 0
        ? day.dayNumber
        : dayIndex + 1;
    const exercises = Array.isArray(day.exercises) ? day.exercises : [];

    const dayType = getDayTrainingType(dayNumber, totalDays);
    const blueprint = getDaySlotBlueprint(dayType, dayNumber, sessionMinutes);

    const usedCandidateIds = new Set<string>();

    const hydratedExercises = exercises.map((rawExercise, exerciseIndex) => {
      const normalizedExercise = normalizeAiExerciseKeys(rawExercise);
      const exercise =
        normalizedExercise && typeof normalizedExercise === 'object' && !Array.isArray(normalizedExercise)
          ? (normalizedExercise as {
              slot?: unknown;
              id?: unknown;
              masterExerciseId?: unknown;
              name?: unknown;
              muscleGroup?: unknown;
              movementPattern?: unknown;
              sets?: unknown;
              reps?: unknown;
              restSeconds?: unknown;
              rpe?: unknown;
              notes?: unknown;
            })
          : {};

      const slotIndex =
        typeof exercise.slot === 'number' && Number.isInteger(exercise.slot) && exercise.slot > 0
          ? exercise.slot
          : exerciseIndex + 1;
      const slotDef =
        blueprint.slots.find((s) => s.slot === slotIndex) ?? blueprint.slots[exerciseIndex];

      const resolvedSets = coercePositiveInteger(
        exercise.sets !== undefined ? exercise.sets : slotDef?.sets,
        3,
      );
      const resolvedReps = coerceReps(
        exercise.reps !== undefined ? exercise.reps : slotDef?.reps ?? '8-12',
      );
      const resolvedRestSeconds = coercePositiveInteger(
        exercise.restSeconds !== undefined ? exercise.restSeconds : slotDef?.restSeconds,
        60,
      );

      const lookupKey = getCandidateLookupKey(exercise);
      const lookupName = typeof exercise.name === 'string' ? exercise.name.trim() : '';
      let candidate = lookupKey ? candidateById.get(lookupKey) : undefined;
      if (!candidate && lookupName) {
        candidate = matchExerciseToCatalog(lookupName, allCandidates) ?? undefined;
      }

      if (!candidate) {
        corrections.push(
          `AI exercise "${lookupName || lookupKey || `at day ${dayNumber}, position ${exerciseIndex + 1}`}" does not match an approved catalog candidate.`,
        );
        const inferredMovement = inferMovementPatternFromName(lookupName);
        return {
          id: lookupKey ?? `unmapped_${dayNumber}_${exerciseIndex + 1}`,
          masterExerciseId: undefined,
          name: lookupName || 'Custom Exercise',
          muscleGroup: 'custom',
          movementPattern: inferredMovement,
          sets: resolvedSets,
          reps: resolvedReps,
          restSeconds: resolvedRestSeconds,
          ...(typeof exercise.notes === 'string' && exercise.notes.trim()
            ? { notes: exercise.notes.trim() }
            : {}),
        };
      }

      if (
        (typeof exercise.name === 'string' &&
          exercise.name.trim().toLowerCase() !== candidate.name.trim().toLowerCase()) ||
        (typeof exercise.movementPattern === 'string' &&
          exercise.movementPattern !== candidate.movementPattern) ||
        (typeof exercise.muscleGroup === 'string' &&
          candidate.primaryMuscleGroup !== undefined &&
          exercise.muscleGroup !== candidate.primaryMuscleGroup)
      ) {
        repaired = true;
      }

      usedCandidateIds.add(candidate.masterExerciseId);

      let exerciseNotes =
        typeof exercise.notes === 'string' && exercise.notes.trim()
          ? exercise.notes.trim()
          : undefined;

      if (candidate.cluster === 'amber' && candidate.requiredModifications?.length) {
        const existing = exerciseNotes ?? '';
        const missing = candidate.requiredModifications.filter(
          (mod) => !existing.toLowerCase().includes(mod.toLowerCase()),
        );
        if (missing.length > 0) {
          exerciseNotes = [existing, ...missing].filter(Boolean).join(' ');
        }
      }

      return {
        id: candidate.masterExerciseId,
        masterExerciseId: candidate.masterExerciseId,
        name: candidate.name,
        muscleGroup: candidate.primaryMuscleGroup ?? candidate.movementPattern,
        movementPattern: candidate.movementPattern,
        sets: resolvedSets,
        reps: resolvedReps,
        restSeconds: resolvedRestSeconds,
        ...(typeof exercise.slot === 'number' ? { slot: exercise.slot } : {}),
        ...(typeof exercise.rpe === 'number' && exercise.rpe >= 1 && exercise.rpe <= 10
          ? { rpe: exercise.rpe }
          : {}),
        ...(exerciseNotes ? { notes: exerciseNotes } : {}),
      };
    });

    const calculatedDuration = calculateWorkoutDayDurationMinutes({ exercises: hydratedExercises });

    return {
      dayNumber,
      name: typeof day.name === 'string' && day.name.trim() ? day.name.trim() : `Day ${dayNumber}`,
      focus:
        typeof day.focus === 'string' && day.focus.trim() ? day.focus.trim() : 'Full body strength',
      estimatedDurationMinutes: calculatedDuration,
      exercises: hydratedExercises,
    };
  });

  const hydratedPlan = workoutPlanSchema.parse({
    schemaVersion: '1.0',
    source: 'ai',
    days: hydratedDays,
    progression: buildCanonicalProgression(),
    safetyNotes: buildDefaultSafetyNotes(),
    warnings: buildDefaultWarnings(),
  });

  injectRequiredCandidateModifications(hydratedPlan, allCandidates);

  return {
    plan: hydratedPlan,
    ok: corrections.length === 0,
    warnings,
    corrections,
    repaired,
  };
}

export function injectRequiredCandidateModifications(
  plan: WorkoutPlan,
  candidates: readonly CatalogCandidate[],
): boolean {
  const candidatesById = new Map<string, CatalogCandidate>();
  for (const candidate of candidates) {
    candidatesById.set(candidate.masterExerciseId, candidate);
    if (candidate.sourceId) {
      candidatesById.set(candidate.sourceId, candidate);
    }
  }
  let injected = false;

  for (const day of plan.days) {
    for (const exercise of day.exercises) {
      const key = exercise.masterExerciseId || exercise.id;
      const candidate = key ? candidatesById.get(key) : undefined;
      if (!candidate || candidate.cluster !== 'amber' || !candidate.requiredModifications?.length) {
        continue;
      }
      const existingNotes = exercise.notes?.trim() ?? '';
      const missingModifications = candidate.requiredModifications.filter(
        (modification) => !existingNotes.toLowerCase().includes(modification.toLowerCase()),
      );
      if (missingModifications.length === 0) continue;
      exercise.notes = [existingNotes, ...missingModifications].filter(Boolean).join(' ');
      injected = true;
    }
  }

  return injected;
}

export function repairExcessAmberCandidates(
  plan: WorkoutPlan,
  candidateBuild: CandidateBuildResult,
  maxAmberPerDay = 1,
): { plan: WorkoutPlan; repaired: boolean } {
  const candidatesById = new Map(
    candidateBuild.allCandidates.map((candidate) => [candidate.masterExerciseId, candidate]),
  );

  const usedIds = new Set<string>();
  for (const day of plan.days) {
    for (const exercise of day.exercises) {
      if (exercise.masterExerciseId) {
        usedIds.add(exercise.masterExerciseId);
      }
    }
  }

  const greenByMovement = new Map<string, CatalogCandidate[]>();
  for (const candidate of candidateBuild.clusters.green) {
    const list = greenByMovement.get(candidate.movementPattern) ?? [];
    list.push(candidate);
    greenByMovement.set(candidate.movementPattern, list);
  }

  let repaired = false;

  const newDays = plan.days.map((day) => {
    let amberCount = 0;
    const newExercises = day.exercises.map((exercise) => {
      const candidate = exercise.masterExerciseId
        ? candidatesById.get(exercise.masterExerciseId)
        : undefined;

      if (!candidate || candidate.cluster !== 'amber') {
        return exercise;
      }

      amberCount += 1;
      if (amberCount <= maxAmberPerDay) {
        return exercise;
      }

      const greenPool = greenByMovement.get(exercise.movementPattern) ?? [];
      const replacement = greenPool.find((c) => !usedIds.has(c.masterExerciseId));

      if (replacement) {
        if (exercise.masterExerciseId) {
          usedIds.delete(exercise.masterExerciseId);
        }
        usedIds.add(replacement.masterExerciseId);
        repaired = true;
        return {
          ...exercise,
          id: replacement.masterExerciseId,
          masterExerciseId: replacement.masterExerciseId,
          name: replacement.name,
          muscleGroup: replacement.primaryMuscleGroup ?? replacement.movementPattern,
        };
      }

      return exercise;
    });

    return { ...day, exercises: newExercises };
  });

  if (!repaired) {
    return { plan, repaired: false };
  }

  const newPlan = workoutPlanSchema.parse({
    ...plan,
    days: newDays,
  });

  return { plan: newPlan, repaired: true };
}

export function validatePlanCatalogMembership(
  plan: WorkoutPlan,
  candidateBuild: CandidateBuildResult,
): { ok: boolean; issues: string[] } {
  const approvedIds = new Set(
    candidateBuild.candidates.map((candidate) => candidate.masterExerciseId),
  );
  const issues: string[] = [];

  for (const day of plan.days) {
    for (const exercise of day.exercises) {
      if (!exercise.masterExerciseId) {
        issues.push(`Missing masterExerciseId for exercise on day ${day.dayNumber ?? 'unknown'}.`);
        continue;
      }
      if (!approvedIds.has(exercise.masterExerciseId)) {
        issues.push(`Invalid masterExerciseId "${exercise.masterExerciseId}".`);
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

export function isInternalGenerationWarning(warning: string): boolean {
  return warning.startsWith('Canonicalized exercise ');
}

export function uniqueUserVisibleWarnings(warnings: readonly string[]): string[] {
  return Array.from(new Set(warnings.filter((warning) => !isInternalGenerationWarning(warning))));
}

export function normalizeExerciseFingerprintValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildDayExerciseFingerprint(day: WorkoutDayWithExercises): string {
  return day.exercises
    .map((exercise) =>
      [
        normalizeExerciseFingerprintValue(exercise.name),
        exercise.movementPattern,
        normalizeExerciseFingerprintValue(exercise.reps),
        String(exercise.sets),
      ].join(':'),
    )
    .join('|');
}

export function allWorkoutDaysHaveSameExerciseFingerprint(
  days: WorkoutDayWithExercises[],
): boolean {
  if (days.length <= 1) {
    return false;
  }

  const fingerprints = days.map((day) => buildDayExerciseFingerprint(day));
  const first = fingerprints[0];

  return first !== undefined && fingerprints.every((fingerprint) => fingerprint === first);
}

export function validateAiGenerationQuality(
  plan: WorkoutPlan,
  context: WorkoutPlanGenerationContext,
  candidateBuild?: CandidateBuildResult,
) {
  const warnings: string[] = [];
  const corrections: string[] = [];

  if (plan.days.length !== context.frequencyDays) {
    warnings.push(
      `AI returned ${plan.days.length} day(s), but ${context.frequencyDays} requested; generation rejected.`,
    );
    corrections.push(`AI day count mismatch with requested frequency (${context.frequencyDays}).`);
    return { ok: false, warnings, corrections };
  }

  if (!plan.days.every((day) => day.exercises.length > 0)) {
    warnings.push('AI returned a day with zero exercises; generation rejected.');
    corrections.push('Removed empty training day from AI output.');
    return { ok: false, warnings, corrections };
  }

  for (const day of plan.days) {
    const dayType = getDayTrainingType(day.dayNumber, context.frequencyDays);
    const blueprint = getDaySlotBlueprint(dayType, day.dayNumber, context.sessionMinutes);

    const seenMasterExerciseIds = new Set<string>();
    for (const exercise of day.exercises) {
      const masterExerciseId = exercise.masterExerciseId ?? exercise.id;
      if (!masterExerciseId) {
        continue;
      }
      if (seenMasterExerciseIds.has(masterExerciseId)) {
        warnings.push(
          `Day ${day.dayNumber} repeats catalog exercise "${masterExerciseId}"; each workout day must use distinct catalog exercises.`,
        );
        corrections.push(
          `Day ${day.dayNumber} repeats catalog exercise "${masterExerciseId}"; each workout day must use distinct catalog exercises.`,
        );
        return { ok: false, warnings, corrections };
      }
      seenMasterExerciseIds.add(masterExerciseId);
    }

    const hasAnySlot = day.exercises.some(
      (exercise) => typeof (exercise as { slot?: unknown }).slot === 'number',
    );
    if (hasAnySlot) {
      const seenSlots = new Set<number>();
      for (const exercise of day.exercises) {
        const slot = (exercise as { slot?: unknown }).slot;
        if (typeof slot !== 'number') {
          warnings.push(`Day ${day.dayNumber} contains exercise without a specified slot.`);
          corrections.push(
            `Every exercise in Day ${day.dayNumber} must have a valid slot from 1 to ${blueprint.slotCount}.`,
          );
          return { ok: false, warnings, corrections };
        }
        if (seenSlots.has(slot)) {
          warnings.push(`Day ${day.dayNumber} contains duplicate slot ${slot}.`);
          corrections.push(
            `Day ${day.dayNumber} has duplicate slot ${slot}; slots 1 through ${blueprint.slotCount} must each appear exactly once.`,
          );
          return { ok: false, warnings, corrections };
        }
        seenSlots.add(slot);
      }

      for (let s = 1; s <= blueprint.slotCount; s += 1) {
        if (!seenSlots.has(s)) {
          warnings.push(`Day ${day.dayNumber} is missing required slot ${s}.`);
          corrections.push(
            `Day ${day.dayNumber} is missing slot ${s}; slots 1 through ${blueprint.slotCount} must each appear exactly once.`,
          );
          return { ok: false, warnings, corrections };
        }
      }
    }
  }

  if (allWorkoutDaysHaveSameExerciseFingerprint(plan.days)) {
    warnings.push('AI returned identical workout days; generation rejected.');
    corrections.push('Every workout day must vary exercise selection, order, reps, or sets.');
    return { ok: false, warnings, corrections };
  }

  const candidateCount = new Set(
    (candidateBuild?.candidates ?? []).map((candidate) => candidate.masterExerciseId),
  ).size;
  for (let leftIndex = 0; leftIndex < plan.days.length; leftIndex += 1) {
    const leftDay = plan.days[leftIndex];
    if (!leftDay) {
      continue;
    }
    const leftIds = getDayMasterExerciseIds(leftDay);
    for (let rightIndex = leftIndex + 1; rightIndex < plan.days.length; rightIndex += 1) {
      const rightDay = plan.days[rightIndex];
      if (!rightDay) {
        continue;
      }
      const rightIds = getDayMasterExerciseIds(rightDay);
      const largestDaySize = Math.max(leftIds.size, rightIds.size);
      if (candidateCount <= largestDaySize) {
        continue;
      }
      const overlapCount = countSetIntersection(leftIds, rightIds);
      if (overlapCount < 2) {
        continue;
      }
      const overlapRatio = overlapCount / largestDaySize;
      if (overlapRatio >= MAX_DAY_CATALOG_OVERLAP_RATIO) {
        corrections.push(
          `Days ${leftDay.dayNumber} and ${rightDay.dayNumber} reuse ${overlapCount} of ${largestDaySize} catalog exercises; rotate more approved catalog exercises across workout days.`,
        );
        return { ok: false, warnings, corrections };
      }
    }
  }

  if (context.postureFlags.roundedShoulders) {
    const pullingSets = plan.days.reduce((total, day) => {
      return (
        total +
        day.exercises.reduce((subtotal, exercise) => {
          return exercise.movementPattern === 'pull' ? subtotal + exercise.sets : subtotal;
        }, 0)
      );
    }, 0);
    const pushingSets = plan.days.reduce((total, day) => {
      return (
        total +
        day.exercises.reduce((subtotal, exercise) => {
          return exercise.movementPattern === 'push' ? subtotal + exercise.sets : subtotal;
        }, 0)
      );
    }, 0);

    if (pullingSets < pushingSets) {
      warnings.push(
        `AI output failed rounded-shoulders constraint (push ${pushingSets} vs pull ${pullingSets}); generation rejected.`,
      );
      corrections.push('Rounded shoulders policy requires pull volume >= push volume.');
      return { ok: false, warnings, corrections };
    }
  }

  const sizing = getSessionSizingGuidance(context.sessionMinutes);

  for (const day of plan.days) {
    if (day.exercises.length < sizing.minExercisesPerDay) {
      warnings.push(
        `AI returned Day ${day.dayNumber} with ${day.exercises.length} exercise(s), but minimum ${sizing.minExercisesPerDay} required for a ${sizing.sessionMinutes}-minute session.`,
      );
      corrections.push(
        `Day ${day.dayNumber} has only ${day.exercises.length} exercises; minimum ${sizing.minExercisesPerDay} exercises required for a ${sizing.sessionMinutes}m duration window.`,
      );
      return { ok: false, warnings, corrections };
    }

    if (context.frequencyDays >= 2) {
      const hasResistanceMovement = day.exercises.some((exercise) =>
        ['push', 'pull', 'squat', 'hinge', 'lunge'].includes(exercise.movementPattern),
      );
      if (!hasResistanceMovement) {
        warnings.push(`AI returned Day ${day.dayNumber} containing only core/mobility exercises.`);
        corrections.push(
          `Day ${day.dayNumber} must contain multi-joint compound resistance movements (squat/hinge/press/pull), not just core or balance exercises.`,
        );
        return { ok: false, warnings, corrections };
      }
    }

    const hasInvalidMovement = day.exercises.some(
      (exercise) => !WORKOUT_PLAN_MOVEMENT_PATTERNS.includes(exercise.movementPattern),
    );
    if (hasInvalidMovement) {
      warnings.push(
        `AI returned Day ${day.dayNumber} containing exercise with unrecognized movement pattern.`,
      );
      corrections.push(`Day ${day.dayNumber} exercises must have valid movement patterns.`);
      return { ok: false, warnings, corrections };
    }

    const calculatedDuration =
      typeof day.estimatedDurationMinutes === 'number' && day.estimatedDurationMinutes > 0
        ? day.estimatedDurationMinutes
        : calculateWorkoutDayDurationMinutes(day);
    const minAcceptableDuration = Math.round(sizing.sessionMinutes * 0.65);
    if (calculatedDuration < minAcceptableDuration) {
      warnings.push(
        `AI returned Day ${day.dayNumber} with estimated duration ~${calculatedDuration}m, significantly shorter than requested ${sizing.sessionMinutes}m workout.`,
      );
      corrections.push(
        `Day ${day.dayNumber} estimated duration (~${calculatedDuration}m) is far too short for requested ${sizing.sessionMinutes}m session. Must provide adequate exercises and working sets.`,
      );
      return { ok: false, warnings, corrections };
    }
  }

  return { ok: true, warnings, corrections };
}

function getDayMasterExerciseIds(day: WorkoutDayWithExercises): Set<string> {
  return new Set(
    day.exercises
      .map((exercise) => exercise.masterExerciseId)
      .filter((masterExerciseId): masterExerciseId is string => Boolean(masterExerciseId)),
  );
}

function countSetIntersection(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) {
      count += 1;
    }
  }
  return count;
}
