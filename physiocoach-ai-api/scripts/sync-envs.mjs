import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(root, '..');

const ENV_FILES = [
  {
    example: resolve(projectRoot, '.env.dev.example'),
    target: resolve(projectRoot, '.dev.vars'),
    keepBlank: ['OPENROUTER_API_KEY'],
    fallback: 'set-in-cloudflare-secret',
  },
  {
    example: resolve(projectRoot, '.env.production.example'),
    target: resolve(projectRoot, '.prod.vars'),
    keepBlank: ['OPENROUTER_API_KEY'],
    fallback: 'set-in-cloudflare-secret',
  },
];

let updated = false;

for (const { example, target, keepBlank, fallback } of ENV_FILES) {
  const exampleVars = await readEnvFile(example);

  const existingTargetContent = await safeReadFile(target);
  const targetVars = existingTargetContent ? await readEnvFileFromText(existingTargetContent) : {};

  const merged = { ...targetVars };

  for (const [key, value] of Object.entries(exampleVars)) {
    const shouldKeepBlank = keepBlank.includes(key);
    const current = merged[key];

    if (!current && current !== '') {
      merged[key] = key === 'OPENROUTER_API_KEY' || shouldKeepBlank ? fallback : value;
      updated = true;
      continue;
    }

    if (
      key === 'OPENROUTER_API_KEY' &&
      current &&
      current !== fallback &&
      !current.includes('sk-')
    ) {
      merged[key] = fallback;
      updated = true;
    }
  }

  const rendered = serializeEnv(merged);

  if (rendered !== (existingTargetContent ?? '').trim()) {
    await writeFile(target, `${rendered}\n`, 'utf8');
    updated = true;
    console.log(`Updated ${target}`);
  }
}

if (updated) {
  console.log('Env sync completed. Review and commit env updates before deploy.');
} else {
  console.log('Env sync no changes.');
}

function serializeEnv(values) {
  const lines = Object.entries(values)
    .filter((entry) => entry[1] !== undefined)
    .map(([key, value]) => `${key}=${String(value).trim()}`);
  return lines.join('\n');
}

async function readEnvFile(path) {
  const content = await safeReadFile(path);
  return readEnvFileFromText(content ?? '');
}

function readEnvFileFromText(content) {
  const entries = {};

  content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const equalsAt = line.indexOf('=');
      if (equalsAt === -1) return;

      const key = line.slice(0, equalsAt).trim();
      const value = line.slice(equalsAt + 1).trim();
      entries[key] = value;
    });

  return entries;
}

async function safeReadFile(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}
