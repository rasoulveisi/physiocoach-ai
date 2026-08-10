import type { WorkoutPlanConsideration } from '../types/ai';
import type {
  CandidateClusterResult,
  CandidateSafetyRating,
  CatalogCandidate,
} from '../types/workout-generator';

const ratingRank: Record<CandidateSafetyRating, number> = {
  recommended: 0,
  caution: 1,
  avoid: 2,
};

function uniqueNonEmpty(values: readonly (string | undefined)[]): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean))) as string[];
}

/**
 * Applies the exact severity cells selected by a user and partitions catalog exercises by their
 * most restrictive matched rating. Missing cells are intentionally ignored: activation guarantees
 * the complete matrix for active catalogs, while injected test candidates can be unrated.
 */
export function clusterExerciseCandidates(
  candidates: readonly CatalogCandidate[],
  considerations: readonly WorkoutPlanConsideration[],
): CandidateClusterResult {
  const exactCells = new Set(considerations.map(({ code, severity }) => `${code}:${severity}`));
  const green: CatalogCandidate[] = [];
  const amber: CatalogCandidate[] = [];
  const red: CatalogCandidate[] = [];
  const exclusions: CandidateClusterResult['exclusions'][number][] = [];

  for (const candidate of candidates) {
    const matchedRatings = (candidate.safetyRatings ?? []).filter((rating) =>
      exactCells.has(`${rating.considerationCode}:${rating.severity}`),
    );
    const strictest = matchedRatings.reduce<CandidateSafetyRating>(
      (current, rating) =>
        ratingRank[rating.rating] > ratingRank[current] ? rating.rating : current,
      'recommended',
    );
    const cautionReasons = uniqueNonEmpty(
      matchedRatings.filter((rating) => rating.rating === 'caution').map((rating) => rating.reason),
    );
    const requiredModifications = uniqueNonEmpty(
      matchedRatings
        .filter((rating) => rating.rating === 'caution')
        .map((rating) => rating.requiredModification),
    );
    const clustered: CatalogCandidate = {
      ...candidate,
      cluster: strictest === 'recommended' ? 'green' : strictest === 'caution' ? 'amber' : 'red',
      ...(cautionReasons.length > 0 ? { cautionReasons } : {}),
      ...(requiredModifications.length > 0 ? { requiredModifications } : {}),
    };

    if (clustered.cluster === 'red') {
      red.push(clustered);
      exclusions.push({
        masterExerciseId: clustered.masterExerciseId,
        reasons: uniqueNonEmpty(matchedRatings.map((rating) => rating.reason)),
      });
    } else if (clustered.cluster === 'amber') {
      amber.push(clustered);
    } else {
      green.push(clustered);
    }
  }

  return { green, amber, red, exclusions };
}
