import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import {
  createPasswordUser,
  verifyStoredPasswordForLogin,
  type PasswordUserInsert,
} from '../src/routes/auth';
import type { WorkerBindings } from '../src/env';

function devNoDbEnv(): WorkerBindings {
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
    DB: undefined as unknown as D1Database,
  } as WorkerBindings;
}

describe('auth route hardening', () => {
  it('falls back to non-transactional password user creation when transaction begin fails', async () => {
    const inserts: unknown[] = [];
    const db = {
      async transaction() {
        throw new Error('Failed query: begin');
      },
      insert(table: unknown) {
        inserts.push(table);
        return {
          values() {
            return Promise.resolve();
          },
        };
      },
    };
    const user: PasswordUserInsert = {
      userId: 'user-1',
      email: 'user@example.com',
      displayName: null,
      passwordHash: 'hash',
      now: '2026-01-01T00:00:00.000Z',
    };

    await expect(createPasswordUser(db, user)).resolves.toBeUndefined();
    expect(inserts).toHaveLength(2);
  });

  it('uses dummy password verification for users without credentials', async () => {
    await expect(verifyStoredPasswordForLogin('CorrectHorse1', null)).resolves.toBe(false);
  });

  it('rate limits excessive login attempts before auth persistence work', async () => {
    const app = createApp();
    const request = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.10',
      },
      body: JSON.stringify({
        email: 'rate-limit@example.com',
        password: 'CorrectHorse1',
      }),
    };

    const responses: Response[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) {
      responses.push(await app.request('/api/v1/auth/login', request, devNoDbEnv()));
    }

    const limited = responses.at(-1);
    const body = (await limited?.json()) as { error: { code: string; message: string } };

    expect(limited?.status).toBe(429);
    expect(body.error.code).toBe('rate_limited');
    expect(body.error.message).toBe('Too many auth attempts. Please retry shortly.');
  });

  it('starts Google OAuth with a signed state and authorization URL', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/auth/google/start?returnTo=https%3A%2F%2Fapp.example.test%2Foauth-callback',
      {
        method: 'GET',
        headers: {
          Origin: 'https://app.example.test',
        },
      },
      {
        ...devNoDbEnv(),
        CORS_ORIGIN: 'https://app.example.test',
        GOOGLE_OAUTH_CLIENT_ID: 'google-client-id.apps.googleusercontent.com',
        GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
        GOOGLE_OAUTH_REDIRECT_URI: 'https://api.example.test/api/v1/auth/google/callback',
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { authorizationUrl: string; state: string };
    const authorizationUrl = new URL(body.authorizationUrl);

    expect(authorizationUrl.origin).toBe('https://accounts.google.com');
    expect(authorizationUrl.pathname).toBe('/o/oauth2/v2/auth');
    expect(authorizationUrl.searchParams.get('client_id')).toBe(
      'google-client-id.apps.googleusercontent.com',
    );
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(
      'https://api.example.test/api/v1/auth/google/callback',
    );
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
    expect(authorizationUrl.searchParams.get('scope')).toBe('openid email profile');
    expect(authorizationUrl.searchParams.get('state')).toBe(body.state);
    expect(body.state.length).toBeGreaterThan(40);
  });

  it('rejects OAuth exchange without configured Google credentials', async () => {
    const app = createApp();
    const response = await app.request(
      '/api/v1/auth/oauth/exchange',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'code-1', state: 'state-1' }),
      },
      devNoDbEnv(),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('invalid_request');
    expect(body.error.message).toContain('Google OAuth is not configured');
  });
});
