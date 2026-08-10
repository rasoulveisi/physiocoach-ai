import { describe, expect, it } from 'vitest';
import { getAuthKeyConfig } from '../src/auth/keys';
import { signAccessToken } from '../src/auth/tokens';
import { createApp } from '../src/app';
import type { WorkerBindings } from '../src/env';

function devEnv(): WorkerBindings {
  return {
    APP_ENV: 'dev',
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
    // Local tests do not exercise D1 calls.
    DB: undefined as unknown as D1Database,
  } as WorkerBindings;
}

describe('authMiddleware', () => {
  it('allows public API docs in any env', async () => {
    const app = createApp();

    const response = await app.request('/api/v1/openapi.json', undefined, devEnv());

    expect(response.status).toBe(200);
  });

  it('does not expose or auto-send local auth bypass tokens in docs HTML', async () => {
    const app = createApp();

    const response = await app.request('/api/v1/docs', undefined, {
      ...devEnv(),
      APP_ENV: 'local',
      LOCAL_AUTH_BYPASS_TOKEN: 'secret-local-docs-token',
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).not.toContain('secret-local-docs-token');
    expect(html).not.toContain('x-local-auth-bypass');
    expect(html).not.toContain('localAuthBypass');
  });

  it('allows health check in any env', async () => {
    const app = createApp();

    const response = await app.request('/api/v1/health', undefined, devEnv());

    expect(response.status).toBe(200);
  });

  it('rejects protected requests without an authorization token in dev', async () => {
    const app = createApp();

    const response = await app.request(
      '/api/v1/profile',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: 35,
          sex: 'male',
          heightCm: 180,
          weightKg: 80,
          lifestyle: 'desk_job',
          experienceLevel: 'beginner',
        }),
      },
      devEnv(),
    );

    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('unauthorized');
    expect(body.error.message).toBe('Missing Authorization header');
  });

  it('allows public auth register route without an authorization token', async () => {
    const app = createApp();

    const response = await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
      devEnv(),
    );

    expect(response.status).toBe(400);
  });

  it('keeps CORS headers on protected error responses', async () => {
    const app = createApp();

    const response = await app.request(
      '/api/v1/profile',
      {
        headers: { Origin: 'https://physiocoach.otconnect.ir' },
      },
      devEnv(),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://physiocoach.otconnect.ir',
    );
  });

  it('rejects explicit local auth bypass token in deployed dev', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/me',
      {
        headers: {
          'x-local-auth-bypass': 'local-bypass-token',
        },
      },
      {
        ...devEnv(),
        LOCAL_AUTH_BYPASS_TOKEN: 'local-bypass-token',
      },
    );

    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('unauthorized');
    expect(body.error.message).toBe('Missing Authorization header');
  });

  it('allows explicit local auth bypass token only in local', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/me',
      {
        headers: {
          'x-local-auth-bypass': 'local-bypass-token',
        },
      },
      {
        ...devEnv(),
        APP_ENV: 'local',
        LOCAL_AUTH_BYPASS_TOKEN: 'local-bypass-token',
      },
    );

    const body = (await response.json()) as { data: { id: string } };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('rejects invalid explicit local auth bypass token in dev', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/me',
      {
        headers: {
          'x-local-auth-bypass': 'wrong-token',
        },
      },
      {
        ...devEnv(),
        LOCAL_AUTH_BYPASS_TOKEN: 'local-bypass-token',
      },
    );

    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('unauthorized');
    expect(body.error.message).toBe('Missing Authorization header');
  });

  it('rejects dev swagger bypass in deployed dev', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/me',
      {
        headers: {
          'x-dev-swagger': '1',
          'x-dev-user-id': '00000000-0000-4000-8000-000000000002',
          'x-user-role': 'admin',
        },
      },
      devEnv(),
    );

    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('unauthorized');
    expect(body.error.message).toBe('Missing Authorization header');
  });

  it('allows the secret-gated Swagger test identity only in dev', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/me',
      {
        headers: {
          'x-dev-swagger': '1',
          'x-dev-swagger-token': 'dev-swagger-secret',
          'x-dev-user-role': 'admin',
          'x-dev-user-id': '00000000-0000-4000-8000-000000000002',
        },
      },
      { ...devEnv(), DEV_SWAGGER_TOKEN: 'dev-swagger-secret' },
    );

    const body = (await response.json()) as { data: { id: string; role: string; roles: string[] } };

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      id: '00000000-0000-4000-8000-000000000002',
      role: 'admin',
      roles: ['admin'],
    });
  });

  it('does not allow local auth bypass to impersonate admin', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/me',
      {
        headers: {
          'x-user-role': 'admin',
        },
      },
      { ...devEnv(), APP_ENV: 'local' },
    );

    const body = (await response.json()) as { data: { role: string; roles: string[] } };

    expect(response.status).toBe(200);
    expect(body.data.role).toBe('user');
    expect(body.data.roles).toEqual(['user']);
  });

  it('rejects protected JWT requests without a usable DB in dev', async () => {
    const app = createApp();
    const env = devEnv();
    const access = await signAccessToken(
      getAuthKeyConfig(env),
      {
        userId: '2f46400d-5d5b-4ee8-a154-cdb40e64c710',
        email: 'user@example.com',
        roles: ['user'],
      },
      'session-1',
    );

    const response = await app.request(
      '/api/v1/auth/me',
      {
        headers: {
          Authorization: `Bearer ${access.token}`,
        },
      },
      env,
    );

    const body = (await response.json()) as { user: { id: string; email: string } };

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: expect.objectContaining({
        code: 'auth_persistence_unavailable',
        message: 'Auth persistence is unavailable.',
      }),
    });
  });

  it('allows protected requests with a valid first-party access token and active DB session', async () => {
    const app = createApp();
    const env = {
      ...devEnv(),
      DB: createSessionLookupD1({
        id: 'session-1',
        user_id: '2f46400d-5d5b-4ee8-a154-cdb40e64c710',
        refresh_token_hash: 'hash',
        user_agent: null,
        ip_hash: null,
        absolute_expires_at: '2099-01-01T00:00:00.000Z',
        idle_expires_at: '2099-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
        revoked_at: null,
      }) as unknown as D1Database,
    };
    const access = await signAccessToken(
      getAuthKeyConfig(env),
      {
        userId: '2f46400d-5d5b-4ee8-a154-cdb40e64c710',
        email: 'user@example.com',
        roles: ['user'],
      },
      'session-1',
    );

    const response = await app.request(
      '/api/v1/auth/me',
      {
        headers: {
          Authorization: `Bearer ${access.token}`,
        },
      },
      env,
    );

    const body = (await response.json()) as { user: { id: string; email: string } };

    expect(response.status).toBe(200);
    expect(body.user).toMatchObject({
      id: '2f46400d-5d5b-4ee8-a154-cdb40e64c710',
      email: 'user@example.com',
    });
  });

  it('coerces string auth TTL bindings when issuing and verifying access tokens', async () => {
    const app = createApp();
    const env = {
      ...devEnv(),
      AUTH_ACCESS_TTL_SEC: '900',
      AUTH_REFRESH_IDLE_DAYS: '30',
      AUTH_REFRESH_ABSOLUTE_DAYS: '60',
      DB: createSessionLookupD1({
        id: 'session-1',
        user_id: '2f46400d-5d5b-4ee8-a154-cdb40e64c710',
        refresh_token_hash: 'hash',
        user_agent: null,
        ip_hash: null,
        absolute_expires_at: '2099-01-01T00:00:00.000Z',
        idle_expires_at: '2099-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
        revoked_at: null,
      }) as unknown as D1Database,
    } as unknown as WorkerBindings;
    const access = await signAccessToken(
      getAuthKeyConfig(env),
      {
        userId: '2f46400d-5d5b-4ee8-a154-cdb40e64c710',
        email: 'user@example.com',
        roles: ['user'],
      },
      'session-1',
    );

    const response = await app.request(
      '/api/v1/auth/me',
      {
        headers: {
          Authorization: `Bearer ${access.token}`,
        },
      },
      env,
    );

    expect(response.status).toBe(200);
  });

  it('rejects an access token whose subject does not own the active session', async () => {
    const app = createApp();
    const env = {
      ...devEnv(),
      DB: createSessionLookupD1({
        id: 'session-1',
        user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        refresh_token_hash: 'hash',
        user_agent: null,
        ip_hash: null,
        absolute_expires_at: '2099-01-01T00:00:00.000Z',
        idle_expires_at: '2099-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
        revoked_at: null,
      }) as unknown as D1Database,
    };
    const access = await signAccessToken(
      getAuthKeyConfig(env),
      {
        userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        email: 'user@example.com',
        roles: ['user'],
      },
      'session-1',
    );

    const response = await app.request(
      '/api/v1/auth/me',
      {
        headers: {
          Authorization: `Bearer ${access.token}`,
        },
      },
      env,
    );

    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('unauthorized');
    expect(body.error.message).toBe('Invalid or expired auth token');
  });

  it('returns an operational error when DB session validation throws', async () => {
    const app = createApp();
    const env = {
      ...devEnv(),
      DB: createThrowingD1() as unknown as D1Database,
    };
    const access = await signAccessToken(
      getAuthKeyConfig(env),
      {
        userId: '2f46400d-5d5b-4ee8-a154-cdb40e64c710',
        email: 'user@example.com',
        roles: ['user'],
      },
      'session-1',
    );

    const response = await app.request(
      '/api/v1/auth/me',
      {
        headers: {
          Authorization: `Bearer ${access.token}`,
        },
      },
      env,
    );

    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(500);
    expect(body.error.code).toBe('internal_server_error');
    expect(body.error.message).toBe('Auth session validation failed.');
  });

  it('returns an operational error when auth config is invalid', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/auth/me',
      {
        headers: {
          Authorization: 'Bearer token-value',
        },
      },
      {
        ...devEnv(),
        AUTH_JWT_SECRET: 'too-short',
      },
    );

    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(500);
    expect(body.error.code).toBe('internal_server_error');
    expect(body.error.message).toBe('Auth configuration is invalid.');
  });

  it('rejects an access token when its DB-backed session is revoked', async () => {
    const app = createApp();
    const env = {
      ...devEnv(),
      DB: createSessionLookupD1({
        id: 'session-1',
        user_id: '2f46400d-5d5b-4ee8-a154-cdb40e64c710',
        refresh_token_hash: 'hash',
        user_agent: null,
        ip_hash: null,
        absolute_expires_at: '2099-01-01T00:00:00.000Z',
        idle_expires_at: '2099-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
        revoked_at: '2026-01-02T00:00:00.000Z',
      }) as unknown as D1Database,
    };
    const access = await signAccessToken(
      getAuthKeyConfig(env),
      {
        userId: '2f46400d-5d5b-4ee8-a154-cdb40e64c710',
        email: 'user@example.com',
        roles: ['user'],
      },
      'session-1',
    );

    const response = await app.request(
      '/api/v1/auth/me',
      {
        headers: {
          Authorization: `Bearer ${access.token}`,
        },
      },
      env,
    );

    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('unauthorized');
    expect(body.error.message).toBe('Invalid or expired auth token');
  });
});

function createSessionLookupD1(row: Record<string, unknown> | null) {
  return {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          void values;
          return this;
        },
        async raw() {
          if (!sql.toLowerCase().includes('auth_sessions') || !row) {
            return [];
          }

          return [
            [
              row.id,
              row.user_id,
              row.refresh_token_hash,
              row.user_agent,
              row.ip_hash,
              row.previous_refresh_token_hash ?? null,
              row.previous_refresh_rotated_at ?? null,
              row.absolute_expires_at,
              row.idle_expires_at,
              row.created_at,
              row.revoked_at,
            ],
          ];
        },
        async all() {
          if (!sql.toLowerCase().includes('auth_sessions')) {
            return { results: [] };
          }

          return { results: row ? [row] : [] };
        },
        async first() {
          return row;
        },
        async run() {
          return { success: true, meta: { changes: 0 } };
        },
      };
    },
  };
}

function createThrowingD1() {
  return {
    prepare() {
      return {
        bind() {
          return this;
        },
        async raw() {
          throw new Error('D1 is unavailable');
        },
        async run() {
          throw new Error('D1 is unavailable');
        },
      };
    },
  };
}
