import type { Context } from 'hono';

import type { WorkerBindings } from '../env';
import { createApiError } from '../shared/errors/api';

const AUTH_WINDOW_MS = 60_000;
const AUTH_MAX_ATTEMPTS = 5;

type AuthRateLimitBucket = {
  count: number;
  resetAt: number;
};

const authBuckets = new Map<string, AuthRateLimitBucket>();

export function checkAuthRateLimit(
  c: Context<{ Bindings: WorkerBindings }>,
  routeKey: string,
): Response | null {
  const now = Date.now();
  const key = `${routeKey}:${getClientKey(c)}`;
  const existing = authBuckets.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : {
          count: 0,
          resetAt: now + AUTH_WINDOW_MS,
        };

  bucket.count += 1;
  authBuckets.set(key, bucket);
  pruneExpiredBuckets(now);

  if (bucket.count <= AUTH_MAX_ATTEMPTS) {
    return null;
  }

  c.header('retry-after', String(Math.ceil((bucket.resetAt - now) / 1000)));
  return createApiError(c, 'rate_limited', 'Too many auth attempts. Please retry shortly.');
}

function getClientKey(c: Context<{ Bindings: WorkerBindings }>): string {
  const cfConnectingIp = c.req.header('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  const realIp = c.req.header('x-real-ip');
  return realIp?.trim() || 'unknown';
}

function pruneExpiredBuckets(now: number): void {
  if (authBuckets.size < 1_000) {
    return;
  }

  for (const [key, bucket] of authBuckets) {
    if (bucket.resetAt <= now) {
      authBuckets.delete(key);
    }
  }
}
