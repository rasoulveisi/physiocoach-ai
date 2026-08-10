import { describe, expect, it } from 'vitest';
import { clusterExerciseCandidates } from '../src/services/exercise-candidate-clusterer';
import type { CatalogCandidate } from '../src/types/workout-generator';

const gluteBridge: CatalogCandidate = {
  masterExerciseId: 'glute_bridge',
  name: 'Glute bridge',
  movementPattern: 'hinge',
  allowedEquipment: ['bodyweight'],
  safetyRatings: [
    {
      considerationCode: 'knee_pain',
      severity: 'moderate',
      rating: 'recommended',
      reason: 'Keeps knee movement controlled.',
    },
    {
      considerationCode: 'lower_back_pain',
      severity: 'mild',
      rating: 'caution',
      reason: 'Keep the range comfortable.',
      requiredModification: 'Use a pain-free range of motion.',
    },
  ],
};

describe('clusterExerciseCandidates', () => {
  it('uses the strictest rating across exact user consideration severities', () => {
    const result = clusterExerciseCandidates(
      [gluteBridge],
      [
        { code: 'knee_pain', severity: 'moderate' },
        { code: 'lower_back_pain', severity: 'mild' },
      ],
    );

    expect(result.green).toEqual([]);
    expect(result.amber.map((item) => item.masterExerciseId)).toEqual(['glute_bridge']);
    expect(result.amber[0]?.cautionReasons).toEqual(['Keep the range comfortable.']);
    expect(result.amber[0]?.requiredModifications).toEqual(['Use a pain-free range of motion.']);
  });

  it('excludes avoid ratings and preserves their reasons for audit', () => {
    const result = clusterExerciseCandidates(
      [
        {
          ...gluteBridge,
          masterExerciseId: 'jump_squat',
          safetyRatings: [
            {
              considerationCode: 'knee_pain',
              severity: 'moderate',
              rating: 'avoid',
              reason: 'High impact can aggravate symptoms.',
            },
          ],
        },
      ],
      [{ code: 'knee_pain', severity: 'moderate' }],
    );

    expect(result.red.map((item) => item.masterExerciseId)).toEqual(['jump_squat']);
    expect(result.exclusions).toEqual([
      {
        masterExerciseId: 'jump_squat',
        reasons: ['High impact can aggravate symptoms.'],
      },
    ]);
  });
});
