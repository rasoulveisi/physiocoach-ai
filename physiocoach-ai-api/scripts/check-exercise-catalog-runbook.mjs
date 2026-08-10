import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';

const runbookPath = resolve(
  fileURLToPath(new URL('../docs/exercise-catalog-operations.md', import.meta.url)),
);

export async function validateExerciseCatalogRunbook() {
  const text = await readFile(runbookPath, 'utf8');
  const required = [
    'CATALOG_ID="$(node -p',
    'OPENROUTER_API_KEY:?Set OPENROUTER_API_KEY before production safety analysis.',
    '--provider=openrouter',
    'API_SMOKE_ACTIVE_CATALOG_ID="$CATALOG_ID"',
    'encodeURIComponent(process.argv[1])',
    '/duplicate-reviews/$NORMALIZED_NAME_ENCODED/resolve',
    'PATCH -H "Authorization: Bearer $AUTH_ACCESS_TOKEN"',
    '/admin/exercises/$EXERCISE_ID/safety',
    `"analysisVersion":"'$ANALYSIS_VERSION'"`,
  ];
  const missing = required.filter((snippet) => !text.includes(snippet));
  if (!hasValidShellSyntax(text)) missing.push('valid shell syntax');
  return missing;
}

function hasValidShellSyntax(text) {
  const bashBlocks = [...text.matchAll(/```bash\n([\s\S]*?)```/g)].map((match) => match[1]);
  try {
    for (const block of bashBlocks) execFileSync('zsh', ['-n'], { input: block, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const missing = await validateExerciseCatalogRunbook();
  if (missing.length) {
    console.error(`Exercise catalog runbook is missing: ${missing.join(', ')}`);
    process.exitCode = 1;
  }
}
