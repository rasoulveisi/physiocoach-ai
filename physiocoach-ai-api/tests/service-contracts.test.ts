import { describe, expect, it } from 'vitest';
import { assessmentInputSchema } from '../src/types/assessment';
import { bodyMeasurementInputSchema } from '../src/types/progress';
import { profileInputSchema } from '../src/types/profile';
import { buildWorkoutPlanModelConfig } from '../src/services/workout-generator';

describe('service input contracts', () => {
  it('parses a valid profile payload', () => {
    const payload = {
      age: 34,
      sex: 'male',
      heightCm: 178,
      weightKg: 82.5,
      bodyFatEstimate: 18,
      lifestyle: 'active',
      experienceLevel: 'intermediate',
    };

    expect(profileInputSchema.parse(payload)).toEqual(payload);
  });

  it('parses a valid assessment payload', () => {
    const payload = {
      goals: ['muscle_gain', 'posture_improvement'],
      frequencyDays: 4,
      equipment: ['dumbbells_only', 'resistance_bands'],
      limitations: ['shoulder_pain'],
      postureFlags: ['rounded_shoulders'],
    };

    expect(assessmentInputSchema.parse(payload)).toEqual({ ...payload, considerations: [] });
  });

  it('rejects profile values outside the plan enums and ranges', () => {
    expect(() =>
      profileInputSchema.parse({
        age: 12,
        sex: 'unknown',
        heightCm: 99,
        weightKg: 29,
        bodyFatEstimate: 71,
        lifestyle: 'moderately_active',
        experienceLevel: 'novice',
      }),
    ).toThrow();
  });

  it('rejects assessment values outside the plan enums and ranges', () => {
    expect(() =>
      assessmentInputSchema.parse({
        goals: ['build_muscle'],
        frequencyDays: 6,
        equipment: ['dumbbells'],
        limitations: ['left shoulder irritation'],
        postureFlags: ['rounded shoulders'],
      }),
    ).toThrow();
  });

  it('parses a valid body measurement payload', () => {
    const payload = {
      measuredAt: '2026-05-30T08:00:00.000Z',
      bodyWeightKg: 81.2,
      bodyFatEstimate: 17.5,
      waistCm: 86,
      chestCm: 102,
      notes: 'Morning measurement',
    };

    expect(bodyMeasurementInputSchema.parse(payload)).toEqual(payload);
  });

  it('rejects body measurements without an ISO datetime', () => {
    expect(() =>
      bodyMeasurementInputSchema.parse({
        measuredAt: '2026-05-30',
        bodyWeightKg: 81.2,
      }),
    ).toThrow();
  });

  it('uses a 3 minute default workout generation timeout', () => {
    const workoutModelConfig = buildWorkoutPlanModelConfig({});

    expect(workoutModelConfig.timeoutMs).toBe(180000);
    expect(workoutModelConfig.maxRetries).toBe(0);
  });

  it('falls back to the default timeout when raw config timeout is 0', () => {
    const workoutModelConfig = buildWorkoutPlanModelConfig({
      OPENROUTER_TIMEOUT_MS: 0,
    });

    expect(workoutModelConfig.timeoutMs).toBe(180000);
  });

  it('caps workout model config maxRetries at runtime', () => {
    const workoutModelConfig = buildWorkoutPlanModelConfig({
      OPENROUTER_MAX_RETRIES: 5,
    });

    expect(workoutModelConfig.maxRetries).toBe(0);
  });
});
