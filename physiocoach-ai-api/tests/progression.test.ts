import { describe, expect, it } from 'vitest';
import { suggestNextLoad } from '../src/services/progression';

describe('suggestNextLoad', () => {
  it('increases load when top reps are achieved at target RPE', () => {
    expect(
      suggestNextLoad({
        currentWeight: 70,
        achievedReps: 10,
        targetRepRange: { min: 8, max: 10 },
        achievedRpe: 8,
        targetRpe: 8,
      }),
    ).toEqual({
      nextWeight: 72.5,
      reason: 'Top reps achieved at target RPE.',
    });
  });

  it('increases lb load by 5 when top reps are achieved at target RPE', () => {
    expect(
      suggestNextLoad({
        currentWeight: 100,
        achievedReps: 10,
        targetRepRange: { min: 8, max: 10 },
        achievedRpe: 8,
        targetRpe: 8,
        unit: 'lb',
      }),
    ).toEqual({
      nextWeight: 105,
      reason: 'Top reps achieved at target RPE.',
    });
  });

  it('keeps load stable when RPE is above target', () => {
    expect(
      suggestNextLoad({
        currentWeight: 70,
        achievedReps: 10,
        targetRepRange: { min: 8, max: 10 },
        achievedRpe: 9.5,
        targetRpe: 8,
      }),
    ).toEqual({
      nextWeight: 70,
      reason: 'RPE was above target; keep load stable.',
    });
  });
});
