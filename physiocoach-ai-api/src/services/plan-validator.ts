import {
  DISCLAIMER,
  type WorkoutExercise,
  type WorkoutDay,
  type WorkoutPlan,
  workoutPlanSchema,
} from '../types/workout';

export const BEGINNER_WEEKLY_MUSCLE_SET_CAP = 20;

export const limitationRiskNames = [
  'rounded_shoulders',
  'shoulder_pain',
  'knee_pain',
  'lower_back_pain',
  'neck_pain',
] as const;

import type {
  LimitationRiskName,
  PostureFlags,
  SafetyContext,
  SafetyResult,
} from '../types/safety';
import type { CatalogCandidate } from '../types/workout-generator';

export type { LimitationRiskName, PostureFlags, SafetyContext, SafetyResult };

export const MAX_AMBER_PER_DAY = 1;

/** Validates catalog safety clusters after IDs have been hydrated from an AI response. */
export function validateCandidatePlan(
  plan: {
    days: readonly {
      dayNumber?: number;
      exercises: readonly { masterExerciseId?: string | undefined }[];
    }[];
  },
  candidates: readonly CatalogCandidate[],
  candidateBuild?: { clusters: { green: readonly CatalogCandidate[] } },
): { ok: boolean; issues: string[] } {
  const candidatesById = new Map(
    candidates.map((candidate) => [candidate.masterExerciseId, candidate]),
  );
  const greenMovements = new Set(
    candidateBuild?.clusters.green.map((c) => c.movementPattern) ?? [],
  );
  const issues: string[] = [];

  for (const day of plan.days) {
    let amberCount = 0;
    for (const exercise of day.exercises) {
      const candidate = exercise.masterExerciseId
        ? candidatesById.get(exercise.masterExerciseId)
        : undefined;
      if (!candidate) continue;
      if (candidate.cluster === 'red') {
        issues.push(
          `Day ${day.dayNumber ?? 'unknown'} selected excluded catalog exercise "${candidate.masterExerciseId}".`,
        );
      }
      if (candidate.cluster === 'amber') {
        if (!candidateBuild || greenMovements.has(candidate.movementPattern)) {
          amberCount += 1;
        }
      }
    }
    if (amberCount > MAX_AMBER_PER_DAY) {
      issues.push(
        `Day ${day.dayNumber ?? 'unknown'} contains ${amberCount} amber candidates; at most ${MAX_AMBER_PER_DAY} is allowed.`,
      );
    }
  }

  return { ok: issues.length === 0, issues };
}

interface ExerciseLocation {
  day: WorkoutDay;
  exercise: WorkoutExercise;
  dayIndex: number;
  exerciseIndex: number;
}

function addUniqueWarning(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) {
    warnings.push(warning);
  }
}

function addUniqueCorrection(corrections: string[], correction: string): void {
  if (!corrections.includes(correction)) {
    corrections.push(correction);
  }
}

const riskyExercisePatternsByLimitation: Partial<Record<LimitationRiskName, readonly string[]>> = {
  shoulder_pain: ['behind-neck press', 'upright row'],
  knee_pain: ['jump squat', 'deep sissy squat'],
  lower_back_pain: ['heavy good morning', 'max deadlift'],
  neck_pain: ['neck bridge', 'behind-neck press'],
} as const;

function clonePlan(plan: WorkoutPlan): WorkoutPlan {
  return {
    ...plan,
    safetyNotes: [...plan.safetyNotes],
    warnings: [...plan.warnings],
    days: plan.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((exercise) => ({ ...exercise })),
    })),
  };
}

function getLimitationsFromPostureFlags(postureFlags: PostureFlags): LimitationRiskName[] {
  const limitations: LimitationRiskName[] = [];

  if (postureFlags.roundedShoulders) {
    limitations.push('rounded_shoulders');
  }

  if (postureFlags.shoulderPain) {
    limitations.push('shoulder_pain');
  }

  if (postureFlags.kneePain) {
    limitations.push('knee_pain');
  }

  if (postureFlags.lowerBackPain) {
    limitations.push('lower_back_pain');
  }

  if (postureFlags.neckPain) {
    limitations.push('neck_pain');
  }

  return limitations;
}

function getLimitationRiskNames(context: SafetyContext): LimitationRiskName[] {
  const limitations = new Set<LimitationRiskName>(
    getLimitationsFromPostureFlags(context.postureFlags),
  );

  for (const limitation of context.limitations) {
    if (limitationRiskNames.includes(limitation as LimitationRiskName)) {
      limitations.add(limitation as LimitationRiskName);
    }
  }

  return [...limitations];
}

function getWeeklyExercisesByMuscle(plan: WorkoutPlan): Map<string, ExerciseLocation[]> {
  const weeklyExercisesByMuscle = new Map<string, ExerciseLocation[]>();

  plan.days.forEach((day, dayIndex) => {
    day.exercises.forEach((exercise, exerciseIndex) => {
      const normalizedMuscleGroup = exercise.muscleGroup.trim().toLowerCase();
      const exercises = weeklyExercisesByMuscle.get(normalizedMuscleGroup) ?? [];
      exercises.push({ day, exercise, dayIndex, exerciseIndex });
      weeklyExercisesByMuscle.set(normalizedMuscleGroup, exercises);
    });
  });

  return weeklyExercisesByMuscle;
}

function countExercises(plan: WorkoutPlan): number {
  return plan.days.reduce((total, day) => total + day.exercises.length, 0);
}

function capBeginnerMuscleVolume(
  plan: WorkoutPlan,
  warnings: string[],
  corrections: string[],
): void {
  const maxPasses = Math.max(1, countExercises(plan) + plan.days.length);

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;
    const weeklyExercisesByMuscle = getWeeklyExercisesByMuscle(plan);

    for (const [muscleGroup, exerciseLocations] of weeklyExercisesByMuscle) {
      const totalSets = exerciseLocations.reduce(
        (total, location) => total + location.exercise.sets,
        0,
      );

      if (totalSets <= BEGINNER_WEEKLY_MUSCLE_SET_CAP) {
        continue;
      }

      let excessSets = totalSets - BEGINNER_WEEKLY_MUSCLE_SET_CAP;

      for (const { exercise } of [...exerciseLocations].reverse()) {
        if (excessSets === 0) {
          break;
        }

        const removableSets = Math.min(exercise.sets - 1, excessSets);

        if (removableSets === 0) {
          continue;
        }

        exercise.sets -= removableSets;
        excessSets -= removableSets;
        changed = true;
      }

      if (excessSets > 0) {
        for (const { day, exercise, dayIndex, exerciseIndex } of [...exerciseLocations].reverse()) {
          if (excessSets <= 0) {
            break;
          }

          if (!day.exercises[exerciseIndex] || day.exercises[exerciseIndex] !== exercise) {
            continue;
          }

          if (day.exercises.length === 1) {
            const replacement = getConservativeReplacementExercise(day);
            const normalizedReplacementMuscleGroup = replacement.muscleGroup.trim().toLowerCase();

            if (
              normalizedReplacementMuscleGroup === muscleGroup &&
              plan.days.length > 1 &&
              plan.days[dayIndex] === day
            ) {
              plan.days.splice(dayIndex, 1);
            } else {
              day.exercises.splice(exerciseIndex, 1, replacement);

              const warning = `Added conservative replacement exercise to ${day.name} because safety filtering removed every exercise.`;
              addUniqueWarning(warnings, warning);
              corrections.push(warning);
            }
          } else {
            day.exercises.splice(exerciseIndex, 1);
          }

          excessSets -= exercise.sets;
          changed = true;
        }
      }

      const warning = `Beginner ${muscleGroup} volume capped at 20 sets per week.`;
      addUniqueWarning(warnings, warning);
      addUniqueCorrection(corrections, warning);
    }

    if (!changed) {
      break;
    }
  }
}

function validateRoundedShouldersPullVolume(plan: WorkoutPlan, warnings: string[]): boolean {
  const pushingSets = countSetsByMovementPattern(plan, 'push');
  const pullingSets = countSetsByMovementPattern(plan, 'pull');

  if (pullingSets >= pushingSets) {
    return true;
  }

  addUniqueWarning(
    warnings,
    'Rounded shoulders risk: pulling volume should meet or exceed pushing volume.',
  );
  return false;
}

function removeRiskyExercisesForLimitations(
  plan: WorkoutPlan,
  limitations: LimitationRiskName[],
  warnings: string[],
  corrections: string[],
): void {
  for (const limitation of limitations) {
    const riskyNames = riskyExercisePatternsByLimitation[limitation];

    if (!riskyNames) {
      continue;
    }

    for (const day of plan.days) {
      day.exercises = day.exercises.filter((exercise) => {
        const normalizedExerciseName = exercise.name.trim().toLowerCase();
        const riskyName = riskyNames.find((name) => normalizedExerciseName.includes(name));

        if (!riskyName) {
          return true;
        }

        const warning = `Removed risky exercise pattern for ${limitation}: ${riskyName}.`;
        addUniqueWarning(warnings, warning);
        corrections.push(warning);
        return false;
      });
    }
  }
}

function getConservativeReplacementExercise(day: WorkoutDay): WorkoutExercise {
  const normalizedDayText = `${day.name} ${day.focus ?? ''}`.toLowerCase();
  const isUpperBodyDay =
    normalizedDayText.includes('upper') ||
    normalizedDayText.includes('push') ||
    normalizedDayText.includes('pull') ||
    normalizedDayText.includes('chest') ||
    normalizedDayText.includes('back') ||
    normalizedDayText.includes('shoulder') ||
    normalizedDayText.includes('arm');

  if (isUpperBodyDay) {
    return {
      id: 'safe_replace_upper',
      name: 'Chest-supported row',
      muscleGroup: 'back',
      movementPattern: 'pull',
      sets: 3,
      reps: '10-12',
      rpe: 6,
      restSeconds: 90,
      notes: 'Conservative safety replacement after removing risky exercises.',
    };
  }

  return {
    id: 'safe_replace_lower',
    name: 'Goblet squat',
    muscleGroup: 'legs',
    movementPattern: 'squat',
    sets: 3,
    reps: '8-10',
    rpe: 6,
    restSeconds: 90,
    notes: 'Conservative safety replacement after removing risky exercises.',
  };
}

// Ensure at least one exercise exists on each day
function addSafeReplacementExercisesForEmptyDays(
  plan: WorkoutPlan,
  warnings: string[],
  corrections: string[],
): void {
  for (const day of plan.days) {
    if (day.exercises.length > 0) {
      continue;
    }

    day.exercises.push(getConservativeReplacementExercise(day));

    const warning = `Added conservative replacement exercise to ${day.name} because safety filtering removed every exercise.`;
    addUniqueWarning(warnings, warning);
    corrections.push(warning);
  }
}

function countSetsByMovementPattern(plan: WorkoutPlan, movementPattern: 'push' | 'pull'): number {
  return plan.days.reduce(
    (dayTotal, day) =>
      dayTotal +
      day.exercises.reduce(
        (exerciseTotal, exercise) =>
          exercise.movementPattern === movementPattern
            ? exerciseTotal + exercise.sets
            : exerciseTotal,
        0,
      ),
    0,
  );
}

export function validateWorkoutPlan(candidatePlan: unknown, context: SafetyContext): SafetyResult {
  const parsedPlan = workoutPlanSchema.parse(candidatePlan);
  const plan = clonePlan(parsedPlan);
  const warnings: string[] = [...plan.warnings];
  const corrections: string[] = [];
  const safetyFailures: string[] = [];
  const limitations = getLimitationRiskNames(context);

  addUniqueWarning(warnings, DISCLAIMER);

  removeRiskyExercisesForLimitations(plan, limitations, warnings, corrections);
  addSafeReplacementExercisesForEmptyDays(plan, warnings, corrections);

  if (context.experienceLevel === 'beginner') {
    capBeginnerMuscleVolume(plan, warnings, corrections);
  }

  if (
    limitations.includes('rounded_shoulders') &&
    !validateRoundedShouldersPullVolume(plan, warnings)
  ) {
    safetyFailures.push(
      'Rounded shoulders risk: pulling volume should meet or exceed pushing volume.',
    );
  }

  plan.warnings = warnings;
  const correctedPlan = workoutPlanSchema.parse(plan);

  return {
    ok: safetyFailures.length === 0,
    correctedPlan,
    warnings,
    corrections,
  };
}
