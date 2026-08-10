import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import type { WorkerBindings } from './env';

describe('createApp', () => {
  it('allows localhost and 127.0.0.1 origins for local development', async () => {
    const app = createApp();
    const env = { CORS_ORIGIN: 'http://localhost:4200' } as WorkerBindings;

    const localhostResponse = await app.request(
      '/api/v1/health',
      { headers: { Origin: 'http://localhost:4200' } },
      env,
    );
    const loopbackResponse = await app.request(
      '/api/v1/health',
      { headers: { Origin: 'http://127.0.0.1:4200' } },
      env,
    );

    expect(localhostResponse.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:4200',
    );
    expect(loopbackResponse.headers.get('access-control-allow-origin')).toBe(
      'http://127.0.0.1:4200',
    );
  });

  it('fails workout plan generation when OpenRouter is not configured', async () => {
    const app = createApp();
    const env = { CORS_ORIGIN: 'http://localhost:4200' } as WorkerBindings;

    const response = await app.request(
      '/api/v1/workout-plans/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: {
            age: 30,
            sex: 'male',
            heightCm: 173,
            weightKg: 75,
            lifestyle: 'desk_job',
            experienceLevel: 'beginner',
          },
          assessment: {
            goals: ['muscle_gain', 'posture_improvement'],
            frequencyDays: 3,
            equipment: ['full_gym'],
            limitations: ['shoulder_pain'],
            postureFlags: ['rounded_shoulders', 'forward_head'],
          },
        }),
      },
      env,
    );

    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      error: {
        code: string;
        message: string;
      };
      data: {
        source: string;
        model: string;
        plan: { split: string; frequencyDays: number; warnings: string[] };
      };
    };

    expect(body.error.code).toBe('workout_plan_generation_failed');
  });

  it('accepts a severity-aware assessment without legacy flags', async () => {
    const app = createApp();
    const env = { APP_ENV: 'local' } as WorkerBindings;

    const response = await app.request(
      '/api/v1/assessments',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goals: ['strength'],
          frequencyDays: 3,
          equipment: ['full_gym'],
          considerations: [{ code: 'knee_pain', severity: 'severe', side: 'bilateral' }],
        }),
      },
      env,
    );

    const body = (await response.json()) as {
      data: { considerations: Array<{ severity: string }> };
    };
    expect(response.status).toBe(200);
    expect(body.data.considerations[0]?.severity).toBe('severe');
  });
});
