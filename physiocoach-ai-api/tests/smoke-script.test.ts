import { describe, expect, it } from 'vitest';

import {
  validateCatalogCoverage,
  validateCatalogHealth,
  validateRequiredConsiderations,
  validateSevereKneePlan,
} from '../scripts/smoke.mjs';

describe('catalog smoke validators', () => {
  it('accepts a complete active catalog health payload', () => {
    expect(
      validateCatalogHealth({
        activeCatalogId: 'catalog_20260728',
        sourceRecordCount: 1324,
        publishedExerciseCount: 1200,
        coverageComplete: true,
        unresolvedConflicts: 0,
      }),
    ).toBe(true);
  });

  it('rejects catalog health with incomplete coverage or unresolved conflicts', () => {
    expect(
      validateCatalogHealth({
        activeCatalogId: 'catalog_20260728',
        sourceRecordCount: 1324,
        publishedExerciseCount: 1200,
        coverageComplete: false,
        unresolvedConflicts: 1,
      }),
    ).toBe(false);
  });

  it('accepts a ready admin coverage evaluation with complete reviewed exercises', () => {
    expect(
      validateCatalogCoverage(
        {
          catalogVersionId: 'catalog_20260728',
          status: 'active',
          ready: true,
          blockers: [],
          coverage: {
            totalExercises: 1200,
            approvedExercises: 1200,
            completeExercises: 1200,
            activeConsiderations: 3,
          },
        },
        'catalog_20260728',
      ),
    ).toBe(true);
  });

  it('requires the three rollout considerations', () => {
    expect(
      validateRequiredConsiderations([
        { code: 'knee_pain' },
        { code: 'lower_back_pain' },
        { code: 'high_impact_intolerance' },
      ]),
    ).toBe(true);
  });

  it('rejects an exercise ID from the severe-knee admin avoid list', () => {
    expect(
      validateSevereKneePlan(
        {
          data: {
            id: 'plan_1',
            plan: { days: [{ exercises: [{ masterExerciseId: 'jump_squat' }] }] },
          },
        },
        ['jump_squat'],
      ),
    ).toBe(false);
    expect(
      validateSevereKneePlan(
        {
          data: {
            id: 'plan_1',
            plan: { days: [{ exercises: [{ masterExerciseId: 'box_squat' }] }] },
          },
        },
        ['jump_squat'],
      ),
    ).toBe(true);
    expect(
      validateSevereKneePlan({ data: { id: 'plan_1', plan: { days: [{ exercises: [] }] } } }, [
        'jump_squat',
      ]),
    ).toBe(false);
    expect(
      validateSevereKneePlan(
        { data: { id: 'plan_1', plan: { days: [{ exercises: [{ name: 'unknown' }] }] } } },
        ['jump_squat'],
      ),
    ).toBe(false);
    expect(
      validateSevereKneePlan(
        {
          data: {
            id: 'plan_1',
            plan: { days: [{ exercises: [{ masterExerciseId: 'box_squat' }] }] },
          },
        },
        [],
      ),
    ).toBe(false);
  });
});
