import { z } from 'zod';
import type { AuthenticatedUser } from './types/auth';

export const envSchema = z.object({
  APP_ENV: z.enum(['local', 'dev', 'production']),
  AUTH_JWT_SECRET: z.string().min(1),
  AUTH_ISSUER: z.string().min(1).default('physiocoach-ai-api'),
  AUTH_AUDIENCE: z.string().min(1).default('physiocoach-ai-web'),
  AUTH_ACCESS_TTL_SEC: z.coerce.number().int().min(60).max(86_400).default(900),
  AUTH_REFRESH_IDLE_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  AUTH_REFRESH_ABSOLUTE_DAYS: z.coerce.number().int().min(1).max(730).default(60),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_REFERER: z.string().url().default('https://physiocoach.otconnect.ir'),
  OPENROUTER_TITLE: z.string().min(1).default('PhysioCoach AI'),
  WORKOUT_MODEL_PRIMARY: z.string().min(1),
  WORKOUT_MODEL_FALLBACKS: z.string().default(''),
  OPENROUTER_TIMEOUT_MS: z.coerce.number().int().min(1).max(180_000).default(180000),
  OPENROUTER_MAX_RETRIES: z.coerce.number().int().min(0).max(0).default(0),
  CORS_ORIGIN: z.string().min(1),
  DATABASE_URL: z.string().optional(),
  LOCAL_AUTH_BYPASS_TOKEN: z.string().optional(),
  DEV_SWAGGER_TOKEN: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export type WorkerBindings = AppEnv & {
  HYPERDRIVE?: { connectionString: string };
  DATABASE_URL?: string;
  DB?: unknown;
};

export interface AppVariables {
  requestId: string;
  authUser?: AuthenticatedUser;
  authSessionId?: string;
}

export function parseEnv(input: Record<string, unknown>): AppEnv {
  return envSchema.parse(input);
}
