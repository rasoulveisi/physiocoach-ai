import { describe, expect, it } from 'vitest';
import type { WorkerBindings } from '../src/env';
import { createApp } from '../src/app';

function localNoDbEnv(): WorkerBindings {
  return {
    APP_ENV: 'local',
    CORS_ORIGIN: 'https://physiocoach.otconnect.ir',
    AUTH_JWT_SECRET: 'test-auth-secret-with-at-least-32-bytes',
    AUTH_ISSUER: 'physiocoach-ai-api-test',
    AUTH_AUDIENCE: 'physiocoach-ai-web-test',
    AUTH_ACCESS_TTL_SEC: 900,
    AUTH_REFRESH_IDLE_DAYS: 30,
    AUTH_REFRESH_ABSOLUTE_DAYS: 60,
    OPENROUTER_API_KEY: 'test-openrouter-key',
    WORKOUT_MODEL_PRIMARY: 'openrouter/owl-alpha',
    WORKOUT_MODEL_FALLBACKS: '',
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    OPENROUTER_TIMEOUT_MS: 180000,
    OPENROUTER_MAX_RETRIES: 0,
    OPENROUTER_REFERER: 'https://physiocoach.otconnect.ir',
    OPENROUTER_TITLE: 'PhysioCoach AI',
    DB: undefined as unknown as D1Database,
  };
}

describe('no-DB route behavior', () => {
  it('returns null workout plan payload for GET /api/v1/workout-plans/:planId', async () => {
    const app = createApp();

    const response = await app.request('/api/v1/workout-plans/plan-1', undefined, localNoDbEnv());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: null });
  });

  it('returns persistence unavailable error for PATCH /api/v1/profile', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/profile',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          age: 35,
          sex: 'male',
          heightCm: 180,
          weightKg: 80,
          lifestyle: 'desk_job',
          experienceLevel: 'beginner',
        }),
      },
      localNoDbEnv(),
    );

    expect(response.status).toBe(400);

    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(body.error.code).toBe('invalid_request');
    expect(body.error.message).toBe('Profile persistence is unavailable in this environment.');
  });
});
