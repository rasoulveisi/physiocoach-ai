import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import type { WorkerBindings } from '../src/env';

const localEnv = { APP_ENV: 'local', CORS_ORIGIN: '*' } as WorkerBindings;

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
  };
}

interface SuccessResponseBody {
  data: {
    success: boolean;
    importedWorkoutsCount: number;
    importedSetsCount: number;
  };
}

describe('POST /api/v1/import/confirm-mapping', () => {
  it('returns 400 when body is invalid or empty', async () => {
    const app = createApp();
    const response = await app.fetch(
      '/api/v1/import/confirm-mapping',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      },
      localEnv,
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorResponseBody;
    expect(body.error.code).toBe('invalid_request');
  });

  it('handles valid workout import payload gracefully', async () => {
    const app = createApp();
    const payload = {
      mappings: {
        'Bench Press': 'ex_master_bench_1',
        'Incline Dumbbell Press': null,
      },
      workouts: [
        {
          title: 'Upper Push Day',
          date: '2026-08-20T10:00:00Z',
          exercises: [
            {
              name: 'Bench Press',
              sets: [
                { setIndex: 1, setType: 'warmup', weightKg: 60, reps: 10 },
                { setIndex: 2, setType: 'working', weightKg: 100, reps: 6 },
              ],
            },
            {
              name: 'Incline Dumbbell Press',
              sets: [
                { setIndex: 1, setType: 'working', weightKg: 32, reps: 8 },
              ],
            },
          ],
        },
      ],
      saveTemplatesAsPlans: true,
      importHistoricalLogs: true,
    };

    const response = await app.fetch(
      '/api/v1/import/confirm-mapping',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
      localEnv,
    );

    expect(response.status).toBe(200);
    const resBody = (await response.json()) as SuccessResponseBody;
    expect(resBody.data.success).toBe(true);
    expect(resBody.data.importedWorkoutsCount).toBeGreaterThanOrEqual(1);
  });
});
