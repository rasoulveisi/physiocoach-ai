import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
} as const;

describe('Behavior-Driven E2E: Exercise Catalog Explore API', () => {
  it('GET /api/v1/exercise-catalog/filters returns available filter dimensions', async () => {
    const app = createApp();

    const response = await app.fetch('/api/v1/exercise-catalog/filters', {
      method: 'GET',
    }, mockEnv);

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data?: {
        bodyParts: Array<{ id: string; name: string; count: number }>;
        muscles: Array<{ id: string; name: string; bodyRegion: string }>;
        movementPatterns: Array<{ id: string; name: string }>;
        equipment: Array<{ id: string; name: string }>;
        safetyTags: Array<{ id: string; name: string }>;
      };
    };

    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data?.bodyParts)).toBe(true);
    expect(Array.isArray(json.data?.muscles)).toBe(true);
    expect(Array.isArray(json.data?.movementPatterns)).toBe(true);
    expect(Array.isArray(json.data?.equipment)).toBe(true);
    expect(Array.isArray(json.data?.safetyTags)).toBe(true);
  });

  it('GET /api/v1/exercise-catalog/exercises returns paginated list structure', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/exercise-catalog/exercises?limit=10&offset=0',
      {
        method: 'GET',
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data?: Array<{ id: string; name: string; movementPattern: string }>;
      pagination?: { total: number; limit: number; offset: number; hasMore: boolean };
    };

    expect(json.data).toBeDefined();
    expect(json.pagination).toBeDefined();
    expect(json.pagination?.limit).toBe(10);
    expect(json.pagination?.offset).toBe(0);
  });

  it('GET /api/v1/exercise-catalog/exercises supports multi-filtering parameters', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/exercise-catalog/exercises?q=squat&bodyPart=upper+legs&movementPattern=squat&safetyTags=low_spine_load',
      {
        method: 'GET',
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { data?: unknown[] };
    expect(json.data).toBeDefined();
  });
});
