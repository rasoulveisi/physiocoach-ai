import { z } from 'zod';
import { matchExerciseToCatalog } from '../exercise-matching';
import { CANONICAL_PROGRESSION_RULE, WORKOUT_PLAN_MOVEMENT_PATTERNS } from '../../types/workout-plan-contract';
import { DISCLAIMER, workoutPlanSchema, type WorkoutPlan } from '../../types/workout';
import type { WorkoutPlanGenerationContext } from '../../types/ai';
import type { CatalogCandidate } from '../../types/workout-generator';
import type { CandidateBuildResult } from './candidates';
import { WorkoutPlanGenerationError } from './errors';

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

export function normalizeAiExerciseKeys(val: unknown): unknown {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    return val;
  }
  const obj = { ...val } as Record<string, unknown>;

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
      obj.restSeconds = isNaN(parsed) || parsed <= 0 ? 60 : parsed;
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

  return obj;
}

export const leanAiExerciseSchema = z.preprocess(
  normalizeAiExerciseKeys,
  z
    .object({
      name: z.string().min(1),
      id: z.string().min(1).optional(),
      masterExerciseId: z.string().min(1).optional(),
      movementPattern: z.string().optional(),
      muscleGroup: z.string().optional(),
      sets: z.number().int().min(1),
      reps: z.union([z.string().min(1), z.number().positive()]),
      restSeconds: z.number().int().min(1).default(60),
      notes: z.string().min(1).max(180).optional(),
    })
    .strict(),
);

export const leanAiWorkoutPlanSchema = z
  .object({
    name: z.string().min(1).optional(),
    focus: z.string().min(1).optional(),
    days: z
      .array(
        z.preprocess(
          normalizeAiDayKeys,
          z
            .object({
              dayNumber: z.number().int().min(1),
              name: z.string().min(1).optional(),
              focus: z.string().min(1).optional(),
              exercises: z.array(leanAiExerciseSchema).min(1),
            })
            .strict(),
        ),
      )
      .min(1),
  })
  .strict();

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
    const parsed = Number.parseInt(value.replace(/\D/g, ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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

export function buildMinimalInvalidPlan(candidateBuild: CandidateBuildResult): WorkoutPlan {
  const candidate = candidateBuild.candidates[0];
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

export function buildLocalWorkoutPlan(candidateBuild: CandidateBuildResult, frequencyDays: number) {
  const pool = candidateBuild.candidates.length > 0 ? candidateBuild.candidates : candidateBuild.allCandidates;

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
      if (selected.length >= 5) break;
      const pattern = movementPatterns[(pIdx + dayIndex) % movementPatterns.length];
      const patternCandidates = pattern !== undefined ? (byMovement.get(pattern) ?? []) : [];
      const candidate = patternCandidates[(dayIndex + pIdx) % patternCandidates.length];
      if (candidate && (!usedIds.has(candidate.masterExerciseId) || selected.length < 3)) {
        usedIds.add(candidate.masterExerciseId);
        selected.push(candidate);
      }
    }

    // 2. Fill remaining slots up to 5 exercises from general pool
    for (let offset = 0; selected.length < 5 && offset < pool.length * 2; offset += 1) {
      const candidateIndex = (dayIndex * 3 + offset) % pool.length;
      const candidate = pool[candidateIndex];
      if (candidate && (!usedIds.has(candidate.masterExerciseId) || selected.length < pool.length)) {
        usedIds.add(candidate.masterExerciseId);
        selected.push(candidate);
      }
    }

    return {
      dayNumber: dayIndex + 1,
      name: `Day ${dayIndex + 1}`,
      focus: dayIndex % 2 === 0 ? 'Strength and posture' : 'Mobility and conditioning',
      exercises: selected.map((candidate) => ({
        masterExerciseId: candidate.masterExerciseId,
        name: candidate.name,
        sets: 3,
        reps: candidate.movementPattern === 'mobility' ? '30-45 seconds' : '8-12',
        restSeconds: candidate.movementPattern === 'mobility' ? 45 : 60,
        ...(candidate.cluster === 'amber' && candidate.requiredModifications?.length
          ? { notes: candidate.requiredModifications.join(' ') }
          : {}),
      })),
    };
  });

  return { name: 'Development catalog plan', focus: 'Catalog-backed local plan', days };
}

export function hydratePlanFromCatalog(
  rawPlan: unknown,
  candidateBuild: CandidateBuildResult,
): CandidateValidationResult {
  const byId = new Map<string, CatalogCandidate>();
  const warnings: string[] = [];
  const corrections: string[] = [];
  let repaired = false;

  for (const candidate of candidateBuild.allCandidates) {
    byId.set(candidate.masterExerciseId, candidate);
    if (candidate.sourceId) {
      byId.set(candidate.sourceId, candidate);
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

    const usedCandidateIds = new Set<string>();

    return {
      dayNumber,
      name: typeof day.name === 'string' && day.name.trim() ? day.name.trim() : `Day ${dayNumber}`,
      focus:
        typeof day.focus === 'string' && day.focus.trim() ? day.focus.trim() : 'Full body strength',
      exercises: exercises.map((rawExercise, exerciseIndex) => {
        const exercise =
          rawExercise && typeof rawExercise === 'object' && !Array.isArray(rawExercise)
            ? (rawExercise as {
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
        const lookupName = typeof exercise.name === 'string' ? exercise.name : '';
        const lookupKey = getCandidateLookupKey(exercise);
        let candidate = lookupKey ? byId.get(lookupKey) : undefined;
        if (!candidate && lookupName) {
          candidate = matchExerciseToCatalog(lookupName, candidateBuild.allCandidates) ?? undefined;
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
            sets: coercePositiveInteger(exercise.sets, 3),
            reps: coerceReps(exercise.reps),
            restSeconds: coercePositiveInteger(exercise.restSeconds, 60),
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

        return {
          id: candidate.masterExerciseId,
          masterExerciseId: candidate.masterExerciseId,
          name: candidate.name,
          muscleGroup: candidate.primaryMuscleGroup ?? candidate.movementPattern,
          movementPattern: candidate.movementPattern,
          sets: coercePositiveInteger(exercise.sets, 3),
          reps: coerceReps(exercise.reps),
          restSeconds: coercePositiveInteger(exercise.restSeconds, 60),
          ...(typeof exercise.rpe === 'number' && exercise.rpe >= 1 && exercise.rpe <= 10
            ? { rpe: exercise.rpe }
            : {}),
          ...(typeof exercise.notes === 'string' && exercise.notes.trim()
            ? { notes: exercise.notes.trim() }
            : {}),
        };
      }),
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
  const candidatesById = new Map(
    candidates.map((candidate) => [candidate.masterExerciseId, candidate]),
  );
  let injected = false;

  for (const day of plan.days) {
    for (const exercise of day.exercises) {
      const candidate = exercise.masterExerciseId
        ? candidatesById.get(exercise.masterExerciseId)
        : undefined;
      if (candidate?.cluster !== 'amber' || !candidate.requiredModifications?.length) continue;
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

export function allWorkoutDaysHaveSameExerciseFingerprint(days: WorkoutDayWithExercises[]): boolean {
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
    const seenMasterExerciseIds = new Set<string>();
    for (const exercise of day.exercises) {
      const masterExerciseId = exercise.masterExerciseId;
      if (!masterExerciseId) {
        continue;
      }
      if (seenMasterExerciseIds.has(masterExerciseId)) {
        corrections.push(
          `Day ${day.dayNumber} repeats catalog exercise "${masterExerciseId}"; each workout day must use distinct catalog exercises.`,
        );
        return { ok: false, warnings, corrections };
      }
      seenMasterExerciseIds.add(masterExerciseId);
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
