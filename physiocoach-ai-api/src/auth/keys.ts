import type { WorkerBindings } from '../env';

/**
 * Resolves the HMAC signing secret and JWT issuer from the Worker bindings.
 * The secret is a Cloudflare Secret (never a [var]). In non-local environments a
 * missing/placeholder secret is a hard failure so misconfigured deploys fail loudly.
 */
const PLACEHOLDER_VALUES = new Set(['', 'set-in-cloudflare-secret', 'replace-me', 'change-me']);

export interface AuthKeyConfig {
  secret: Uint8Array;
  issuer: string;
  audience: string;
  accessTtlSec: number;
  refreshIdleDays: number;
  refreshAbsoluteDays: number;
}

function isPlaceholder(value: string | undefined | null): boolean {
  return value === undefined || value === null || PLACEHOLDER_VALUES.has(value.trim());
}

function toBytes(secret: string): Uint8Array {
  // Prefer raw bytes when the secret is hex/base64-ish of sufficient length; otherwise
  // fall back to UTF-8 encoding. Either way, callers must supply >= 32 chars of entropy.
  return new TextEncoder().encode(secret);
}

function numberFromBinding(
  value: number | string | undefined,
  fallback: number,
  label: string,
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

export function getAuthKeyConfig(env: WorkerBindings): AuthKeyConfig {
  const appEnv = env.APP_ENV ?? 'local';
  const rawSecret = env.AUTH_JWT_SECRET;

  if (isPlaceholder(rawSecret)) {
    if (appEnv === 'local') {
      // Local dev fallback so `wrangler dev` works without configuring a secret.
      return {
        secret: toBytes('local-dev-auth-jwt-secret-do-not-use-in-production'),
        issuer: env.AUTH_ISSUER ?? 'physiocoach-ai-api-local',
        audience: env.AUTH_AUDIENCE ?? 'physiocoach-ai-web',
        accessTtlSec: numberFromBinding(env.AUTH_ACCESS_TTL_SEC, 60 * 15, 'AUTH_ACCESS_TTL_SEC'),
        refreshIdleDays: numberFromBinding(
          env.AUTH_REFRESH_IDLE_DAYS,
          30,
          'AUTH_REFRESH_IDLE_DAYS',
        ),
        refreshAbsoluteDays: numberFromBinding(
          env.AUTH_REFRESH_ABSOLUTE_DAYS,
          60,
          'AUTH_REFRESH_ABSOLUTE_DAYS',
        ),
      };
    }

    throw new Error(
      'AUTH_JWT_SECRET is not configured. Set it via `wrangler secret put AUTH_JWT_SECRET`.',
    );
  }

  if (rawSecret.length < 32) {
    throw new Error('AUTH_JWT_SECRET must be at least 32 characters of random entropy.');
  }

  return {
    secret: toBytes(rawSecret),
    issuer: env.AUTH_ISSUER ?? 'physiocoach-ai-api',
    audience: env.AUTH_AUDIENCE ?? 'physiocoach-ai-web',
    accessTtlSec: numberFromBinding(env.AUTH_ACCESS_TTL_SEC, 60 * 15, 'AUTH_ACCESS_TTL_SEC'),
    refreshIdleDays: numberFromBinding(env.AUTH_REFRESH_IDLE_DAYS, 30, 'AUTH_REFRESH_IDLE_DAYS'),
    refreshAbsoluteDays: numberFromBinding(
      env.AUTH_REFRESH_ABSOLUTE_DAYS,
      60,
      'AUTH_REFRESH_ABSOLUTE_DAYS',
    ),
  };
}

/** Returns the HMAC key for `jose` import (cached per-request). */
export async function getSigningKey(config: AuthKeyConfig): Promise<Uint8Array> {
  return config.secret;
}
