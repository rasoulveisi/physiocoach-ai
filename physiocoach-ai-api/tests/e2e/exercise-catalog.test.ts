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

  it('GET /api/v1/exercise-catalog/alternatives/:slug returns 3 safer alternatives with biomechanical analysis & SEO metadata', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/exercise-catalog/alternatives/bench-press-shoulder-pain',
      {
        method: 'GET',
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data?: {
        originalExercise: {
          id: string;
          name: string;
          movementPattern: string;
          target: string;
          bodyPart: string;
          mediaUrl: string | null;
        };
        painCondition: {
          code: string;
          displayName: string;
          bodyRegion: string;
          biomechanicalCause: string;
          jointShearRating: 'high' | 'moderate' | 'low';
        };
        alternatives: Array<{
          id: string;
          name: string;
          targetMuscle: string;
          shearReductionReason: string;
          setupCue: string;
          mediaUrl: string | null;
        }>;
        seoMetadata: {
          title: string;
          metaDescription: string;
          canonicalUrl: string;
          schemaJsonLd: {
            '@context': string;
            '@graph': Array<{ '@type': string }>;
          };
        };
      };
    };

    expect(json.data).toBeDefined();
    expect(json.data?.originalExercise.name).toContain('Bench Press');
    expect(json.data?.originalExercise.movementPattern).toBe('horizontal_push');
    expect(json.data?.painCondition.code).toBe('shoulder_pain');
    expect(json.data?.painCondition.jointShearRating).toBe('high');
    expect(json.data?.alternatives.length).toBe(3);
    expect(json.data?.alternatives[0]?.shearReductionReason).toBeDefined();
    expect(json.data?.alternatives[0]?.setupCue).toBeDefined();
    expect(json.data?.seoMetadata.title).toContain('Bench Press');
    expect(json.data?.seoMetadata.schemaJsonLd['@context']).toBe('https://schema.org');
    expect(Array.isArray(json.data?.seoMetadata.schemaJsonLd['@graph'])).toBe(true);
  });

  it('GET /api/v1/exercises/alternatives/:slug handles back-squat-knee-pain and deadlift-lower-back-pain', async () => {
    const app = createApp();

    const squatRes = await app.fetch(
      '/api/v1/exercises/alternatives/back-squat-knee-pain',
      { method: 'GET' },
      mockEnv,
    );
    expect(squatRes.status).toBe(200);
    const squatJson = (await squatRes.json()) as {
      data?: {
        painCondition?: { code: string };
        alternatives?: unknown[];
      };
    };
    expect(squatJson.data?.painCondition?.code).toBe('knee_pain');
    expect(squatJson.data?.alternatives?.length).toBe(3);

    const deadliftRes = await app.fetch(
      '/api/v1/exercises/alternatives/deadlift-lower-back-pain',
      { method: 'GET' },
      mockEnv,
    );
    expect(deadliftRes.status).toBe(200);
    const deadliftJson = (await deadliftRes.json()) as {
      data?: {
        painCondition?: { code: string };
        alternatives?: unknown[];
      };
    };
    expect(deadliftJson.data?.painCondition?.code).toBe('lower_back_pain');
    expect(deadliftJson.data?.alternatives?.length).toBe(3);
  });
});
