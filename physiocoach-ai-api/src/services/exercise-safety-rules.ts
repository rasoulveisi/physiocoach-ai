export interface ExerciseAttributeInput {
  movementPattern?: string | null;
  bodyRegion?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  equipmentRequired?: string[];
}

export interface DerivedExerciseAttributes {
  movementPattern: string;
  bodyRegion: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipmentRequired: string[];
  behindNeck?: boolean;
  impactLevel?: string;
  loadedRegions?: string[];
  deepFlexion?: boolean;
  spinalLoad?: string;
  explosive?: boolean;
  technicalComplexity?: string;
  overhead?: boolean;
  balanceDemand?: string;
}

export type Suitability = 'recommended' | 'caution' | 'avoid';
export type Severity = 'mild' | 'moderate' | 'severe';

export interface DeterministicSafetyRating {
  considerationCode: string;
  severity: Severity;
  rating: Suitability;
  reason: string;
  ruleCodes: string[];
}

export interface DeterministicSafetyResult {
  ratings: DeterministicSafetyRating[];
  ruleCodes: string[];
  reasons: string[];
}

const SEVERITIES: readonly Severity[] = ['mild', 'moderate', 'severe'];
const rank: Record<Suitability, number> = { recommended: 0, caution: 1, avoid: 2 };

/** Combines safety decisions without allowing AI or missing analysis to weaken a restriction. */
export function mergeSuitability(
  rule: Suitability | undefined | null,
  ai: Suitability | undefined | null,
): Suitability {
  if (!rule || !ai) return 'avoid';
  return rank[rule] >= rank[ai] ? rule : ai;
}

function addRule(
  ratings: Map<string, DeterministicSafetyRating>,
  considerationCode: string,
  ruleCode: string,
  reason: string,
  levels: readonly Suitability[],
): void {
  SEVERITIES.forEach((severity, index) => {
    const key = `${considerationCode}:${severity}`;
    const existing = ratings.get(key);
    const rating = levels[index]!;
    if (!existing || rank[rating] > rank[existing.rating]) {
      ratings.set(key, { considerationCode, severity, rating, reason, ruleCodes: [ruleCode] });
      return;
    }
    if (rank[rating] === rank[existing.rating]) {
      existing.ruleCodes = [...new Set([...existing.ruleCodes, ruleCode])].sort();
      if (!existing.reason.includes(reason)) existing.reason = `${existing.reason} ${reason}`;
    }
  });
}

/**
 * Applies hard minimum restrictions. It deliberately emits only identified risks;
 * unclassified/missing cells remain unsafe until offline safety analysis completes.
 */
export function applyDeterministicSafetyRules(
  _exercise: ExerciseAttributeInput,
  attributes: DerivedExerciseAttributes,
): DeterministicSafetyResult {
  const ratings = new Map<string, DeterministicSafetyRating>();

  if (attributes.behindNeck) {
    addRule(
      ratings,
      'shoulder_pain',
      'behind_neck_position',
      'Behind-neck positioning increases shoulder stress.',
      ['avoid', 'avoid', 'avoid'],
    );
    addRule(
      ratings,
      'neck_pain',
      'behind_neck_position',
      'Behind-neck positioning can aggravate the neck.',
      ['avoid', 'avoid', 'avoid'],
    );
  }
  if (attributes.impactLevel === 'high' && attributes.loadedRegions?.includes('knee')) {
    addRule(
      ratings,
      'knee_pain',
      'high_impact_landing',
      'High-impact landing increases knee loading.',
      ['caution', 'avoid', 'avoid'],
    );
  }
  if (attributes.impactLevel === 'high') {
    addRule(
      ratings,
      'high_impact_intolerance',
      'high_impact_landing',
      'High-impact landing is unsuitable for impact intolerance.',
      ['caution', 'avoid', 'avoid'],
    );
    addRule(
      ratings,
      'ankle_foot_pain',
      'high_impact_landing',
      'High-impact landing increases ankle and foot loading.',
      ['caution', 'avoid', 'avoid'],
    );
  }
  if (attributes.deepFlexion && attributes.loadedRegions?.includes('knee')) {
    addRule(
      ratings,
      'knee_pain',
      'deep_loaded_knee_flexion',
      'Deep loaded knee flexion increases knee demand.',
      ['caution', 'avoid', 'avoid'],
    );
  }
  if (attributes.spinalLoad === 'high') {
    addRule(
      ratings,
      'lower_back_pain',
      'high_spinal_load',
      'High spinal loading can aggravate lower-back pain.',
      ['caution', 'avoid', 'avoid'],
    );
  }
  if (attributes.explosive && attributes.technicalComplexity === 'advanced') {
    addRule(
      ratings,
      'lower_back_pain',
      'advanced_ballistic_lift',
      'Advanced ballistic lifting has elevated spinal and technique demands.',
      ['caution', 'avoid', 'avoid'],
    );
    addRule(
      ratings,
      'shoulder_pain',
      'advanced_ballistic_lift',
      'Advanced ballistic lifting has elevated shoulder demand.',
      ['caution', 'avoid', 'avoid'],
    );
  }
  if (attributes.overhead && attributes.balanceDemand === 'high') {
    addRule(
      ratings,
      'shoulder_pain',
      'unstable_overhead_work',
      'Unstable overhead loading increases shoulder risk.',
      ['caution', 'avoid', 'avoid'],
    );
    addRule(
      ratings,
      'balance_limitation',
      'unstable_overhead_work',
      'This exercise requires substantial balance while overhead.',
      ['caution', 'avoid', 'avoid'],
    );
  }

  const sortedRatings = [...ratings.values()].sort(
    (left, right) =>
      left.considerationCode.localeCompare(right.considerationCode) ||
      SEVERITIES.indexOf(left.severity) - SEVERITIES.indexOf(right.severity),
  );
  return {
    ratings: sortedRatings,
    ruleCodes: [...new Set(sortedRatings.flatMap((rating) => rating.ruleCodes))].sort(),
    reasons: [...new Set(sortedRatings.map((rating) => rating.reason))],
  };
}
