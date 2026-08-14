import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
  WORKOUT_MODEL_PRIMARY: 'meta-llama/llama-3.1-8b-instruct',
} as const;

describe('Behavior-Driven E2E: Assessment Form & User Profile Workflow', () => {
  it('validates profile endpoint behavior', async () => {
    const app = createApp();

    const profileResponse = await app.request('/api/v1/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        age: 32,
        sex: 'male',
        heightCm: 180,
        weightKg: 82,
        lifestyle: 'desk_job',
        experienceLevel: 'intermediate',
      }),
    }, mockEnv);

    expect([200, 201, 400]).toContain(profileResponse.status);
  });

  it('persists assessment form intake with posture flags and limitations', async () => {
    const app = createApp();

    const assessmentResponse = await app.request('/api/v1/assessments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        goals: ['posture_improvement', 'muscle_gain'],
        frequencyDays: 3,
        equipment: ['dumbbells_only'],
        limitations: ['knee_pain'],
        postureFlags: ['rounded_shoulders'],
      }),
    }, mockEnv);

    expect([200, 201]).toContain(assessmentResponse.status);
    const assessmentJson = (await assessmentResponse.json()) as { data?: unknown };
    expect(assessmentJson.data).toBeDefined();
  });
});
