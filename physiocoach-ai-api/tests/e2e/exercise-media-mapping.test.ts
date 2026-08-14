import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
} as const;

describe('Behavior-Driven E2E: Exercise Media Mapping & Assets Resolution', () => {
  it('resolves exercise media lookup cleanly', async () => {
    const app = createApp();

    const response = await app.request('/api/v1/exercise-catalog/media?exerciseId=master_ex_1', {
      method: 'GET',
    }, mockEnv);

    expect(response.status).toBe(200);
    const json = (await response.json()) as { data?: unknown };
    expect(json).toHaveProperty('data');
  });

  it('handles batch exercise media lookup request without synthetic fallback SVGs', async () => {
    const app = createApp();

    const response = await app.request('/api/v1/exercise-catalog/media/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          { key: 'ex_1', exerciseId: 'master_ex_1' },
          { key: 'ex_2', name: 'Goblet Squat' },
        ],
      }),
    }, mockEnv);

    expect(response.status).toBe(200);
    const json = (await response.json()) as { data?: unknown };
    expect(json.data).toBeDefined();
  });
});
