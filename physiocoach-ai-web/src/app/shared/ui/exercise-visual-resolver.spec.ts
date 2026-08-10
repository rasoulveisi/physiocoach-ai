import { describe, expect, it } from 'vitest';

import { resolveExerciseVisual } from './exercise-visual-resolver';

describe('resolveExerciseVisual', () => {
  it('uses the owned dataset image even when external media is supplied', () => {
    expect(
      resolveExerciseVisual({
        name: 'Goblet squat',
        masterExerciseId: 'ex_catalog_exercises_dataset_0001',
        media: { imageUrl: 'https://media.example/0001.webp' },
      }),
    ).toMatchObject({ kind: 'media', url: '/images/exercises/catalog/0001.webp' });
  });

  it('uses the owned WebP for a valid dataset ID', () => {
    expect(
      resolveExerciseVisual({
        name: 'Goblet squat',
        masterExerciseId: 'ex_catalog_exercises_dataset_0001',
      }),
    ).toMatchObject({ kind: 'media', url: '/images/exercises/catalog/0001.webp' });
  });

  it('returns unavailable instead of an animation or fallback', () => {
    expect(resolveExerciseVisual({ name: 'Unknown exercise', movementPattern: 'squat' })).toEqual({
      kind: 'unavailable',
    });
  });
});
