import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { parseEnv } from '../src/env';

const requiredEnv = {
  APP_ENV: 'local',
  AUTH_JWT_SECRET: 'test-auth-secret-with-at-least-32-bytes',
  AUTH_ISSUER: 'physiocoach-ai-api-test',
  AUTH_AUDIENCE: 'physiocoach-ai-web-test',
  AUTH_ACCESS_TTL_SEC: '900',
  AUTH_REFRESH_IDLE_DAYS: '30',
  AUTH_REFRESH_ABSOLUTE_DAYS: '60',
  OPENROUTER_API_KEY: 'test-openrouter-key',
  WORKOUT_MODEL_PRIMARY: 'openrouter/model-primary',
  CORS_ORIGIN: 'https://app.example.com',
};

describe('parseEnv', () => {
  it('applies defaults for optional OpenRouter settings', () => {
    const env = parseEnv(requiredEnv);

    expect(env.OPENROUTER_BASE_URL).toBe('https://openrouter.ai/api/v1');
    expect(env.WORKOUT_MODEL_FALLBACKS).toBe('');
    expect(env.OPENROUTER_TIMEOUT_MS).toBe(180000);
    expect(env.OPENROUTER_MAX_RETRIES).toBe(0);
  });

  it('uses first-party auth issuer settings', () => {
    const env = parseEnv(requiredEnv);

    expect(env.AUTH_ISSUER).toBe('physiocoach-ai-api-test');
    expect(env.AUTH_AUDIENCE).toBe('physiocoach-ai-web-test');
  });

  it('coerces numeric OpenRouter settings from strings', () => {
    const env = parseEnv({
      ...requiredEnv,
      OPENROUTER_TIMEOUT_MS: '15000',
      OPENROUTER_MAX_RETRIES: '0',
    });

    expect(env.OPENROUTER_TIMEOUT_MS).toBe(15000);
    expect(env.OPENROUTER_MAX_RETRIES).toBe(0);
  });

  it('rejects a zero OpenRouter timeout', () => {
    expect(() =>
      parseEnv({
        ...requiredEnv,
        OPENROUTER_TIMEOUT_MS: '0',
      }),
    ).toThrow(ZodError);
  });

  it('rejects non-zero max retries because runtime retries are locked at 0', () => {
    expect(() =>
      parseEnv({
        ...requiredEnv,
        OPENROUTER_MAX_RETRIES: '1',
      }),
    ).toThrow(ZodError);
  });

  it('accepts the configured max timeout', () => {
    const env = parseEnv({
      ...requiredEnv,
      OPENROUTER_TIMEOUT_MS: '180000',
      OPENROUTER_MAX_RETRIES: '0',
    });

    expect(env.OPENROUTER_TIMEOUT_MS).toBe(180_000);
  });

  it('rejects invalid URLs', () => {
    expect(() =>
      parseEnv({
        ...requiredEnv,
        OPENROUTER_BASE_URL: 'not-a-url',
      }),
    ).toThrow(ZodError);
  });

  it('rejects retry counts outside the allowed bounds', () => {
    expect(() =>
      parseEnv({
        ...requiredEnv,
        OPENROUTER_MAX_RETRIES: '3',
      }),
    ).toThrow(ZodError);
  });
});
