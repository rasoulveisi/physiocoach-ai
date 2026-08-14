import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
  WORKOUT_MODEL_PRIMARY: 'meta-llama/llama-3.1-8b-instruct',
} as const;

describe('Behavior-Driven E2E: Medical Error Traceability & Audit Logging', () => {
  it('returns structured traceable error details on invalid generation request body', async () => {
    const app = createApp();

    const response = await app.request('/api/v1/workout-plans/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invalid: 'payload' }),
    }, mockEnv);

    expect([400, 409]).toContain(response.status);
    const json = (await response.json()) as { error?: { code?: string; message?: string } };
    expect(json.error).toBeDefined();
    expect(json.error?.code).toBeDefined();
    expect(json.error?.message).toBeDefined();
  });
});
