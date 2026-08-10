/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorkerBindings } from '../../src/env';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const PLACEHOLDER_KEYS = new Set([
  '',
  'replace-with-local-openrouter-key',
  'set-in-cloudflare-secret',
]);

const SECRET_KEY_PATTERN = /(authorization|api_key|apikey|token|secret)/i;
const OPENROUTER_KEY_PATTERN = /sk-or-[A-Za-z0-9_-]+/g;
const VALID_OPENROUTER_KEY_PATTERN = /^sk-or-[A-Za-z0-9_-]+$/;
const REDACTED = '[REDACTED]';
const DEFAULT_OPENROUTER_INTEGRATION_TIMEOUT_MS = 180_000;

export function loadOpenRouterIntegrationEnv(): Partial<WorkerBindings> {
  const fileEnv = {
    ...readEnvFile('.env.dev'),
    ...readEnvFile('.env'),
  };
  const merged = {
    ...fileEnv,
    ...process.env,
  };

  const apiKey = String(merged.OPENROUTER_API_KEY ?? '').trim();
  if (PLACEHOLDER_KEYS.has(apiKey) || !VALID_OPENROUTER_KEY_PATTERN.test(apiKey)) {
    throw new Error(
      [
        'OpenRouter integration setup error: OPENROUTER_API_KEY is missing or still set to a placeholder.',
        'Set OPENROUTER_API_KEY in the shell environment or physiocoach-ai-api/.env.dev before running:',
        'pnpm test:generate:openrouter',
      ].join(' '),
    );
  }

  return {
    APP_ENV: 'local',
    OPENROUTER_API_KEY: apiKey,
    OPENROUTER_BASE_URL: String(merged.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1'),
    OPENROUTER_REFERER: String(merged.OPENROUTER_REFERER ?? 'http://localhost:4200'),
    OPENROUTER_TITLE: String(merged.OPENROUTER_TITLE ?? 'PhysioCoach AI Integration Test'),
    WORKOUT_MODEL_PRIMARY: String(
      merged.WORKOUT_MODEL_PRIMARY ?? 'nvidia/nemotron-3-nano-30b-a3b:free',
    ),
    WORKOUT_MODEL_FALLBACKS: String(merged.WORKOUT_MODEL_FALLBACKS ?? 'openrouter/owl-alpha'),
    OPENROUTER_TIMEOUT_MS: resolveIntegrationTimeoutMs(merged.OPENROUTER_TIMEOUT_MS),
    OPENROUTER_MAX_RETRIES: Number(merged.OPENROUTER_MAX_RETRIES ?? '0'),
    CORS_ORIGIN: String(merged.CORS_ORIGIN ?? 'http://localhost:4200'),
  };
}

function resolveIntegrationTimeoutMs(value: unknown): number {
  const parsed = Number(value ?? DEFAULT_OPENROUTER_INTEGRATION_TIMEOUT_MS);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_OPENROUTER_INTEGRATION_TIMEOUT_MS;
  }

  return Math.max(parsed, DEFAULT_OPENROUTER_INTEGRATION_TIMEOUT_MS);
}

export function redactSecrets(value: unknown): unknown {
  return redactSecretsValue(value, new WeakSet<object>());
}

function readEnvFile(fileName: string): Record<string, string> {
  const filePath = resolve(PACKAGE_ROOT, fileName);
  if (!existsSync(filePath)) {
    return {};
  }

  const env: Record<string, string> = {};
  for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalized = line.startsWith('export ') ? line.slice('export '.length).trimStart() : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    env[key] = parseEnvValue(normalized.slice(separatorIndex + 1).trim());
  }

  return env;
}

function parseEnvValue(value: string): string {
  if (value.length >= 1) {
    const quote = value[0];
    if (quote === '"' || quote === "'") {
      const closingQuoteIndex = value.indexOf(quote, 1);
      if (closingQuoteIndex !== -1) {
        return value.slice(1, closingQuoteIndex);
      }
    }
  }

  const commentIndex = value.search(/\s#/);
  return commentIndex === -1 ? value : value.slice(0, commentIndex).trimEnd();
}

function redactSecretsValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') {
    return value.replace(OPENROUTER_KEY_PATTERN, REDACTED);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSecretsValue(item, seen));
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    redacted[key] = SECRET_KEY_PATTERN.test(key) ? REDACTED : redactSecretsValue(nestedValue, seen);
  }

  return redacted;
}
