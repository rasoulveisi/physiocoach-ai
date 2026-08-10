import { describe, expect, it } from 'vitest';

import { resolveExerciseImage, resolveOwnedCatalogExerciseImage } from './exercise-image-resolver';

describe('owned exercise image resolution', () => {
  it.each(['0001', '1459', '2808', '3785'])('maps catalog ID %s to its owned WebP', (sourceId) => {
    expect(resolveOwnedCatalogExerciseImage(`ex_catalog_exercises_dataset_${sourceId}`)).toBe(
      `/images/exercises/catalog/${sourceId}.webp`,
    );
  });

  it('does not resolve by name or fallback metadata', () => {
    expect(resolveExerciseImage('Goblet squat')).toBeNull();
    expect(resolveExerciseImage('Goblet squat', 'squat', 'legs')).toBeNull();
  });

  it('rejects malformed and non-catalog IDs', () => {
    expect(resolveOwnedCatalogExerciseImage('ex_catalog_dataset_1')).toBeNull();
    expect(resolveOwnedCatalogExerciseImage('ex_legacy_1640')).toBeNull();
    expect(resolveOwnedCatalogExerciseImage(null)).toBeNull();
  });
});
