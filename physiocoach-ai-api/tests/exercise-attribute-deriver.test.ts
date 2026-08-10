import { describe, expect, it } from 'vitest';
import { deriveExerciseAttributes } from '../src/services/exercise-attribute-deriver';

describe('exercise attribute deriver', () => {
  it('keeps known core work distinct from unknown metadata', () => {
    expect(deriveExerciseAttributes({ name: 'Plank' }).movementPattern).toBe('core');
    expect(
      deriveExerciseAttributes({ name: 'ZXQ synthetic motion', target: 'unknown' }).movementPattern,
    ).toBe('unclassified');
  });
  it('derives impact and knee-loading attributes for a jump squat', () => {
    expect(
      deriveExerciseAttributes({
        name: 'Jump Squat',
        instructions: 'Jump explosively from the bottom of a squat and land softly.',
        target: 'quads',
        primaryMuscle: 'quads',
        secondaryMuscles: ['glutes'],
        equipment: 'body weight',
        bodyPart: 'upper legs',
      }),
    ).toMatchObject({
      movementPattern: 'squat',
      impactLevel: 'high',
      explosive: true,
      loadedRegions: expect.arrayContaining(['knee', 'hip']),
    });
  });

  it('identifies unstable overhead work from the exercise instructions', () => {
    expect(
      deriveExerciseAttributes({
        name: 'Single Leg Dumbbell Overhead Press',
        instructions: 'Balance on one leg and press the dumbbell overhead.',
        target: 'delts',
        equipment: 'dumbbells',
        bodyPart: 'shoulders',
      }),
    ).toMatchObject({
      movementPattern: 'push',
      overhead: true,
      unilateral: true,
      balanceDemand: 'high',
    });
  });

  it('derives a barbell push jerk as an advanced explosive overhead push', () => {
    expect(
      deriveExerciseAttributes({
        name: 'Barbell Push Jerk',
        instructions: 'Dip, drive the barbell overhead, and catch it with bent knees.',
        target: 'delts',
        equipment: 'barbell',
        bodyPart: 'shoulders',
      }),
    ).toMatchObject({
      movementPattern: 'push',
      overhead: true,
      explosive: true,
      technicalComplexity: 'advanced',
    });
  });

  it('derives a barbell hang clean as an advanced explosive hinge', () => {
    expect(
      deriveExerciseAttributes({
        name: 'Barbell Hang Clean',
        instructions: 'Explosively pull the barbell from the hang and catch it at the shoulders.',
        target: 'quads',
        equipment: 'barbell',
        bodyPart: 'upper legs',
      }),
    ).toMatchObject({
      movementPattern: 'hinge',
      overhead: false,
      explosive: true,
      technicalComplexity: 'advanced',
    });
  });

  it.each([
    ['Barbell Back Squat', 'Squat with a barbell across the upper back.', 'squat'],
    ['Barbell Deadlift', 'Lift a barbell from the floor to standing.', 'hinge'],
    ['Barbell Good Morning', 'Hinge forward with a barbell across the upper back.', 'hinge'],
  ])('marks %s as high spinal load', (name, instructions, movementPattern) => {
    expect(
      deriveExerciseAttributes({
        name,
        instructions,
        target: 'erector spinae',
        equipment: 'barbell',
        bodyPart: 'back',
      }),
    ).toMatchObject({ movementPattern, spinalLoad: 'high' });
  });
});
