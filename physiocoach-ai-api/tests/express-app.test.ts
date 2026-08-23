import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import type { WorkerBindings } from '../src/env';

const localEnv = { APP_ENV: 'local', CORS_ORIGIN: '*' } as WorkerBindings;

describe('Express API router compatibility', () => {
  it.each(['/api/v1/profile', '/api/v1/profiles'])(
    'supports profile path %s',
    async (path) => {
      const response = await createApp().fetch(path, undefined, localEnv);
      expect(response.status).toBe(200);
    },
  );

  it.each(['/api/v1/workout-plans/current', '/api/v1/workout-plans/active'])(
    'supports active workout plan path %s',
    async (path) => {
      const response = await createApp().fetch(path, undefined, localEnv);
      expect(response.status).toBe(200);
    },
  );

  it.each(['/api/v1/auth/oauth/exchange', '/api/v1/auth/google/exchange'])(
    'supports OAuth exchange path %s',
    async (path) => {
      const response = await createApp().fetch(
        path,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        },
        localEnv,
      );
      expect(response.status).toBe(400);
    },
  );

  it.each(['/api/v1/exercise-catalog/exercises', '/api/v1/exercises'])(
    'supports exercise catalog path %s',
    async (path) => {
      const response = await createApp().fetch(path, undefined, localEnv);
      expect(response.status).toBe(200);
    },
  );

  it('supports exercise swap candidates path', async () => {
    const response = await createApp().fetch(
      '/api/v1/exercise-catalog/swap-candidates',
      undefined,
      localEnv,
    );
    expect(response.status).toBe(200);
  });
});

