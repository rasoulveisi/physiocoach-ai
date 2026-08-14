import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
  WORKOUT_MODEL_PRIMARY: 'meta-llama/llama-3.1-8b-instruct',
} as const;

describe('Behavior-Driven E2E: Workout Sessions & Exercise Logs Workflow', () => {
  it('retrieves empty active workout session when none exists', async () => {
    const app = createApp();

    const response = await app.request(
      '/api/v1/workout-sessions?status=active',
      {
        method: 'GET',
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { data?: unknown };
    expect(json.data).toBeNull();
  });

  it('retrieves empty recent workout sessions list when none exists', async () => {
    const app = createApp();

    const response = await app.request(
      '/api/v1/workout-sessions?status=recent',
      {
        method: 'GET',
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { data?: unknown };
    expect(json.data).toEqual([]);
  });

  it('validates invalid workout session creation request body', async () => {
    const app = createApp();

    const response = await app.request(
      '/api/v1/workout-sessions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workoutPlanId: 'invalid-id',
          // missing dayIndex and scheduledDate
        }),
      },
      mockEnv,
    );

    expect(response.status).toBe(400);
  });
});
