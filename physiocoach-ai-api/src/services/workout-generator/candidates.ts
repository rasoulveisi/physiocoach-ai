import { and, eq, or } from 'drizzle-orm';
import { createDb } from '../../db/client';
import {
  exerciseEquipment,
  exerciseMuscles,
  exerciseCatalogVersions,
  exerciseConsiderationRatings,
  exerciseSafetyProfiles,
  bodyConsiderations,
  masterExercises,
  masterEquipment,
  masterMuscles,
} from '../../db/schema';
import { WORKOUT_PLAN_MOVEMENT_PATTERNS } from '../../types/workout-plan-contract';
import type { WorkoutPlanConsideration, WorkoutPlanGenerationContext } from '../../types/ai';
import type {
  CandidateClusterResult,
  CandidateSafetyRatingCell,
  CatalogCandidate,
} from '../../types/workout-generator';

type DbClient = ReturnType<typeof createDb>;
type WorkoutPlanMovementPattern = (typeof WORKOUT_PLAN_MOVEMENT_PATTERNS)[number];
type ExperienceLevel = WorkoutPlanGenerationContext['experienceLevel'];

export type CandidateBuildResult = {
  candidates: readonly CatalogCandidate[];
  allCandidates: readonly CatalogCandidate[];
  clusters: CandidateClusterResult;
  requiredMovementPatterns: readonly WorkoutPlanMovementPattern[];
  missingSafeMovementPatterns: readonly WorkoutPlanMovementPattern[];
};

type DbCatalogCandidateRow = {
  exerciseId: string | null;
  exerciseCanonicalId: string | null;
  sourceId: string | null;
  exerciseName: string | null;
  movementPattern: string | null;
  equipmentCanonicalId: string | null;
  equipmentName: string | null;
  muscleName: string | null;
  isPrimaryMuscle: boolean | number | null;
  recommendedLevel: string | null;
  goalTagsJson: string | null;
  excludedLimitationsJson: string | null;
  considerationCode: string | null;
  ratingSeverity: string | null;
  safetyRating: string | null;
  safetyReason: string | null;
  requiredModification: string | null;
  ruleCodesJson: string | null;
};

const WORKOUT_PLAN_EXPERIENCE_ORDER: Record<ExperienceLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

const VALID_MOVEMENT_PATTERNS = new Set(WORKOUT_PLAN_MOVEMENT_PATTERNS);

/**
 * Per-pattern candidate caps for balanced multi-pattern sampling so push/pull
 * stay strongly represented alongside squat/hinge instead of being crowded out
 * by a single dominant pattern in the catalog.
 */
const BALANCED_CANDIDATE_QUOTAS: Record<WorkoutPlanMovementPattern, number> = {
  push: 20,
  pull: 20,
  squat: 20,
  hinge: 20,
  lunge: 15,
  carry: 15,
  core: 15,
  mobility: 15,
};

export const BODYWEIGHT_EQUIPMENT_IDS = new Set([
  'bodyweight',
  'body_weight',
  'bodyweight_exercise',
  'none_bodyweight_exercise',
  'n_a',
  'none',
]);

export const CATALOG_EQUIPMENT_TOKENS_BY_ASSESSMENT_VALUE: Record<string, readonly string[]> = {
  full_gym: [
    'barbell',
    'bench',
    'dumbbells',
    'dumbbell',
    'cable',
    'cables',
    'machine',
    'bodyweight',
    'body_weight',
    'none_bodyweight_exercise',
    'gym_mat',
    'mat',
  ],
  dumbbells_only: ['dumbbells', 'dumbbell'],
  home_gym: [
    'dumbbells',
    'dumbbell',
    'bench',
    'resistance_band',
    'band',
    'bodyweight',
    'body_weight',
    'none_bodyweight_exercise',
    'gym_mat',
    'mat',
  ],
  resistance_bands: ['resistance_band', 'resistance_bands', 'band', 'bands'],
};

export function normalizeText(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeEquipment(value: string | undefined | null): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}

export function normalizeGoalTag(value: string | undefined | null): string {
  return normalizeText(value).replace(/[\s-]+/g, '_');
}

export function getNormalizedGoals(context: WorkoutPlanGenerationContext): readonly string[] {
  const goals = context.goals && context.goals.length > 0 ? context.goals : [context.goal];
  return Array.from(
    new Set(goals.map((goal) => normalizeGoalTag(goal)).filter((goal) => goal.length > 0)),
  );
}

export function getNormalizedLimitations(context: WorkoutPlanGenerationContext): readonly string[] {
  return Array.from(
    new Set(
      (context.limitations ?? []).map((limitation) => normalizeGoalTag(limitation)).filter(Boolean),
    ),
  );
}

export function getUserEquipmentTokens(context: WorkoutPlanGenerationContext): Set<string> {
  const tokens = new Set<string>();
  tokens.add(normalizeEquipment('bodyweight'));
  tokens.add(normalizeEquipment('body_weight'));
  tokens.add(normalizeEquipment('n_a'));

  const explicitBuckets = (context.equipment ?? []).map((value) => normalizeEquipment(value));
  for (const token of explicitBuckets) {
    tokens.add(token);
    const mapped = CATALOG_EQUIPMENT_TOKENS_BY_ASSESSMENT_VALUE[token];
    if (!mapped) {
      continue;
    }
    for (const alias of mapped) {
      tokens.add(normalizeEquipment(alias));
    }
  }

  return tokens;
}

export function getCanonicalEquipmentForCandidate(value: string): string {
  return normalizeEquipment(value);
}

export function parseCandidateStringList(value: string | null | unknown): string[] {
  if (typeof value !== 'string' || value.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => normalizeGoalTag(item))
      .filter((item) => item.length > 0);
  } catch {
    return [];
  }
}

export function parseCandidateSafetyRating(
  row: DbCatalogCandidateRow,
  provisionalNoRuleCautions = false,
): CandidateSafetyRatingCell | undefined {
  if (
    !row.considerationCode ||
    !row.ratingSeverity ||
    !row.safetyRating ||
    !row.safetyReason ||
    !['mild', 'moderate', 'severe'].includes(row.ratingSeverity) ||
    !['recommended', 'caution', 'avoid'].includes(row.safetyRating)
  ) {
    return undefined;
  }

  return {
    considerationCode: row.considerationCode,
    severity: row.ratingSeverity as CandidateSafetyRatingCell['severity'],
    rating:
      provisionalNoRuleCautions && row.safetyRating === 'caution' && row.ruleCodesJson === '[]'
        ? 'recommended'
        : (row.safetyRating as CandidateSafetyRatingCell['rating']),
    reason: row.safetyReason,
    ...(row.requiredModification ? { requiredModification: row.requiredModification } : {}),
  };
}

export function addCandidateSafetyRating(
  ratings: CandidateSafetyRatingCell[],
  rating: CandidateSafetyRatingCell | undefined,
): void {
  if (
    rating &&
    !ratings.some(
      (candidate) =>
        candidate.considerationCode === rating.considerationCode &&
        candidate.severity === rating.severity,
    )
  ) {
    ratings.push(rating);
  }
}

export function parseCatalogExperienceLevel(
  value: string | null | undefined,
): ExperienceLevel | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = normalizeGoalTag(value);
  return normalized === 'beginner' || normalized === 'intermediate' || normalized === 'advanced'
    ? normalized
    : undefined;
}

export function isCandidateLevelCompatible(
  userLevel: ExperienceLevel,
  candidateRecommendedLevel: ExperienceLevel | undefined,
): boolean {
  if (!candidateRecommendedLevel) {
    return true;
  }

  return (
    WORKOUT_PLAN_EXPERIENCE_ORDER[userLevel] >=
    WORKOUT_PLAN_EXPERIENCE_ORDER[candidateRecommendedLevel]
  );
}

const DEFAULT_MOVEMENT_PATTERN_NEEDS: readonly WorkoutPlanMovementPattern[] = [
  'push',
  'pull',
  'squat',
  'hinge',
  'lunge',
  'core',
  'mobility',
];

export function deriveMovementPatternNeeds(): WorkoutPlanMovementPattern[] {
  // Every fundamental resistance training movement pattern is required for all
  // plans so candidate selection stays balanced across upper/lower/core days.
  return WORKOUT_PLAN_MOVEMENT_PATTERNS.filter((pattern) =>
    DEFAULT_MOVEMENT_PATTERN_NEEDS.includes(pattern),
  );
}

export function buildCandidateExerciseSet(
  context: WorkoutPlanGenerationContext,
  catalogCandidates: readonly CatalogCandidate[],
): CandidateBuildResult {
  const normalizedGoals = new Set(getNormalizedGoals(context));
  const normalizedLimitations = new Set(
    getNormalizedLimitations(context).map((value) => normalizeGoalTag(value)),
  );
  const userEquipment = getUserEquipmentTokens(context);

  const movementNeeds = deriveMovementPatternNeeds();

  const baseFiltered = catalogCandidates.filter((candidate) => {
    if (!isCandidateLevelCompatible(context.experienceLevel, candidate.recommendedLevel)) {
      return false;
    }

    const equipmentMatches = candidate.allowedEquipment.some((equipment) => {
      const normalizedCandidateEquipment = getCanonicalEquipmentForCandidate(equipment);
      if (BODYWEIGHT_EQUIPMENT_IDS.has(normalizedCandidateEquipment)) {
        return true;
      }
      return userEquipment.has(normalizedCandidateEquipment);
    });

    if (!equipmentMatches) {
      return false;
    }

    if (
      candidate.excludedLimitations?.some((limitation) =>
        normalizedLimitations.has(normalizeGoalTag(limitation)),
      )
    ) {
      return false;
    }

    return true;
  });

  const green: CatalogCandidate[] = [];
  const amber: CatalogCandidate[] = [];
  const red: CatalogCandidate[] = [];

  for (const candidate of baseFiltered) {
    if (candidate.cluster === 'red') {
      red.push(candidate);
    } else if (candidate.cluster === 'amber') {
      amber.push(candidate);
    } else {
      green.push({ ...candidate, cluster: candidate.cluster ?? 'green' });
    }
  }

  const clusters = { green, amber, red, exclusions: [] };
  const safeCandidates = [...green, ...amber];
  const missingSafeMovementPatterns = movementNeeds.filter(
    (pattern) => !safeCandidates.some((candidate) => candidate.movementPattern === pattern),
  );
  const availableRequiredPatterns = movementNeeds.filter((pattern) =>
    safeCandidates.some((candidate) => candidate.movementPattern === pattern),
  );
  const availableRequiredSet = new Set(availableRequiredPatterns);

  const compareSafeCandidates = (left: CatalogCandidate, right: CatalogCandidate): number => {
    const leftClusterOrder = left.cluster === 'green' ? 0 : 1;
    const rightClusterOrder = right.cluster === 'green' ? 0 : 1;
    if (leftClusterOrder !== rightClusterOrder) {
      return leftClusterOrder - rightClusterOrder;
    }

    const leftIsRequired = availableRequiredSet.has(left.movementPattern);
    const rightIsRequired = availableRequiredSet.has(right.movementPattern);
    if (leftIsRequired !== rightIsRequired) {
      return leftIsRequired ? -1 : 1;
    }

    const leftGoalMatched = left.goalTags?.some((goal) =>
      normalizedGoals.has(normalizeGoalTag(goal)),
    )
      ? 0
      : 1;
    const rightGoalMatched = right.goalTags?.some((goal) =>
      normalizedGoals.has(normalizeGoalTag(goal)),
    )
      ? 0
      : 1;
    if (leftGoalMatched !== rightGoalMatched) {
      return leftGoalMatched - rightGoalMatched;
    }

    return left.name.localeCompare(right.name);
  };

  // Balanced multi-pattern sampling: rank safe candidates within each movement
  // pattern, cap each pattern at its quota, then round-robin interleave the
  // per-pattern queues. Every movement pattern keeps strong representation in
  // the output instead of one dominant pattern starving the others once
  // downstream code takes a slice from the head of the array.
  const patternQueues = WORKOUT_PLAN_MOVEMENT_PATTERNS.map((pattern) => ({
    pattern,
    cursor: 0,
    candidates: safeCandidates
      .filter((candidate) => candidate.movementPattern === pattern)
      .sort(compareSafeCandidates)
      .slice(0, BALANCED_CANDIDATE_QUOTAS[pattern]),
  })).filter((queue) => queue.candidates.length > 0);

  const interleavedCandidates: CatalogCandidate[] = [];
  let consumedCandidateInPass = true;
  while (consumedCandidateInPass) {
    consumedCandidateInPass = false;
    for (const queue of patternQueues) {
      const nextCandidate = queue.candidates[queue.cursor];
      if (!nextCandidate) {
        continue;
      }
      interleavedCandidates.push(nextCandidate);
      queue.cursor += 1;
      consumedCandidateInPass = true;
    }
  }

  return {
    candidates: interleavedCandidates,
    allCandidates: [...clusters.green, ...clusters.amber, ...clusters.red],
    clusters,
    requiredMovementPatterns: movementNeeds,
    missingSafeMovementPatterns,
  };
}

export async function loadCatalogCandidatesFromDb(
  db: DbClient,
  considerations: readonly WorkoutPlanConsideration[] = [],
  provisionalNoRuleCautions = false,
): Promise<readonly CatalogCandidate[]> {
  const exactSeverityConditions = considerations.map(({ code, severity }) =>
    and(
      eq(exerciseConsiderationRatings.considerationId, `bc_${code}`),
      eq(exerciseConsiderationRatings.severity, severity),
    ),
  );
  const exactSafetyCondition =
    exactSeverityConditions.length > 0
      ? or(...exactSeverityConditions)!
      : eq(exerciseConsiderationRatings.severity, '__no_selected_considerations__');
  const dbRows = (await db
    .select({
      exerciseId: masterExercises.id,
      exerciseCanonicalId: masterExercises.canonicalId,
      sourceId: masterExercises.sourceId,
      exerciseName: masterExercises.name,
      movementPattern: masterExercises.movementPattern,
      equipmentName: masterEquipment.name,
      equipmentCanonicalId: masterEquipment.canonicalId,
      muscleName: masterMuscles.name,
      isPrimaryMuscle: exerciseMuscles.isPrimary,
      recommendedLevel: masterExercises.recommendedLevel,
      goalTagsJson: masterExercises.goalTagsJson,
      excludedLimitationsJson: masterExercises.excludedLimitationsJson,
      considerationCode: bodyConsiderations.code,
      ratingSeverity: exerciseConsiderationRatings.severity,
      safetyRating: exerciseConsiderationRatings.rating,
      safetyReason: exerciseConsiderationRatings.reason,
      requiredModification: exerciseConsiderationRatings.requiredModification,
      ruleCodesJson: exerciseConsiderationRatings.ruleCodesJson,
    })
    .from(masterExercises)
    .innerJoin(
      exerciseCatalogVersions,
      and(
        eq(masterExercises.catalogVersionId, exerciseCatalogVersions.id),
        eq(exerciseCatalogVersions.status, 'active'),
      ),
    )
    .innerJoin(
      exerciseSafetyProfiles,
      and(
        eq(exerciseSafetyProfiles.exerciseId, masterExercises.id),
        eq(exerciseSafetyProfiles.analysisVersion, exerciseCatalogVersions.analysisVersion),
        eq(exerciseSafetyProfiles.reviewStatus, 'approved'),
        eq(exerciseSafetyProfiles.coverageComplete, true),
      ),
    )
    .leftJoin(exerciseEquipment, eq(exerciseEquipment.exerciseId, masterExercises.id))
    .leftJoin(masterEquipment, eq(exerciseEquipment.equipmentId, masterEquipment.id))
    .leftJoin(exerciseMuscles, eq(exerciseMuscles.exerciseId, masterExercises.id))
    .leftJoin(masterMuscles, eq(exerciseMuscles.muscleId, masterMuscles.id))
    .leftJoin(
      exerciseConsiderationRatings,
      and(
        eq(exerciseConsiderationRatings.exerciseId, masterExercises.id),
        eq(exerciseConsiderationRatings.analysisVersion, exerciseCatalogVersions.analysisVersion),
        exactSafetyCondition,
      ),
    )
    .leftJoin(
      bodyConsiderations,
      and(
        eq(bodyConsiderations.id, exerciseConsiderationRatings.considerationId),
        eq(bodyConsiderations.active, true),
      ),
    )) as DbCatalogCandidateRow[];

  const candidatesById = new Map<
    string,
    {
      masterExerciseId: string;
      sourceId?: string;
      name: string;
      movementPattern: WorkoutPlanMovementPattern;
      allowedEquipment: Set<string>;
      recommendedLevel?: ExperienceLevel;
      goalTags: string[];
      excludedLimitations: string[];
      primaryMuscleGroup?: string;
      safetyRatings: CandidateSafetyRatingCell[];
    }
  >();

  for (const row of dbRows) {
    if (!row.exerciseId || !row.exerciseCanonicalId) {
      continue;
    }

    const movementPattern = row.movementPattern;
    if (
      !movementPattern ||
      !VALID_MOVEMENT_PATTERNS.has(movementPattern as WorkoutPlanMovementPattern)
    ) {
      continue;
    }

    const name = (row.exerciseName ?? '').trim();
    if (!name) {
      continue;
    }

    const candidate = candidatesById.get(row.exerciseCanonicalId);
    if (candidate) {
      candidate.allowedEquipment.add(normalizeEquipment(row.equipmentName ?? ''));
      candidate.allowedEquipment.add(normalizeEquipment(row.equipmentCanonicalId ?? ''));
      if (!candidate.goalTags.length && row.goalTagsJson) {
        candidate.goalTags = parseCandidateStringList(row.goalTagsJson);
      }
      if (!candidate.excludedLimitations.length && row.excludedLimitationsJson) {
        candidate.excludedLimitations = parseCandidateStringList(row.excludedLimitationsJson);
      }
      if (!candidate.recommendedLevel && row.recommendedLevel) {
        const parsed = parseCatalogExperienceLevel(row.recommendedLevel);
        if (parsed !== undefined) {
          candidate.recommendedLevel = parsed;
        }
      }
      if (!candidate.primaryMuscleGroup && Boolean(row.isPrimaryMuscle) && row.muscleName) {
        candidate.primaryMuscleGroup = row.muscleName;
      }
      addCandidateSafetyRating(
        candidate.safetyRatings,
        parseCandidateSafetyRating(row, provisionalNoRuleCautions),
      );
      continue;
    }

    const allowedEquipment = new Set<string>();
    allowedEquipment.add(normalizeEquipment(row.equipmentName ?? ''));
    allowedEquipment.add(normalizeEquipment(row.equipmentCanonicalId ?? ''));
    const maxLevel = parseCatalogExperienceLevel(row.recommendedLevel);

    const dbCandidate: {
      masterExerciseId: string;
      sourceId?: string;
      name: string;
      movementPattern: WorkoutPlanMovementPattern;
      allowedEquipment: Set<string>;
      recommendedLevel?: ExperienceLevel;
      goalTags: string[];
      excludedLimitations: string[];
      primaryMuscleGroup?: string;
      safetyRatings: CandidateSafetyRatingCell[];
    } = {
      masterExerciseId: row.exerciseCanonicalId,
      name,
      movementPattern: movementPattern as WorkoutPlanMovementPattern,
      allowedEquipment,
      goalTags: parseCandidateStringList(row.goalTagsJson),
      excludedLimitations: parseCandidateStringList(row.excludedLimitationsJson),
      safetyRatings: [],
      ...(maxLevel ? { recommendedLevel: maxLevel } : {}),
      ...(row.sourceId ? { sourceId: row.sourceId } : {}),
    };
    if (Boolean(row.isPrimaryMuscle) && row.muscleName) {
      dbCandidate.primaryMuscleGroup = row.muscleName;
    }
    addCandidateSafetyRating(
      dbCandidate.safetyRatings,
      parseCandidateSafetyRating(row, provisionalNoRuleCautions),
    );

    candidatesById.set(row.exerciseCanonicalId, dbCandidate);
  }

  const catalogCandidates: CatalogCandidate[] = Array.from(candidatesById.values()).map(
    ({ allowedEquipment, ...candidate }) => ({
      ...candidate,
      allowedEquipment: Array.from(allowedEquipment).filter((value) => value.length > 0),
      ...(candidate.safetyRatings.length > 0 ? { safetyRatings: candidate.safetyRatings } : {}),
    }),
  );

  return catalogCandidates;
}
