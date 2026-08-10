import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outputPath = resolve(root, 'public/config.js');

const defaultEnvironment = detectDefaultEnvironment(process.env);
const resolvedEnvironment = normalizeEnvironment(
  readValue(process.env, 'NG_APP_ENV', defaultEnvironment),
);

const fileEnvPath = selectInputEnvFile(resolvedEnvironment, process.env.CF_PAGES);
const fileEnv = fileEnvPath ? await readEnvFile(resolve(root, fileEnvPath)) : {};
const mergedEnv = { ...fileEnv, ...process.env };

const apiUrl = pickApiBaseUrl(mergedEnv, resolvedEnvironment);

const config = {
  apiUrl,
  environment: resolvedEnvironment,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, formatRuntimeConfig(config));

async function readEnvFile(path) {
  try {
    const raw = await readFile(path, 'utf8');
    return Object.fromEntries(
      raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const separatorIndex = line.indexOf('=');
          if (separatorIndex === -1) return [line, ''];
          return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
        }),
    );
  } catch {
    return {};
  }
}

function readValue(env, key, fallback) {
  const value = env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function readValueFromAliases(env, keys, fallback = '') {
  for (const key of keys) {
    const value = env[key];
    if (typeof value !== 'string') {
      continue;
    }
    const normalized = value.trim();
    if (!normalized || isPlaceholderKey(normalized)) {
      continue;
    }
    return normalized;
  }

  return typeof fallback === 'string' && fallback.trim() ? fallback.trim() : fallback;
}

function pickApiBaseUrl(env, environment) {
  const apiUrl = readValueFromAliases(env, [
    'NG_APP_API_BASE_URL',
    `CF_PAGES_API_BASE_URL_${environment === 'production' ? 'PROD' : 'DEV'}`,
    'CF_PAGES_API_BASE_URL',
  ], defaultApiUrl(environment));

  if (typeof apiUrl === 'string' && apiUrl) {
    return apiUrl;
  }

  throw new Error('NG_APP_API_BASE_URL must be set');
}

function isPlaceholderKey(value) {
  const lower = value.toLowerCase();
  return (
    lower.includes('replace') ||
    lower.includes('your-key') ||
    lower.includes('xxxx') ||
    lower === 'xxxx'
  );
}

function normalizeEnvironment(value) {
  if (value === 'dev') return 'development';
  if (['local', 'development', 'staging', 'production'].includes(value)) return value;
  return 'local';
}

function selectInputEnvFile(requestedEnv, isCloudflarePages) {
  if (isCloudflarePages) return null;

  const environment = normalizeEnvironment(requestedEnv ?? '');
  switch (environment) {
    case 'production':
      return '.env.production';
    case 'development':
      return '.env.dev';
    default:
      return '.env';
  }
}

function detectDefaultEnvironment(env) {
  // 1. Cloudflare Pages detection
  if (env.CF_PAGES) {
    if (env.CF_PAGES_BRANCH === 'prod' || env.CF_PAGES_BRANCH === 'main') {
      return 'production';
    }
    return 'development';
  }

  // 2. Generic CI fallback
  if (env.CI) {
    return 'production';
  }

  return 'local';
}

function defaultApiUrl(environment) {
  if (environment === 'production') {
    return 'https://physiocoach-ai-api.otconnect.ir/api/v1';
  }

  if (environment === 'development') {
    return 'https://physiocoach-ai-api-dev.otconnect.ir/api/v1';
  }

  return 'http://localhost:8787/api/v1';
}

function formatRuntimeConfig({ apiUrl, environment }) {
  return [
    'window.__PHYSIOCOACH_CONFIG__ = {',
    `  apiUrl: ${JSON.stringify(apiUrl)},`,
    `  environment: ${JSON.stringify(environment)},`,
    '};',
    '',
  ].join('\n');
}
