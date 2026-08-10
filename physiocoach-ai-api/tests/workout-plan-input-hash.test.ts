import { describe, expect, it } from 'vitest';
import { buildPlanInputHash } from '../src/services/workout-generator';
import type { GeneratePlanInput } from '../src/services/workout-generator';

describe('workout plan input hash', () => {
  it('normalizes prompt version and key order consistently', async () => {
    const first: GeneratePlanInput = {
      profile: {
        age: 29,
        sex: 'male',
        heightCm: 178,
        weightKg: 80,
        bodyFatEstimate: 18,
        lifestyle: 'desk_job',
        experienceLevel: 'intermediate',
      },
      assessment: {
        goals: ['posture_improvement', 'strength'],
        frequencyDays: 4,
        equipment: ['dumbbells_only', 'full_gym'],
        limitations: ['shoulder_pain'],
        postureFlags: ['rounded_shoulders'],
      },
    };

    const second: GeneratePlanInput = {
      assessment: {
        postureFlags: ['rounded_shoulders'],
        limitations: ['shoulder_pain'],
        frequencyDays: 4,
        equipment: ['full_gym', 'dumbbells_only'],
        goals: ['strength', 'posture_improvement'],
      },
      profile: {
        experienceLevel: 'intermediate',
        lifestyle: 'desk_job',
        bodyFatEstimate: 18,
        weightKg: 80,
        heightCm: 178,
        sex: 'male',
        age: 29,
      },
    };

    const hashA = await buildPlanInputHash(first);
    const hashB = await buildPlanInputHash(second);

    expect(hashA).toBe(hashB);
  });

  it('sorts severity-aware considerations before hashing', async () => {
    const profile = {
      age: 29,
      sex: 'male' as const,
      heightCm: 178,
      weightKg: 80,
      lifestyle: 'desk_job' as const,
      experienceLevel: 'intermediate' as const,
    };
    const assessment = {
      goals: ['strength' as const],
      frequencyDays: 3,
      equipment: ['full_gym' as const],
      considerations: [
        { code: 'shoulder_pain', severity: 'moderate' as const, side: 'left' as const },
        { code: 'knee_pain', severity: 'severe' as const, side: 'bilateral' as const },
      ],
    };

    const [first, second] = await Promise.all([
      buildPlanInputHash({ profile, assessment }),
      buildPlanInputHash({
        profile,
        assessment: { ...assessment, considerations: [...assessment.considerations].reverse() },
      }),
    ]);

    expect(first).toBe(second);
  });
});
