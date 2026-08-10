import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import {
  assessmentInputSchema,
  legacySafetyContextFromConsiderations,
  normalizeLegacyAssessmentConsiderations,
  resolveAssessmentConsiderations,
} from '../src/types/assessment';
import type { WorkerBindings } from '../src/env';
import { buildWorkoutPlanContext } from '../src/services/workout-generator';

describe('assessment considerations', () => {
  it('maps legacy pain and posture flags conservatively', () => {
    expect(
      normalizeLegacyAssessmentConsiderations({
        limitations: ['knee_pain'],
        postureFlags: ['rounded_shoulders'],
      }),
    ).toEqual([
      { code: 'knee_pain', severity: 'moderate', side: 'unspecified', inferred: true },
      { code: 'rounded_shoulders', severity: 'mild', side: 'unspecified', inferred: true },
    ]);
  });

  it('canonicalizes legacy posture aliases to active consideration codes', () => {
    expect(
      normalizeLegacyAssessmentConsiderations({
        postureFlags: ['forward_head', 'tight_hips', 'lower_back_discomfort'],
      }),
    ).toEqual([
      { code: 'forward_head_posture', severity: 'mild', side: 'unspecified', inferred: true },
      { code: 'limited_hip_mobility', severity: 'mild', side: 'unspecified', inferred: true },
      { code: 'lower_back_pain', severity: 'mild', side: 'unspecified', inferred: true },
    ]);
  });

  it('deduplicates overlapping inferred legacy consideration codes', () => {
    expect(
      normalizeLegacyAssessmentConsiderations({
        limitations: ['lower_back_pain'],
        postureFlags: ['lower_back_discomfort'],
      }),
    ).toEqual([
      { code: 'lower_back_pain', severity: 'moderate', side: 'unspecified', inferred: true },
    ]);
  });

  it('derives forward-head legacy safety context from its canonical code', () => {
    expect(
      legacySafetyContextFromConsiderations([
        { code: 'forward_head_posture', severity: 'mild', side: 'unspecified', inferred: true },
      ]),
    ).toEqual({ limitations: [], postureFlags: ['forward_head'] });
  });

  it('keeps canonical forward-head posture in the workout safety context', () => {
    expect(
      buildWorkoutPlanContext({
        profile: {
          age: 29,
          sex: 'male',
          heightCm: 178,
          weightKg: 80,
          lifestyle: 'desk_job',
          experienceLevel: 'intermediate',
        },
        assessment: {
          goals: ['strength'],
          frequencyDays: 3,
          equipment: ['full_gym'],
          considerations: [{ code: 'forward_head_posture', severity: 'mild' }],
        },
      }).postureFlags,
    ).toMatchObject({ neckPain: true });
  });

  it('preserves an explicitly empty considerations array over legacy flags', () => {
    const parsed = assessmentInputSchema.parse({
      goals: ['strength'],
      frequencyDays: 3,
      equipment: ['full_gym'],
      considerations: [],
      limitations: ['knee_pain'],
    });

    expect(resolveAssessmentConsiderations(parsed)).toEqual([]);
  });

  it('rejects duplicate explicit consideration codes', () => {
    expect(() =>
      assessmentInputSchema.parse({
        goals: ['strength'],
        frequencyDays: 3,
        equipment: ['full_gym'],
        considerations: [
          { code: 'knee_pain', severity: 'mild' },
          { code: 'knee_pain', severity: 'severe' },
        ],
      }),
    ).toThrow(/duplicate/i);
  });

  it('returns the built-in consideration catalog when no database is configured', async () => {
    const response = await createApp().request(
      '/api/v1/considerations',
      { headers: { 'x-user-id': 'user_1' } },
      { APP_ENV: 'local' } as WorkerBindings,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ code: string }> };
    expect(body.data.map(({ code }) => code)).toEqual([
      'rounded_shoulders',
      'neck_pain',
      'shoulder_pain',
      'lower_back_pain',
      'knee_pain',
    ]);
  });
});
