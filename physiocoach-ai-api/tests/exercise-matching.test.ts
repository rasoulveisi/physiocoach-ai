import { describe, expect, it } from 'vitest';
import { matchExerciseToCatalog } from '../src/services/exercise-matching';
import type { CatalogCandidate } from '../src/services/workout-generator';

describe('exercise-matching', () => {
  const candidates: CatalogCandidate[] = [
    {
      masterExerciseId: 'ex_1',
      name: 'Barbell Back Squat',
      movementPattern: 'squat',
      allowedEquipment: ['barbell'],
    },
    {
      masterExerciseId: 'ex_2',
      name: 'Dumbbell Romanian Deadlift',
      movementPattern: 'hinge',
      allowedEquipment: ['dumbbells'],
    },
    {
      masterExerciseId: 'ex_3',
      name: 'Push-Up',
      movementPattern: 'push',
      allowedEquipment: ['bodyweight'],
    },
  ];

  it('performs exact matching case-insensitively', () => {
    const matched = matchExerciseToCatalog('barbell back squat', candidates);
    expect(matched?.masterExerciseId).toBe('ex_1');
  });

  it('performs matching with shorthand expansion', () => {
    const matched = matchExerciseToCatalog('DB Romanian Deadlift', candidates);
    expect(matched?.masterExerciseId).toBe('ex_2');
  });

  it('performs substring matching', () => {
    const matched = matchExerciseToCatalog('Romanian Deadlift', candidates);
    expect(matched?.masterExerciseId).toBe('ex_2');
  });

  it('correctly matches specific variations instead of generic ones (no hijacking)', () => {
    const customCandidates: CatalogCandidate[] = [
      {
        masterExerciseId: 'ex_plank',
        name: 'Plank',
        movementPattern: 'core',
        allowedEquipment: ['bodyweight'],
      },
      {
        masterExerciseId: 'ex_side_plank',
        name: 'Side Plank',
        movementPattern: 'core',
        allowedEquipment: ['bodyweight'],
      },
      {
        masterExerciseId: 'ex_plank_taps',
        name: 'Plank Shoulder Taps',
        movementPattern: 'core',
        allowedEquipment: ['bodyweight'],
      },
    ];

    // Plank should match generic Plank
    expect(matchExerciseToCatalog('Plank', customCandidates)?.masterExerciseId).toBe('ex_plank');

    // Plank with Shoulder Taps should match Plank Shoulder Taps, not Plank
    expect(
      matchExerciseToCatalog('Plank with Shoulder Taps', customCandidates)?.masterExerciseId,
    ).toBe('ex_plank_taps');

    // Side Plank with Hip Abduction should match Side Plank, not Plank
    expect(
      matchExerciseToCatalog('Side Plank with Hip Abduction', customCandidates)?.masterExerciseId,
    ).toBe('ex_side_plank');
  });

  it('performs token overlap matching', () => {
    const matched = matchExerciseToCatalog('Barbell Squat Back', candidates);
    expect(matched?.masterExerciseId).toBe('ex_1');
  });

  it('returns null when no match is found', () => {
    const matched = matchExerciseToCatalog('Custom Dance Move', candidates);
    expect(matched).toBeNull();
  });
});
