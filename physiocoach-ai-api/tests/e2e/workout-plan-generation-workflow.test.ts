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

    const response = await app.request('/api/v1/workout-plans/current', {
      method: 'GET',
    }, mockEnv);

    expect(response.status).toBe(200);
    const json = (await response.json()) as { data?: unknown };
    expect(json.data).toBeNull();
  });
});
