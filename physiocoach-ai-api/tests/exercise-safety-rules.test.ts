import { describe, expect, it } from 'vitest';
import {
  applyDeterministicSafetyRules,
  mergeSuitability,
} from '../src/services/exercise-safety-rules';
import { deriveExerciseAttributes } from '../src/services/exercise-attribute-deriver';

const jumpSquat = {
  name: 'Jump Squat',
  instructions: 'Jump explosively from the bottom of a squat and land softly.',
  target: 'quads',
  primaryMuscle: 'quads',
  secondaryMuscles: ['glutes'],
  equipment: 'body weight',
  bodyPart: 'upper legs',
};

describe('deterministic exercise safety rules', () => {
  it('never lets AI weaken a deterministic avoid decision', () => {
    expect(mergeSuitability('avoid', 'recommended')).toBe('avoid');
  });

  it('treats missing safety as avoid rather than safe', () => {
    expect(mergeSuitability(undefined, 'recommended')).toBe('avoid');
    expect(mergeSuitability('caution', undefined)).toBe('avoid');
  });

  it('marks moderate knee pain avoid for high-impact loaded squats', () => {
    const result = applyDeterministicSafetyRules(jumpSquat, deriveExerciseAttributes(jumpSquat));

    expect(result.ratings).toContainEqual(
      expect.objectContaining({
        considerationCode: 'knee_pain',
        severity: 'moderate',
        rating: 'avoid',
        ruleCodes: expect.arrayContaining(['high_impact_landing']),
      }),
    );
  });

  it('keeps severity monotonic for every deterministic rating', () => {
    const result = applyDeterministicSafetyRules(jumpSquat, deriveExerciseAttributes(jumpSquat));
    const kneeRatings = result.ratings
      .filter((rating) => rating.considerationCode === 'knee_pain')
      .map((rating) => rating.rating);

    expect(kneeRatings).toEqual(['caution', 'avoid', 'avoid']);
  });

  it('restricts advanced ballistic push jerks for shoulder and lower-back pain', () => {
    const pushJerk = {
      name: 'Barbell Push Jerk',
      instructions: 'Dip, drive the barbell overhead, and catch it with bent knees.',
      target: 'delts',
      equipment: 'barbell',
      bodyPart: 'shoulders',
    };
    const result = applyDeterministicSafetyRules(pushJerk, deriveExerciseAttributes(pushJerk));

    expect(result.ratings).toContainEqual(
      expect.objectContaining({
        considerationCode: 'shoulder_pain',
        severity: 'moderate',
        rating: 'avoid',
        ruleCodes: expect.arrayContaining(['advanced_ballistic_lift']),
      }),
    );
  });

  it.each([
    [
      'behind-neck work',
      {
        name: 'Barbell Behind Neck Press',
        instructions: 'Press the barbell from behind the neck overhead.',
        equipment: 'barbell',
      },
      'shoulder_pain',
      'behind_neck_position',
    ],
    ['high-impact landing', jumpSquat, 'knee_pain', 'high_impact_landing'],
    [
      'advanced ballistic lifting',
      {
        name: 'Barbell Hang Clean',
        instructions: 'Explosively pull the barbell from the hang and catch it at the shoulders.',
        equipment: 'barbell',
      },
      'lower_back_pain',
      'advanced_ballistic_lift',
    ],
    [
      'deep loaded knee flexion',
      {
        name: 'Barbell Deep Squat',
        instructions: 'Perform a deep squat with a barbell.',
        equipment: 'barbell',
      },
      'knee_pain',
      'deep_loaded_knee_flexion',
    ],
    [
      'high spinal loading',
      {
        name: 'Barbell Back Squat',
        instructions: 'Squat with a barbell across the upper back.',
        equipment: 'barbell',
      },
      'lower_back_pain',
      'high_spinal_load',
    ],
    [
      'unstable overhead work',
      {
        name: 'Single Leg Dumbbell Overhead Press',
        instructions: 'Balance on one leg and press the dumbbell overhead.',
        equipment: 'dumbbells',
      },
      'shoulder_pain',
      'unstable_overhead_work',
    ],
  ])('emits an avoid restriction for %s', (_description, exercise, considerationCode, ruleCode) => {
    const result = applyDeterministicSafetyRules(exercise, deriveExerciseAttributes(exercise));

    expect(result.ratings).toContainEqual(
      expect.objectContaining({
        considerationCode,
        severity: 'moderate',
        rating: 'avoid',
        ruleCodes: expect.arrayContaining([ruleCode]),
      }),
    );
  });

  it('emits a caution before avoid for deep loaded knee flexion', () => {
    const exercise = {
      name: 'Barbell Deep Squat',
      instructions: 'Perform a deep squat with a barbell.',
      equipment: 'barbell',
    };
    const result = applyDeterministicSafetyRules(exercise, deriveExerciseAttributes(exercise));

    expect(result.ratings).toContainEqual(
      expect.objectContaining({
        considerationCode: 'knee_pain',
        severity: 'mild',
        rating: 'caution',
      }),
    );
  });

  it('never emits a less restrictive rating at a higher severity', () => {
    const exercises = [
      jumpSquat,
      {
        name: 'Barbell Behind Neck Press',
        instructions: 'Press the barbell from behind the neck overhead.',
        equipment: 'barbell',
      },
      {
        name: 'Single Leg Dumbbell Overhead Press',
        instructions: 'Balance on one leg and press the dumbbell overhead.',
        equipment: 'dumbbells',
      },
    ];
    const rank = { recommended: 0, caution: 1, avoid: 2 };

    for (const exercise of exercises) {
      const ratings = applyDeterministicSafetyRules(
        exercise,
        deriveExerciseAttributes(exercise),
      ).ratings;
      for (const considerationCode of new Set(ratings.map((rating) => rating.considerationCode))) {
        const current = ratings.filter((rating) => rating.considerationCode === considerationCode);
        expect(rank[current[0]!.rating]).toBeLessThanOrEqual(rank[current[1]!.rating]);
        expect(rank[current[1]!.rating]).toBeLessThanOrEqual(rank[current[2]!.rating]);
      }
    }
  });
});
