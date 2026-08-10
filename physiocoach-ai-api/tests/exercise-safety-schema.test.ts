import { describe, expect, it } from 'vitest';
import {
  INITIAL_BODY_CONSIDERATIONS,
  assessmentConsiderationSchema,
  suitabilitySchema,
} from '../src/types/exercise-safety-catalog';

describe('exercise safety catalog schemas', () => {
  it('accepts a severity-aware body consideration', () => {
    expect(
      assessmentConsiderationSchema.parse({
        code: 'knee_pain',
        severity: 'moderate',
        side: 'bilateral',
      }),
    ).toEqual({ code: 'knee_pain', severity: 'moderate', side: 'bilateral', inferred: false });
    expect(suitabilitySchema.safeParse('unsafe').success).toBe(false);
    expect(
      INITIAL_BODY_CONSIDERATIONS.some((item) => item.code === 'high_impact_intolerance'),
    ).toBe(true);
  });
});
