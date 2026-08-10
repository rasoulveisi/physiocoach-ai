import type { WeightUnit, ProgressionInput, ProgressionSuggestion } from '../types/safety';
export type { WeightUnit, ProgressionInput, ProgressionSuggestion };

function getSmallIncrement(unit: WeightUnit): number {
  return unit === 'lb' ? 5 : 2.5;
}

export function suggestNextLoad(input: ProgressionInput): ProgressionSuggestion {
  const increment = getSmallIncrement(input.unit ?? 'kg');

  if (input.achievedRpe > input.targetRpe) {
    return {
      nextWeight: input.currentWeight,
      reason: 'RPE was above target; keep load stable.',
    };
  }

  if (input.achievedReps >= input.targetRepRange.max && input.achievedRpe <= input.targetRpe) {
    return {
      nextWeight: Number((input.currentWeight + increment).toFixed(2)),
      reason: 'Top reps achieved at target RPE.',
    };
  }

  return {
    nextWeight: input.currentWeight,
    reason: 'Build reps within the target range before increasing load.',
  };
}
