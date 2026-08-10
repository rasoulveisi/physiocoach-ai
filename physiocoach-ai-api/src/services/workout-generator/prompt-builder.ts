import type { WorkoutPlanGenerationContext } from '../../types/ai';
import type { CatalogCandidate } from '../../types/workout-generator';
import { WORKOUT_PLAN_MOVEMENT_PATTERNS } from '../../types/workout-plan-contract';

type WorkoutPlanMovementPattern = (typeof WORKOUT_PLAN_MOVEMENT_PATTERNS)[number];
type ExperienceLevel = WorkoutPlanGenerationContext['experienceLevel'];

const TARGET_EXERCISES_PER_DAY = 5;
const MIN_PROMPT_CANDIDATE_MULTIPLIER = 5;
const PREFERRED_PROMPT_CANDIDATE_MULTIPLIER = 6;

export function getPromptCandidateTargets(frequencyDays: number) {
  const finalExerciseCount = frequencyDays * TARGET_EXERCISES_PER_DAY;
  const minimumPromptCandidateCount = finalExerciseCount * MIN_PROMPT_CANDIDATE_MULTIPLIER;
  const preferredPromptCandidateCount = finalExerciseCount * PREFERRED_PROMPT_CANDIDATE_MULTIPLIER;

  return {
    finalExerciseCount,
    minimumPromptCandidateCount,
    preferredPromptCandidateCount,
  };
}

export function getPromptCandidateId(
  candidate: Pick<CatalogCandidate, 'masterExerciseId' | 'sourceId'>,
): string {
  return candidate.sourceId ?? candidate.masterExerciseId;
}

export function getExperiencePlanGuidance(experienceLevel: ExperienceLevel): string {
  switch (experienceLevel) {
    case 'beginner':
      return 'beginner; prioritize skill practice, simple setup, conservative volume, and usually 4-6 exercises per day';
    case 'intermediate':
      return 'intermediate; use moderate volume and complexity, usually 5-7 exercises per day when recovery and focus allow';
    case 'advanced':
      return 'advanced; allow higher complexity or specialization when appropriate, usually 5-8 exercises per day when recovery and focus allow';
  }
}

export function formatSessionDuration(sessionMinutes: number | undefined): string {
  return typeof sessionMinutes === 'number' && Number.isFinite(sessionMinutes) && sessionMinutes > 0
    ? `${sessionMinutes} min`
    : 'not specified';
}

export function groupApprovedExerciseMapByMovement(
  candidates: readonly CatalogCandidate[],
): Record<string, Record<string, string>> {
  return candidates.reduce<Record<string, Record<string, string>>>((grouped, candidate) => {
    const group = grouped[candidate.movementPattern] ?? {};
    group[getPromptCandidateId(candidate)] = candidate.name;
    grouped[candidate.movementPattern] = group;
    return grouped;
  }, {});
}

export function countGroupedApprovedExercises(
  grouped: Record<string, Record<string, string>>,
): number {
  return Object.values(grouped).reduce((total, group) => total + Object.keys(group).length, 0);
}

export function formatAmberCandidates(candidates: readonly CatalogCandidate[]): Array<{
  id: string;
  name: string;
  movement: WorkoutPlanMovementPattern;
  reasons: readonly string[];
  requiredModifications: readonly string[];
}> {
  return candidates
    .filter((candidate) => candidate.cluster === 'amber')
    .map((candidate) => ({
      id: getPromptCandidateId(candidate),
      name: candidate.name,
      movement: candidate.movementPattern,
      reasons: candidate.cautionReasons ?? [],
      requiredModifications: candidate.requiredModifications ?? [],
    }));
}

export function formatList(values: readonly string[] | undefined, fallback: string): string {
  if (!values || values.length === 0) {
    return fallback;
  }

  return values.join(', ');
}

export function normalizePostureFlags(postureFlags: Record<string, unknown> | undefined): string[] {
  if (!postureFlags) {
    return [];
  }

  const postureFlagMap: Record<string, string> = {
    roundedShoulders: 'rounded_shoulders',
    shoulderPain: 'shoulder_pain',
    kneePain: 'knee_pain',
    lowerBackPain: 'lower_back_pain',
    neckPain: 'neck_pain',
    forwardHeadPain: 'forward_head',
    tightHips: 'tight_hips',
    anteriorPelvicTilt: 'anterior_pelvic_tilt',
    lowerBackDiscomfort: 'lower_back_discomfort',
  };

  return Object.entries(postureFlags)
    .filter(([, enabled]) => enabled === true)
    .map(([key]) => postureFlagMap[key] ?? key)
    .sort();
}

export function buildWorkoutPlanPrompt(
  input: WorkoutPlanGenerationContext,
  requiredMovementPatterns: readonly WorkoutPlanMovementPattern[],
  candidates: readonly CatalogCandidate[],
): string {
  const postureFlags = normalizePostureFlags(input.postureFlags as Record<string, unknown>);
  const orderedGoals = input.goals && input.goals.length > 0 ? [...input.goals] : [input.goal];
  const requiredMovementPatternText =
    requiredMovementPatterns.length > 0
      ? requiredMovementPatterns.join(', ')
      : 'balanced full body';

  const rules: string[] = [];
  rules.push(`exactly ${input.frequencyDays} days`);
  rules.push(`no duplicate exercises within a day`);

  const hasRoundedShoulders =
    postureFlags.includes('rounded_shoulders') || postureFlags.includes('roundedShoulders');
  const hasKneePain =
    (input.limitations ?? []).includes('knee_pain') ||
    postureFlags.includes('kneePain') ||
    postureFlags.includes('knee_pain');

  if (input.frequencyDays === 3) {
    const day1Bias = hasRoundedShoulders
      ? 'upper body pull-biased'
      : 'upper body push/pull balanced';
    const day2Bias = hasKneePain ? 'lower body knee-friendly' : 'lower body focus';
    const day3Bias = 'torso & core stability';
    rules.push(`Day 1 ${day1Bias}, Day 2 ${day2Bias}, Day 3 ${day3Bias}`);
  } else if (input.frequencyDays === 2) {
    const day1Bias = hasRoundedShoulders ? 'upper body pull-biased' : 'upper body focus';
    const day2Bias = hasKneePain ? 'lower body knee-friendly' : 'lower body and core focus';
    rules.push(`Day 1 ${day1Bias}, Day 2 ${day2Bias}`);
  } else if (input.frequencyDays === 4) {
    const day1Bias = hasRoundedShoulders ? 'upper body pull-biased' : 'upper body push focus';
    const day2Bias = hasKneePain ? 'lower body knee-friendly' : 'lower body squat/hinge';
    const day3Bias = 'upper body pull/core';
    const day4Bias = 'lower body lunge/lateral stability';
    rules.push(`Day 1 ${day1Bias}, Day 2 ${day2Bias}, Day 3 ${day3Bias}, Day 4 ${day4Bias}`);
  } else {
    if (hasRoundedShoulders) {
      rules.push('upper body sessions must be pull-biased');
    }
    if (hasKneePain) {
      rules.push('lower body sessions must be knee-friendly');
    }
  }

  rules.push(
    'Important: Generate standard, clean, descriptive exercise names that include the equipment used (e.g. "Dumbbell Romanian Deadlift" instead of "RDL", "Barbell Back Squat" instead of "Squat", "Bodyweight Squat" if no weight, etc.) so they can be matched',
  );
  rules.push(`prefer movements ${requiredMovementPatternText}`);
  rules.push('Use catalog ID as masterExerciseId for every exercise');
  rules.push(
    'Prefer green candidates; use at most one amber candidate per day and include its required modification verbatim in notes',
  );
  rules.push(
    `Build a science-based ${getExperiencePlanGuidance(input.experienceLevel)} plan from the available profile`,
  );
  rules.push(
    'Choose the exercise count per day from experience level, goals, weekly frequency, limitations, day focus, setup burden, and recovery',
  );
  rules.push(
    'Candidate count is choice breadth, not target workout size; do not output every candidate or pad with redundant variations',
  );

  const dayIndices = Array.from({ length: input.frequencyDays }, (_, i) => i + 1);
  const dayLabels = dayIndices.map((d) => `Day ${d}`).join(', ');
  rules.push(`${dayLabels} must have 100% distinct movements with zero reuse`);

  const { minimumPromptCandidateCount, preferredPromptCandidateCount } = getPromptCandidateTargets(
    input.frequencyDays,
  );
  const promptCandidateCount = Math.min(candidates.length, preferredPromptCandidateCount);
  const promptCandidates = candidates.slice(0, promptCandidateCount);
  const approvedExerciseMapByMovement = groupApprovedExerciseMapByMovement(
    promptCandidates.filter((candidate) => candidate.cluster !== 'amber'),
  );
  const amberCandidates = formatAmberCandidates(promptCandidates);
  const providedApprovedOptionCount = countGroupedApprovedExercises(approvedExerciseMapByMovement);

  return `Create JSON only.
Profile: goals ${orderedGoals.join(' > ')}; level ${input.experienceLevel}; ${input.frequencyDays} days/week; session duration ${formatSessionDuration(input.sessionMinutes)}; equipment ${formatList(input.equipment, 'bodyweight')}; limits ${formatList(input.limitations, 'none')}; posture ${formatList(postureFlags, 'none')}.
Rules: ${rules.join('; ')}.
Candidate pool breadth: minimum approved options ${minimumPromptCandidateCount}; preferred approved options ${preferredPromptCandidateCount}; provided approved options ${providedApprovedOptionCount}. This is not the number of exercises to output.
Approved green exercise ID map by movement ({movement:{id:name}}): ${JSON.stringify(approvedExerciseMapByMovement)}.
Amber candidates (at most one per day; include every required modification in notes): ${JSON.stringify(amberCandidates)}.
Return exercises with "masterExerciseId" set to one selected green or amber id, plus "name", "sets", "reps", "restSeconds", and optional "notes".`;
}
