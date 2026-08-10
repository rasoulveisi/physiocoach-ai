import { describe, expect, it } from 'vitest';
import { generatePlanInputSchema } from '../../src/services/workout-generator';
import { frontendGeneratePayloads } from './frontend-generate-payloads';

describe('frontend Generate API payload fixtures', () => {
  it.each(frontendGeneratePayloads)('matches backend schema: $name', ({ payload }) => {
    expect(generatePlanInputSchema.safeParse(payload).success).toBe(true);
  });
});
