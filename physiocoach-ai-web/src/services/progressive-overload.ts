type UnitSystem = 'metric' | 'imperial';

export interface PerformanceRecord {
  weight: number;
  reps: number;
  rpe?: number | null;
  date?: string | null;
}

export interface ProgressiveOverloadInput {
  exerciseName: string;
  currentWeightKg: number;
  currentReps: number;
  targetReps?: number | string;
  previousPerformance?: PerformanceRecord | null;
  recentPainScore?: number | null;
  unitSystem?: UnitSystem;
}

type OverloadType = 'overload' | 'deload' | 'maintain' | 'baseline';

export interface OverloadRecommendation {
  type: OverloadType;
  recommendedWeightKg: number;
  recommendedReps: number;
  deltaWeightKg: number;
  deltaReps: number;
  chipLabel: string;
  buttonLabel: string;
  reason: string;
  badgeVariant: 'lime' | 'amber' | 'danger' | 'cyan';
  isApplicable: boolean;
}

/**
 * Calculates biomechanically sound progressive overload or deload targets
 * based on previous performance RPE / RIR and joint discomfort history.
 */
export function calculateProgressiveOverload(
  input: ProgressiveOverloadInput,
): OverloadRecommendation {
  const {
    currentWeightKg,
    currentReps,
    targetReps,
    previousPerformance,
    recentPainScore = 0,
    unitSystem = 'metric',
  } = input;

  const isImperial = unitSystem === 'imperial';
  const unitLabel = isImperial ? 'lbs' : 'kg';

  // Helper for displaying weight in the active unit
  const toDisplayWeight = (kg: number): number => {
    if (isImperial) {
      return Math.round(kg * 2.20462 * 10) / 10;
    }
    return Math.round(kg * 10) / 10;
  };

  // Helper to convert display increment back to kg
  const weightStepKg = isImperial ? 5 / 2.20462 : 2.5; // +5 lbs or +2.5 kg
  const weightStepDisplay = isImperial ? 5 : 2.5;

  const parsedTargetReps =
    typeof targetReps === 'number'
      ? targetReps
      : typeof targetReps === 'string' && !isNaN(Number(targetReps))
      ? Number(targetReps)
      : currentReps || 10;

  // 1. Joint Discomfort / Pain Flare-up Deload Rule (Pain >= 4)
  if (recentPainScore !== null && recentPainScore !== undefined && recentPainScore >= 4) {
    const baseWeight =
      previousPerformance?.weight && previousPerformance.weight > 0
        ? previousPerformance.weight
        : currentWeightKg;

    // Conservative 10% deload
    const deloadWeightKg = Math.max(0, Math.round(baseWeight * 0.9 * 2) / 2);
    const displayDeload = toDisplayWeight(deloadWeightKg);

    return {
      type: 'deload',
      recommendedWeightKg: deloadWeightKg,
      recommendedReps: parsedTargetReps,
      deltaWeightKg: deloadWeightKg - baseWeight,
      deltaReps: 0,
      chipLabel: `Deload: ${displayDeload} ${unitLabel} (-10%)`,
      buttonLabel: 'Apply',
      reason: 'Deload -10% for recovery.',
      badgeVariant: 'amber',
      isApplicable: true,
    };
  }

  // 2. Performance-Driven Overload Rule (Previous Session RPE <= 8 or RIR >= 2)
  if (previousPerformance && previousPerformance.weight > 0) {
    const prevWeight = previousPerformance.weight;
    const prevReps = previousPerformance.reps;
    const prevRpe = previousPerformance.rpe ?? 7.5; // Default safe assumption if unrecorded

    // RPE <= 8 means >= 2 reps in reserve -> Prime candidate for +2.5kg / +5lbs overload
    const isOverloadReady = prevRpe <= 8 || prevReps >= parsedTargetReps;

    if (isOverloadReady) {
      const nextWeightKg = Math.round((prevWeight + weightStepKg) * 2) / 2;
      const displayNextWeight = toDisplayWeight(nextWeightKg);

      return {
        type: 'overload',
        recommendedWeightKg: nextWeightKg,
        recommendedReps: parsedTargetReps,
        deltaWeightKg: nextWeightKg - prevWeight,
        deltaReps: 0,
        chipLabel: `Target: ${displayNextWeight} ${unitLabel} (+${weightStepDisplay} ${unitLabel})`,
        buttonLabel: 'Apply',
        reason: `+${weightStepDisplay} ${unitLabel} progression.`,
        badgeVariant: 'lime',
        isApplicable: true,
      };
    }

    // If RPE was 9-10 (high effort limit): Consolidate volume before jumping weight
    const displayPrevWeight = toDisplayWeight(prevWeight);
    return {
      type: 'maintain',
      recommendedWeightKg: prevWeight,
      recommendedReps: parsedTargetReps,
      deltaWeightKg: 0,
      deltaReps: 0,
      chipLabel: `Target: ${displayPrevWeight} ${unitLabel}`,
      buttonLabel: 'Apply',
      reason: 'Maintain weight.',
      badgeVariant: 'cyan',
      isApplicable: Math.abs(currentWeightKg - prevWeight) > 0.1,
    };
  }

  // 3. Bodyweight / Rep Overload Rule (Weight = 0)
  if (previousPerformance && previousPerformance.weight === 0 && previousPerformance.reps > 0) {
    const nextReps = previousPerformance.reps + 1;
    return {
      type: 'overload',
      recommendedWeightKg: 0,
      recommendedReps: nextReps,
      deltaWeightKg: 0,
      deltaReps: 1,
      chipLabel: `Target: ${nextReps} reps (+1)`,
      buttonLabel: 'Apply',
      reason: '+1 rep progression.',
      badgeVariant: 'lime',
      isApplicable: currentReps !== nextReps,
    };
  }

  // 4. Default / Baseline Target
  const displayCurrent = toDisplayWeight(currentWeightKg || 20);
  return {
    type: 'baseline',
    recommendedWeightKg: currentWeightKg || 20,
    recommendedReps: parsedTargetReps || 10,
    deltaWeightKg: 0,
    deltaReps: 0,
    chipLabel: `Target: ${displayCurrent} ${unitLabel}`,
    buttonLabel: 'Apply',
    reason: 'Session baseline.',
    badgeVariant: 'cyan',
    isApplicable: false,
  };
}
