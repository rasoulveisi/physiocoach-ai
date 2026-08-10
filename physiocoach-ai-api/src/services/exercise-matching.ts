import type { CatalogCandidate } from './workout-generator';

const ABBREVIATIONS: Record<string, string> = {
  db: 'dumbbell',
  dbs: 'dumbbell',
  bb: 'barbell',
  rdl: 'romanian deadlift',
  kb: 'kettlebell',
  kbs: 'kettlebell',
  bw: 'bodyweight',
};

function normalizeName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').map((word) => ABBREVIATIONS[word] ?? word);
  return words.join(' ');
}

export function matchExerciseToCatalog(
  aiName: string,
  candidates: readonly CatalogCandidate[],
): CatalogCandidate | null {
  if (!aiName) return null;
  const target = normalizeName(aiName);
  const targetTokens = target.split(' ');
  const targetSet = new Set(targetTokens);

  // 1. Exact canonical or alias match
  for (const candidate of candidates) {
    if (normalizeName(candidate.name) === target) {
      return candidate;
    }
  }

  // 2. Token-level subset matching (picks the most specific matching candidate)
  let bestSubMatch: CatalogCandidate | null = null;
  let maxMatchTokens = 0;
  let bestSubMatchLength = 0;

  for (const candidate of candidates) {
    const candNorm = normalizeName(candidate.name);
    const candTokens = candNorm.split(' ');
    const candSet = new Set(candTokens);

    const isCandSubset = candTokens.every((token) => targetSet.has(token));
    const isTargetSubset = targetTokens.every((token) => candSet.has(token));

    if (isCandSubset || isTargetSubset) {
      const matchTokensCount = isCandSubset ? candTokens.length : targetTokens.length;
      if (
        matchTokensCount > maxMatchTokens ||
        (matchTokensCount === maxMatchTokens && candNorm.length > bestSubMatchLength)
      ) {
        maxMatchTokens = matchTokensCount;
        bestSubMatchLength = candNorm.length;
        bestSubMatch = candidate;
      }
    }
  }

  if (bestSubMatch) {
    return bestSubMatch;
  }

  // 3. Jaccard similarity word overlap (fallback for partial/fuzzy match)
  let bestMatch: CatalogCandidate | null = null;
  let highestScore = 0;

  for (const candidate of candidates) {
    const candTokens = normalizeName(candidate.name).split(' ');
    const candSet = new Set(candTokens);
    const intersection = new Set([...targetTokens].filter((x) => candSet.has(x)));
    const union = new Set([...targetTokens, ...candTokens]);
    const score = intersection.size / union.size;

    if (score > highestScore) {
      highestScore = score;
      bestMatch = candidate;
    }
  }

  if (highestScore >= 0.5) {
    return bestMatch;
  }

  return null;
}
