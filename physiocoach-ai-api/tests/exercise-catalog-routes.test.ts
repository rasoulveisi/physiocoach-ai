import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

import {
  buildExerciseCatalogMediaResponse,
  createExerciseCatalogRoutes,
  mediaUrlField,
} from '../src/routes/exercise-catalog';
import type { WorkerBindings } from '../src/env';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.sequential('exercise catalog routes', () => {
  it('keeps compatible media URL fields and includes attribution metadata', () => {
    expect(
      buildExerciseCatalogMediaResponse({
        exerciseId: 'ex_exercises_dataset_0001',
        name: 'Dumbbell Bent Over Face Pull',
        mediaUrl: 'https://media.physiocoach.test/exercises/face-pull.webp',
        mediaType: 'image',
        source: 'physiocoach',
        sourceId: 'commission-123',
        licenseName: 'Commercial license',
        licenseUrl: 'https://example.test/license',
        licenseAuthor: 'PhysioCoach',
        attributionText: 'PhysioCoach exercise image',
        isAiGenerated: true,
      }),
    ).toEqual({
      exerciseId: 'ex_exercises_dataset_0001',
      name: 'Dumbbell Bent Over Face Pull',
      imageUrl: 'https://media.physiocoach.test/exercises/face-pull.webp',
      mediaUrl: 'https://media.physiocoach.test/exercises/face-pull.webp',
      source: 'physiocoach',
      sourceId: 'commission-123',
      licenseName: 'Commercial license',
      licenseUrl: 'https://example.test/license',
      licenseAuthor: 'PhysioCoach',
      attributionText: 'PhysioCoach exercise image',
      isAiGenerated: true,
    });
  });

  it('returns null when an exercise has no approved stored media without fetching externally', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const app = createExerciseCatalogTestApp();

    const response = await app.request(
      '/api/v1/exercise-catalog/media?exerciseId=ex_legacy_1640',
      undefined,
      { DB: createD1([]) } as unknown as WorkerBindings,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns only approved media with an accepted ownership status', async () => {
    const app = createExerciseCatalogTestApp();
    const approvedMedia = [
      [
        'ex_exercises_dataset_0001',
        'New squat exercise',
        'https://media.physiocoach.test/exercises/squat.webp',
        'thumbnail',
        'physiocoach',
        'media-squat-v1',
        null,
        null,
        null,
        null,
      ],
    ];

    const db = createD1(approvedMedia);
    const response = await app.request(
      '/api/v1/exercise-catalog/media?exerciseId=ex_exercises_dataset_0001',
      undefined,
      { DB: db } as unknown as WorkerBindings,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        exerciseId: 'ex_exercises_dataset_0001',
        name: 'New squat exercise',
        thumbnailUrl: 'https://media.physiocoach.test/exercises/squat.webp',
        mediaUrl: 'https://media.physiocoach.test/exercises/squat.webp',
        source: 'physiocoach',
        sourceId: 'media-squat-v1',
      },
    });
    expect(db.statements[0]).toContain('"exercise_media"."review_status" = ?');
    expect(db.statements[0]).toContain('"exercise_media"."ownership_status" in (?, ?, ?, ?)');
  });

  it('dedupes identical stored-media lookups in a batch without external fetches', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const mediaRows = [
      [
        'ex_exercises_dataset_0001',
        'New squat exercise',
        'https://media.physiocoach.test/exercises/squat.webp',
        'image',
        'physiocoach',
        'media-squat-v1',
        null,
        null,
        null,
        null,
      ],
    ];
    const db = createD1(mediaRows);
    const app = createExerciseCatalogTestApp();

    const response = await app.request(
      '/api/v1/exercise-catalog/media/batch',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [
            { key: 'card-1', exerciseId: 'ex_exercises_dataset_0001' },
            { key: 'card-2', exerciseId: 'ex_exercises_dataset_0001' },
          ],
        }),
      },
      { DB: db } as unknown as WorkerBindings,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        'card-1': {
          exerciseId: 'ex_exercises_dataset_0001',
          name: 'New squat exercise',
          imageUrl: 'https://media.physiocoach.test/exercises/squat.webp',
          mediaUrl: 'https://media.physiocoach.test/exercises/squat.webp',
          source: 'physiocoach',
          sourceId: 'media-squat-v1',
        },
        'card-2': {
          exerciseId: 'ex_exercises_dataset_0001',
          name: 'New squat exercise',
          imageUrl: 'https://media.physiocoach.test/exercises/squat.webp',
          mediaUrl: 'https://media.physiocoach.test/exercises/squat.webp',
          source: 'physiocoach',
          sourceId: 'media-squat-v1',
        },
      },
    });
    expect(db.statements).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps legacy media types to existing response URL fields', () => {
    expect(mediaUrlField('thumbnail', 'https://example.test/thumb.webp')).toEqual({
      thumbnailUrl: 'https://example.test/thumb.webp',
    });
    expect(mediaUrlField('animated_gif', 'https://example.test/guide.gif')).toEqual({
      animatedGifUrl: 'https://example.test/guide.gif',
    });
    expect(mediaUrlField('unknown', 'https://example.test/media.webp')).toEqual({
      mediaUrl: 'https://example.test/media.webp',
    });
  });
});

function createExerciseCatalogTestApp() {
  const app = new Hono<{ Bindings: WorkerBindings }>();
  app.route('/api/v1', createExerciseCatalogRoutes());
  return app;
}

function createD1(rows: unknown[][]) {
  const statements: string[] = [];
  return {
    statements,
    prepare(sql: string) {
      statements.push(sql);
      return {
        bind() {
          return this;
        },
        async raw() {
          return rows;
        },
      };
    },
  } as unknown as D1Database & { statements: string[] };
}
