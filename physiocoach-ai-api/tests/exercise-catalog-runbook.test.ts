import { describe, expect, it } from 'vitest';
import { validateExerciseCatalogRunbook } from '../scripts/check-exercise-catalog-runbook.mjs';

describe('exercise catalog runbook', () => {
  it('uses the emitted catalog ID, declares analysis prerequisites, and safely encodes duplicate names', async () => {
    await expect(validateExerciseCatalogRunbook()).resolves.toEqual([]);
  });
});
