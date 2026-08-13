import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

const expectedRoutes = [
  { method: 'POST', runtimePath: '/api/v1/auth/register', openApiPath: '/api/v1/auth/register' },
  { method: 'POST', runtimePath: '/api/v1/auth/login', openApiPath: '/api/v1/auth/login' },
  { method: 'POST', runtimePath: '/api/v1/auth/refresh', openApiPath: '/api/v1/auth/refresh' },
  { method: 'POST', runtimePath: '/api/v1/auth/logout', openApiPath: '/api/v1/auth/logout' },
  { method: 'GET', runtimePath: '/api/v1/auth/me', openApiPath: '/api/v1/auth/me' },
  {
    method: 'POST',
    runtimePath: '/api/v1/auth/oauth/exchange',
    openApiPath: '/api/v1/auth/oauth/exchange',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/auth/google/start',
    openApiPath: '/api/v1/auth/google/start',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/auth/google/callback',
    openApiPath: '/api/v1/auth/google/callback',
  },
  { method: 'GET', runtimePath: '/api/v1/health', openApiPath: '/api/v1/health' },
  { method: 'GET', runtimePath: '/api/v1/docs', openApiPath: '/api/v1/docs' },
  { method: 'GET', runtimePath: '/api/v1/openapi.json', openApiPath: '/api/v1/openapi.json' },
  { method: 'GET', runtimePath: '/api/v1/me', openApiPath: '/api/v1/me' },
  { method: 'PATCH', runtimePath: '/api/v1/profile', openApiPath: '/api/v1/profile' },
  { method: 'GET', runtimePath: '/api/v1/assessments', openApiPath: '/api/v1/assessments' },
  { method: 'POST', runtimePath: '/api/v1/assessments', openApiPath: '/api/v1/assessments' },
  {
    method: 'GET',
    runtimePath: '/api/v1/assessments/latest',
    openApiPath: '/api/v1/assessments/latest',
  },
  { method: 'GET', runtimePath: '/api/v1/considerations', openApiPath: '/api/v1/considerations' },
  {
    method: 'GET',
    runtimePath: '/api/v1/posture-assessment',
    openApiPath: '/api/v1/posture-assessment',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/posture-assessment/analysis',
    openApiPath: '/api/v1/posture-assessment/analysis',
  },
  {
    method: 'POST',
    runtimePath: '/api/v1/workout-plans/generate',
    openApiPath: '/api/v1/workout-plans/generate',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/workout-plans/current',
    openApiPath: '/api/v1/workout-plans/current',
  },
  {
    method: 'DELETE',
    runtimePath: '/api/v1/workout-plans/current',
    openApiPath: '/api/v1/workout-plans/current',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/workout-plans/plan-1',
    openApiPath: '/api/v1/workout-plans/{id}',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/workout-sessions',
    openApiPath: '/api/v1/workout-sessions',
  },
  {
    method: 'POST',
    runtimePath: '/api/v1/workout-sessions',
    openApiPath: '/api/v1/workout-sessions',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/workout-sessions/session-1',
    openApiPath: '/api/v1/workout-sessions/{id}',
  },
  {
    method: 'PATCH',
    runtimePath: '/api/v1/workout-sessions/session-1',
    openApiPath: '/api/v1/workout-sessions/{id}',
  },
  {
    method: 'POST',
    runtimePath: '/api/v1/workout-sessions/session-1/complete',
    openApiPath: '/api/v1/workout-sessions/{id}/complete',
  },
  {
    method: 'POST',
    runtimePath: '/api/v1/exercise-logs',
    openApiPath: '/api/v1/exercise-logs',
  },
  {
    method: 'PATCH',
    runtimePath: '/api/v1/exercise-logs/log-1',
    openApiPath: '/api/v1/exercise-logs/{id}',
  },
  {
    method: 'DELETE',
    runtimePath: '/api/v1/exercise-logs/log-1',
    openApiPath: '/api/v1/exercise-logs/{id}',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/exercise-catalog/media?exerciseId=master-ex-1',
    openApiPath: '/api/v1/exercise-catalog/media',
  },
  {
    method: 'POST',
    runtimePath: '/api/v1/exercise-catalog/media/batch',
    openApiPath: '/api/v1/exercise-catalog/media/batch',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/body-measurements',
    openApiPath: '/api/v1/body-measurements',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/measurement',
    openApiPath: '/api/v1/measurement',
  },
  {
    method: 'POST',
    runtimePath: '/api/v1/body-measurements',
    openApiPath: '/api/v1/body-measurements',
  },
  {
    method: 'POST',
    runtimePath: '/api/v1/measurement',
    openApiPath: '/api/v1/measurement',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/progress/summary',
    openApiPath: '/api/v1/progress/summary',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/admin',
    openApiPath: '/api/v1/admin',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/admin/health',
    openApiPath: '/api/v1/admin/health',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/admin/catalogs/catalog-1/coverage',
    openApiPath: '/api/v1/admin/catalogs/{id}/coverage',
  },
  {
    method: 'GET',
    runtimePath:
      '/api/v1/admin/catalogs/catalog-1/red-exercises?consideration=knee_pain&severity=severe',
    openApiPath: '/api/v1/admin/catalogs/{id}/red-exercises',
  },
  {
    method: 'POST',
    runtimePath: '/api/v1/admin/catalogs/catalog-1/ready',
    openApiPath: '/api/v1/admin/catalogs/{id}/ready',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/admin/catalogs/catalog-1/duplicate-reviews',
    openApiPath: '/api/v1/admin/catalogs/{id}/duplicate-reviews',
  },
  {
    method: 'POST',
    runtimePath: '/api/v1/admin/catalogs/catalog-1/duplicate-reviews/squat/resolve',
    openApiPath: '/api/v1/admin/catalogs/{id}/duplicate-reviews/{name}/resolve',
  },
  {
    method: 'PATCH',
    runtimePath: '/api/v1/admin/exercises/exercise-1/safety',
    openApiPath: '/api/v1/admin/exercises/{id}/safety',
  },
  {
    method: 'PATCH',
    runtimePath: '/api/v1/admin/exercises/exercise-1/catalog-metadata',
    openApiPath: '/api/v1/admin/exercises/{id}/catalog-metadata',
  },
  {
    method: 'POST',
    runtimePath: '/api/v1/admin/catalogs/catalog-1/activate',
    openApiPath: '/api/v1/admin/catalogs/{id}/activate',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/settings',
    openApiPath: '/api/v1/settings',
  },
  {
    method: 'PATCH',
    runtimePath: '/api/v1/settings',
    openApiPath: '/api/v1/settings',
  },
  {
    method: 'POST',
    runtimePath: '/api/v1/workout-sessions/session-1/swap-exercise',
    openApiPath: '/api/v1/workout-sessions/{id}/swap-exercise',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/progress/prs',
    openApiPath: '/api/v1/progress/prs',
  },
  {
    method: 'GET',
    runtimePath: '/api/v1/progress/muscle-volume',
    openApiPath: '/api/v1/progress/muscle-volume',
  },
] as const;

type OpenApiDocument = {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, Record<string, unknown>> };
};

describe('openapi route', () => {
  it('includes requestId in API error responses', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/workout-plans/generate', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error?: { code?: string; requestId?: string; message?: string };
    };

    expect(body.error?.code).toBe('invalid_request');
    expect(typeof body.error?.requestId).toBe('string');
    expect(body.error?.requestId?.length).toBeGreaterThan(0);
  });

  it('publishes the versioned API contract', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/openapi.json');

    expect(response.status).toBe(200);

    const body = (await response.json()) as OpenApiDocument;

    expect(body.openapi).toBe('3.1.0');
    expect(body.info.title).toBe('PhysioCoach AI API');
    expect(body.info.version).toBe('0.4.0');
    expect(Object.keys(body.paths).sort()).toEqual(
      Array.from(new Set(expectedRoutes.map((route) => route.openApiPath))).sort(),
    );
  });

  it('documents the complete audited catalog metadata override contract', async () => {
    const response = await createApp().request('/api/v1/openapi.json');
    const body = (await response.json()) as OpenApiDocument;
    const operation = body.paths['/api/v1/admin/exercises/{id}/catalog-metadata']?.patch as {
      security?: unknown;
      requestBody?: { content?: { 'application/json'?: { schema?: { $ref?: string } } } };
      responses?: Record<string, unknown>;
    };
    const schema = body.components.schemas.CatalogMetadataOverrideInput as {
      required?: string[];
      additionalProperties?: boolean;
      properties?: { movementPattern?: { enum?: string[] }; attributes?: { $ref?: string } };
    };
    const attributes = body.components.schemas.ExerciseCatalogAttributes as {
      required?: string[];
      additionalProperties?: boolean;
    };

    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(operation.requestBody?.content?.['application/json']?.schema?.$ref).toBe(
      '#/components/schemas/CatalogMetadataOverrideInput',
    );
    expect(Object.keys(operation.responses ?? {}).sort()).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
      '409',
    ]);
    expect(schema.required).toEqual([
      'catalogVersionId',
      'movementPattern',
      'attributes',
      'reason',
    ]);
    expect(schema.properties?.movementPattern?.enum).not.toContain('unclassified');
    expect(schema.properties?.attributes?.$ref).toBe(
      '#/components/schemas/ExerciseCatalogAttributes',
    );
    expect(schema.additionalProperties).toBe(false);
    expect(attributes.required).toHaveLength(13);
    expect(attributes.additionalProperties).toBe(false);
  });

  it('documents authentication and conflict responses for catalog admin operations', async () => {
    const response = await createApp().request('/api/v1/openapi.json');
    const body = (await response.json()) as OpenApiDocument;
    const operations = [
      body.paths['/api/v1/admin/catalogs/{id}/ready']?.post,
      body.paths['/api/v1/admin/catalogs/{id}/duplicate-reviews/{name}/resolve']?.post,
      body.paths['/api/v1/admin/exercises/{id}/safety']?.patch,
      body.paths['/api/v1/admin/exercises/{id}/catalog-metadata']?.patch,
      body.paths['/api/v1/admin/catalogs/{id}/activate']?.post,
    ] as Array<{ security?: unknown; responses?: Record<string, unknown> } | undefined>;

    for (const operation of operations) {
      expect(operation?.security).toEqual([{ bearerAuth: [] }]);
      expect(operation?.responses?.['401']).toBeDefined();
      expect(operation?.responses?.['409']).toBeDefined();
    }

    const coverage = body.paths['/api/v1/admin/catalogs/{id}/coverage']?.get as
      | { security?: unknown; responses?: Record<string, unknown> }
      | undefined;
    expect(coverage?.security).toEqual([{ bearerAuth: [] }]);
    expect(coverage?.responses?.['401']).toBeDefined();
  });

  it.each(
    expectedRoutes.map((route) => [route.method, route.runtimePath, route.openApiPath] as const),
  )('describes callable %s %s in OpenAPI', async (method, runtimePath, openApiPath) => {
    const app = createApp();
    const [openApiResponse, routeResponse] = await Promise.all([
      app.request('/api/v1/openapi.json'),
      app.request(runtimePath, { method }),
    ]);

    const body = (await openApiResponse.json()) as OpenApiDocument;

    expect(routeResponse.status).not.toBe(404);
    expect(body.paths[openApiPath]?.[method.toLowerCase()]).toBeDefined();
  });

  it.each([
    [
      'GET',
      '/api/v1/me',
      null,
      {
        data: {
          id: '00000000-0000-4000-8000-000000000001',
          email: 'local@physiocoach.dev',
          role: 'user',
          roles: ['user'],
        },
      },
    ],
    [
      'PATCH',
      '/api/v1/profile',
      {
        age: 34,
        sex: 'male',
        heightCm: 178,
        weightKg: 82.5,
        lifestyle: 'active',
        experienceLevel: 'intermediate',
      },
      {
        error: {
          code: 'invalid_request',
          message: 'Profile persistence is unavailable in this environment.',
        },
      },
    ],
    [
      'POST',
      '/api/v1/assessments',
      {
        goals: ['muscle_gain'],
        frequencyDays: 4,
        equipment: ['dumbbells_only'],
        limitations: [],
        postureFlags: [],
      },
      {
        data: {
          goals: ['muscle_gain'],
          frequencyDays: 4,
          equipment: ['dumbbells_only'],
          considerations: [],
          limitations: [],
          postureFlags: [],
        },
      },
    ],
    [
      'GET',
      '/api/v1/considerations',
      null,
      {
        data: [
          {
            code: 'rounded_shoulders',
            displayName: 'Rounded shoulders',
            groupCode: 'posture',
            bodyRegion: 'shoulders',
            kind: 'posture',
            severityEnabled: true,
          },
          {
            code: 'neck_pain',
            displayName: 'Neck pain or stiffness',
            groupCode: 'neck',
            bodyRegion: 'neck',
            kind: 'pain',
            severityEnabled: true,
          },
          {
            code: 'shoulder_pain',
            displayName: 'Shoulder pain',
            groupCode: 'shoulders',
            bodyRegion: 'shoulders',
            kind: 'pain',
            severityEnabled: true,
          },
          {
            code: 'lower_back_pain',
            displayName: 'Lower-back pain',
            groupCode: 'back',
            bodyRegion: 'lower_back',
            kind: 'pain',
            severityEnabled: true,
          },
          {
            code: 'knee_pain',
            displayName: 'Knee pain',
            groupCode: 'knees',
            bodyRegion: 'knees',
            kind: 'pain',
            severityEnabled: true,
          },
        ],
      },
    ],
    [
      'POST',
      '/api/v1/body-measurements',
      {
        measuredAt: '2026-05-30T08:00:00.000Z',
        bodyWeightKg: 81.2,
      },
      {
        data: {
          measuredAt: '2026-05-30T08:00:00.000Z',
          bodyWeightKg: 81.2,
        },
      },
    ],
    [
      'POST',
      '/api/v1/workout-sessions',
      {
        workoutPlanId: 'plan-1',
        dayIndex: 0,
        scheduledDate: '2026-05-31',
      },
      {
        data: {
          workoutPlanId: 'plan-1',
          scheduledDate: '2026-05-31',
          dayIndex: 0,
        },
      },
    ],
    [
      'POST',
      '/api/v1/exercise-logs',
      {
        workoutSessionId: 'session-1',
        exerciseName: 'Goblet squat',
        masterExerciseId: 'master-ex-1',
        movementPattern: 'squat',
        muscleGroups: ['quads'],
        setIndex: 1,
        reps: 10,
        weightKg: 24,
      },
      {
        data: {
          workoutSessionId: 'session-1',
          exerciseName: 'Goblet squat',
          masterExerciseId: 'master-ex-1',
          movementPattern: 'squat',
          muscleGroups: ['quads'],
          setIndex: 1,
          reps: 10,
          weightKg: 24,
        },
      },
    ],
    [
      'POST',
      '/api/v1/workout-sessions/session-1/complete',
      null,
      { data: { sessionId: 'session-1', completed: true } },
    ],
    ['GET', '/api/v1/exercise-catalog/media?exerciseId=master-ex-1', null, { data: null }],
  ])('returns a stable envelope for %s %s', async (method, path, payload, expectedBody) => {
    const app = createApp();
    const init =
      payload === null
        ? { method }
        : {
            method,
            body: JSON.stringify(payload),
            headers: { 'content-type': 'application/json' },
          };
    const env = path.includes('/profile')
      ? { APP_ENV: 'local', DB: {} as Record<string, never> }
      : { APP_ENV: 'local' };
    const response = await app.request(
      path,
      init,
      env as { APP_ENV: string; DB?: Record<string, never> },
    );
    const expectedStatus = path === '/api/v1/profile' && method === 'PATCH' ? 400 : 200;
    const body = (await response.json()) as unknown;

    expect(response.status).toBe(expectedStatus);
    if (path === '/api/v1/profile' && method === 'PATCH') {
      expect(body).toMatchObject(expectedBody);
    } else {
      expect(body).toEqual(expectedBody);
    }
  });
});
