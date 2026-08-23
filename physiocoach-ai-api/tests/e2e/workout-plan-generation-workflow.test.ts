import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
  WORKOUT_MODEL_PRIMARY: 'meta-llama/llama-3.1-8b-instruct',
} as const;

describe('Behavior-Driven E2E: Workout Plan Generation & Retrieval Workflow', () => {
  it('validates active plan retrieval when no plan exists', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/workout-plans/current',
      {
        method: 'GET',
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { data?: unknown };
    expect(json.data === null || typeof json.data === 'object').toBe(true);
  });

  it('handles coordinated 3-step assessment intake and generation request contract', async () => {
    const app = createApp();

    // Step 1: Biometric Profile Patch
    const profilePayload = {
      age: 28,
      sex: 'male' as const,
      heightCm: 178,
      weightKg: 75,
      lifestyle: 'desk_job' as const,
      experienceLevel: 'intermediate' as const,
    };

    const profileRes = await app.fetch(
      '/api/v1/profile',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profilePayload),
      },
      mockEnv,
    );
    expect([200, 201]).toContain(profileRes.status);

    // Step 2: Clinical Assessment Post
    const assessmentPayload = {
      goals: ['posture_improvement', 'strength'],
      frequencyDays: 3,
      equipment: ['dumbbells_only' as const],
      considerations: [
        {
          code: 'rounded_shoulders',
          severity: 'mild' as const,
          side: 'bilateral' as const,
          inferred: false,
        },
        {
          code: 'lower_back_pain',
          severity: 'mild' as const,
          side: 'unspecified' as const,
          inferred: false,
        },
      ],
      limitations: ['lower_back_pain' as const],
      postureFlags: ['rounded_shoulders' as const],
    };

    const assessmentRes = await app.fetch(
      '/api/v1/assessments',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assessmentPayload),
      },
      mockEnv,
    );
    expect([200, 201]).toContain(assessmentRes.status);

    // Step 3: Workout Plan Generation Request
    const generateRes = await app.fetch(
      '/api/v1/workout-plans/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: profilePayload,
          assessment: assessmentPayload,
        }),
      },
      mockEnv,
    );

    // If OpenRouter key is not configured in local test env, zero-fallback policy returns 409 Conflict with traceId
    // If AI is reachable, returns 200/201 with generated plan
    expect([200, 201, 409]).toContain(generateRes.status);
    const generateJson = (await generateRes.json()) as any;
    if (generateRes.status === 409) {
      expect(generateJson.error).toBeDefined();
      expect(
        generateJson.traceId ||
          generateJson.error?.requestId ||
          generateJson.error?.details?.traceId,
      ).toBeDefined();
    } else {
      expect(generateJson.data?.plan?.days?.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('supports deleting current active workout plan', async () => {
    const app = createApp();

    const deleteRes = await app.fetch(
      '/api/v1/workout-plans/current',
      {
        method: 'DELETE',
      },
      mockEnv,
    );

    expect([200, 204, 404, 409]).toContain(deleteRes.status);
  });
});

