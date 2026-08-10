import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { createApp } from '../src/app';
import { createAdminCatalogRoutes } from '../src/routes/admin-catalog';
import type { AuthenticatedUser } from '../src/types/auth';
import type { WorkerBindings } from '../src/env';
import { createCatalogDb } from './support/catalog-db';

describe('admin catalog routes', () => {
  it('requires an admin role to activate a catalog', async () => {
    const app = createApp();

    const response = await app.request(
      '/api/v1/admin/catalogs/catalog-1/activate',
      {
        method: 'POST',
      },
      { APP_ENV: 'local' },
    );

    expect(response.status).toBe(403);
  });

  it.each(['ready', 'activate'])(
    'forbids a non-admin from the catalog %s transition',
    async (transition) => {
      const response = await createApp().request(
        `/api/v1/admin/catalogs/catalog-1/${transition}`,
        { method: 'POST' },
        { APP_ENV: 'local' },
      );

      expect(response.status).toBe(403);
    },
  );

  it('POSTs a complete review-required fixture to ready', async () => {
    const response = await createAdminCatalogTestApp().request(
      '/api/v1/admin/catalogs/catalog-1/ready',
      { method: 'POST' },
      {
        DB: createCatalogDb({ ratingCount: 54, status: 'review_required' }),
      } as unknown as WorkerBindings,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { catalogVersionId: 'catalog-1', ready: true, status: 'ready' },
    });
  });

  it('requires all manual safety override audit fields', async () => {
    const app = createAdminCatalogTestApp();

    const response = await app.request('/api/v1/admin/exercises/exercise-1/safety', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rating: 'avoid', reason: 'Unsafe without modification.' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_request' },
    });
  });

  it('records a manual override as authenticated immutable evidence', async () => {
    const statements: string[] = [];
    const db = {
      prepare(sql: string) {
        statements.push(sql);
        return {
          bind() {
            return this;
          },
          async raw() {
            return [['exercise-1', 'catalog-1', 'review_required', 'safety-v1', 0]];
          },
          async run() {
            return { success: true, meta: { changes: 1 } };
          },
        };
      },
      async batch(batch: Array<{ run(): Promise<unknown> }>) {
        return Promise.all(batch.map((statement) => statement.run()));
      },
    } as unknown as D1Database;
    const app = createAdminCatalogTestApp();

    const response = await app.request(
      '/api/v1/admin/exercises/exercise-1/safety',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rating: 'avoid',
          reason: 'Unsafe without modification.',
          reviewedBy: 'forged-reviewer',
          analysisVersion: 'safety-v1',
        }),
      },
      { DB: db } as unknown as WorkerBindings,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        exerciseId: 'exercise-1',
        rating: 'avoid',
        reviewedBy: 'admin-1',
        manualOverride: true,
      },
    });
    expect(statements.some((sql) => sql.includes('insert into "exercise_analysis_evidence"'))).toBe(
      true,
    );
    expect(statements.some((sql) => sql.includes('update "exercise_analysis_evidence"'))).toBe(
      false,
    );
    expect(statements.some((sql) => sql.includes('update "exercise_safety_profiles"'))).toBe(true);
  });

  it('requires matching classified movement patterns in a complete metadata override', async () => {
    const response = await createAdminCatalogTestApp().request(
      '/api/v1/admin/exercises/exercise-1/catalog-metadata',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...completeMetadataOverride(),
          attributes: { ...completeMetadataOverride().attributes, movementPattern: 'pull' },
        }),
      },
    );

    expect(response.status).toBe(400);
  });

  it('updates catalog metadata and appends immutable manual evidence', async () => {
    const statements: string[] = [];
    const db = {
      prepare(sql: string) {
        statements.push(sql);
        return {
          bind() {
            return this;
          },
          async raw() {
            return [['exercise-1', 'review_required', 0]];
          },
          async run() {
            return { success: true, meta: { changes: 1 } };
          },
        };
      },
      async batch(batch: Array<{ run(): Promise<unknown> }>) {
        return Promise.all(batch.map((statement) => statement.run()));
      },
    } as unknown as D1Database;

    const response = await createAdminCatalogTestApp().request(
      '/api/v1/admin/exercises/exercise-1/catalog-metadata',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(completeMetadataOverride()),
      },
      { DB: db } as unknown as WorkerBindings,
    );

    expect(response.status).toBe(200);
    expect(statements.some((sql) => sql.includes('update "master_exercises"'))).toBe(true);
    expect(statements.some((sql) => sql.includes('insert into "exercise_analysis_evidence"'))).toBe(
      true,
    );
    expect(statements.some((sql) => sql.includes('update "exercise_analysis_evidence"'))).toBe(
      false,
    );
    expect(statements.some((sql) => sql.includes('review_revision'))).toBe(true);
  });

  it('uses the authenticated actor rather than forged duplicate reviewer input', async () => {
    const response = await createAdminCatalogTestApp().request(
      '/api/v1/admin/catalogs/catalog-1/duplicate-reviews/squat/resolve',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reason: 'Intentional source variants.',
          reviewedBy: 'forged-reviewer',
        }),
      },
      { DB: createDuplicateResolutionDb() } as unknown as WorkerBindings,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { reviewedBy: 'admin-1', status: 'resolved' },
    });
  });

  it('appends two immutable safety audit events for repeated human decisions', async () => {
    const batches: Array<Array<{ sql?: string }>> = [];
    const db = {
      prepare(sql: string) {
        return {
          sql,
          bind() {
            return this;
          },
          async raw() {
            return [
              [
                'exercise-1',
                'catalog-1',
                'review_required',
                'safety-v1',
                0,
                'caution',
                'Earlier decision.',
              ],
            ];
          },
          async run() {
            return { success: true, meta: { changes: 1 } };
          },
        };
      },
      async batch(batch: Array<{ sql?: string; run(): Promise<unknown> }>) {
        batches.push(batch);
        return Promise.all(batch.map((statement) => statement.run()));
      },
    } as unknown as D1Database;
    const app = createAdminCatalogTestApp();

    for (const rating of ['caution', 'avoid']) {
      const response = await app.request(
        '/api/v1/admin/exercises/exercise-1/safety',
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            rating,
            reason: `Human decision: ${rating}.`,
            analysisVersion: 'safety-v1',
          }),
        },
        { DB: db } as unknown as WorkerBindings,
      );
      expect(response.status).toBe(200);
    }

    const evidenceStatements = batches
      .flat()
      .filter((statement) => statement.sql?.includes('insert into "exercise_analysis_evidence"'));
    expect(evidenceStatements).toHaveLength(2);
    expect(
      batches
        .flat()
        .some((statement) => statement.sql?.includes('update "exercise_analysis_evidence"')),
    ).toBe(false);
  });

  it('does not resolve a duplicate when its previously read revision is stale', async () => {
    let batchStatements: Array<{ sql?: string }> = [];
    const db = {
      prepare(sql: string) {
        return {
          sql,
          bind() {
            return this;
          },
          async raw() {
            return [['review_required', 4]];
          },
          async run() {
            return { success: true, meta: { changes: 0 } };
          },
        };
      },
      async batch(batch: Array<{ sql?: string; run(): Promise<unknown> }>) {
        batchStatements = batch;
        return [{ meta: { changes: 0 } }, { meta: { changes: 0 } }];
      },
    } as unknown as D1Database;

    const response = await createAdminCatalogTestApp().request(
      '/api/v1/admin/catalogs/catalog-1/duplicate-reviews/squat/resolve',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Intentional source variants.', reviewedBy: 'admin-1' }),
      },
      { DB: db } as unknown as WorkerBindings,
    );

    expect(response.status).toBe(409);
    expect(batchStatements[0]?.sql).toContain('update "exercise_duplicate_review_groups"');
    expect(batchStatements[0]?.sql).toContain('"review_revision" = ?');
  });
});

function createDuplicateResolutionDb(): D1Database {
  return {
    prepare() {
      return {
        bind() {
          return this;
        },
        async raw() {
          return [['review_required', 0]];
        },
        async run() {
          return { success: true, meta: { changes: 1 } };
        },
      };
    },
    async batch(batch: Array<{ run(): Promise<unknown> }>) {
      return Promise.all(batch.map((statement) => statement.run()));
    },
  } as unknown as D1Database;
}

function completeMetadataOverride() {
  return {
    catalogVersionId: 'catalog-1',
    movementPattern: 'core',
    attributes: {
      movementPattern: 'core',
      loadedRegions: [],
      impactLevel: 'low',
      spinalLoad: 'low',
      balanceDemand: 'low',
      technicalComplexity: 'beginner',
      overhead: false,
      behindNeck: false,
      deepFlexion: false,
      explosive: false,
      unilateral: false,
      rotational: false,
      inverted: false,
    },
    reason: 'Reviewed source instructions.',
    reviewedBy: 'admin@example.test',
  };
}

function createAdminCatalogTestApp() {
  const app = new Hono<{ Variables: { authUser: AuthenticatedUser } }>();
  app.use('*', async (c, next) => {
    c.set('authUser', {
      id: 'admin-1',
      email: 'admin@example.test',
      role: 'admin',
      roles: ['admin'],
    });
    await next();
  });
  app.route('/api/v1', createAdminCatalogRoutes());
  return app;
}
