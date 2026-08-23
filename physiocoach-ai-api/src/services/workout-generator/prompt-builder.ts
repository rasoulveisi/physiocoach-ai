import type { WorkoutPlanGenerationContext } from '../../types/ai';
import type { CatalogCandidate } from '../../types/workout-generator';
import { WORKOUT_PLAN_MOVEMENT_PATTERNS } from '../../types/workout-plan-contract';

type WorkoutPlanMovementPattern = (typeof WORKOUT_PLAN_MOVEMENT_PATTERNS)[number];
type ExperienceLevel = WorkoutPlanGenerationContext['experienceLevel'];

const TARGET_EXERCISES_PER_DAY = 5;
const MIN_PROMPT_CANDIDATE_MULTIPLIER = 5;
const PREFERRED_PROMPT_CANDIDATE_MULTIPLIER = 6;
const DEFAULT_SESSION_MINUTES = 45;

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

export interface SessionSizingGuidance {
  /** Resolved target duration in minutes (defaults to DEFAULT_SESSION_MINUTES). */
  sessionMinutes: number;
  styleLabel: string;
  minExercisesPerDay: number;
  maxExercisesPerDay: number;
  setsGuidance: string;
  restGuidance: string;
}

export function getSessionSizingGuidance(
  sessionMinutes: number | undefined,
): SessionSizingGuidance {
  const minutes =
    typeof sessionMinutes === 'number' && Number.isFinite(sessionMinutes) && sessionMinutes > 0
      ? sessionMinutes
      : DEFAULT_SESSION_MINUTES;

  if (minutes <= 30) {
    return {
      sessionMinutes: minutes,
      styleLabel: 'High-density express session',
      minExercisesPerDay: 3,
      maxExercisesPerDay: 4,
      setsGuidance: '2-3 sets per exercise (8-10 total sets)',
      restGuidance: '45-60s rest between sets',
    };
  }

  if (minutes < 60) {
    return {
      sessionMinutes: minutes,
      styleLabel: 'Standard split',
      minExercisesPerDay: 4,
      maxExercisesPerDay: 5,
      setsGuidance: '3 sets per exercise (12-15 total sets)',
      restGuidance: '60-90s rest between sets',
    };
  }

  if (minutes < 75) {
    return {
      sessionMinutes: minutes,
      styleLabel: 'Full compound split',
      minExercisesPerDay: 5,
      maxExercisesPerDay: 6,
      setsGuidance: '3-4 sets per exercise (18-22 total sets)',
      restGuidance:
        '90-120s rest on primary compound lifts (bench/squat/row/deadlift) and 60-75s on isolation',
    };
  }

  return {
    sessionMinutes: minutes,
    styleLabel: 'Comprehensive session',
    minExercisesPerDay: 6,
    maxExercisesPerDay: 8,
    setsGuidance: '3-4 sets per exercise',
    restGuidance: '90-180s rest on heavy compounds and warmup sets',
  };
}

export function getExperiencePlanGuidance(
  experienceLevel: ExperienceLevel,
  sessionMinutes?: number,
): string {
  const sizing = getSessionSizingGuidance(sessionMinutes);
  switch (experienceLevel) {
    case 'beginner':
      return `beginner; prioritize skill practice, simple setup, conservative complexity, ${sizing.setsGuidance} with ${sizing.restGuidance}, and usually ${sizing.minExercisesPerDay}-${sizing.maxExercisesPerDay} exercises per day (${sizing.styleLabel})`;
    case 'intermediate':
      return `intermediate; use moderate volume and complexity when recovery and focus allow, ${sizing.setsGuidance} with ${sizing.restGuidance}, usually ${sizing.minExercisesPerDay}-${sizing.maxExercisesPerDay} exercises per day (${sizing.styleLabel})`;
    case 'advanced':
      return `advanced; allow higher complexity or specialization when appropriate, ${sizing.setsGuidance} with ${sizing.restGuidance}, usually ${sizing.minExercisesPerDay}-${sizing.maxExercisesPerDay} exercises per day (${sizing.styleLabel})`;
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
  const sizing = getSessionSizingGuidance(input.sessionMinutes);

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
    'SPLIT INTEGRITY: Upper Body days (e.g. Day 1 in Upper/Lower/Core or Push/Pull splits) MUST strictly contain UPPER BODY exercises: push (chest, shoulders, triceps) and pull (lats, upper back, biceps). NEVER include squats, deadlifts, or lower body leg exercises on an Upper Body day.',
  );
  rules.push(
    'SPLIT INTEGRITY: Lower Body days (e.g. Day 2) MUST strictly contain LOWER BODY exercises: squat, hinge, and lunge (quads, glutes, hamstrings, calves).',
  );
  rules.push(
    'SPLIT INTEGRITY: Torso & Core Stability days (e.g. Day 3) MUST focus on core anti-rotation/bracing, posture pulls, and spinal stability exercises.',
  );

  rules.push(
    'CRITICAL MANDATE: For every exercise, masterExerciseId and name MUST be copied verbatim from the Approved green exercise ID map ({movement:{id:name}}). Do not rename exercises or invent exercises outside the map.',
  );
  rules.push(`prefer movements ${requiredMovementPatternText}`);
  rules.push(
    'Prefer green candidates; use at most one amber candidate per day and include its required modification verbatim in notes',
  );
  rules.push(
    `Build a science-based ${getExperiencePlanGuidance(input.experienceLevel, input.sessionMinutes)} plan from the available profile`,
  );
  rules.push(
    `CRITICAL SESSION DURATION: The athlete selected a target workout duration of ${sizing.sessionMinutes} minutes. Strictly calibrate total exercise count, working sets, and rest times to fit within this duration window.`,
  );
  rules.push(
    `CRITICAL: Every day MUST contain between ${sizing.minExercisesPerDay} and ${sizing.maxExercisesPerDay} exercises (target ${sizing.minExercisesPerDay}-${sizing.maxExercisesPerDay} distinct exercises per day). NEVER output only 1 or 2 exercises per day.`,
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

  return `You are a safety-first senior physiotherapist and strength coach.
Generate a high-quality, customized workout plan in JSON format.

Profile: goals ${orderedGoals.join(' > ')}; level ${input.experienceLevel}; ${input.frequencyDays} days/week; session duration ${formatSessionDuration(sizing.sessionMinutes)}; equipment ${formatList(input.equipment, 'bodyweight')}; limits ${formatList(input.limitations, 'none')}; posture ${formatList(postureFlags, 'none')}.

STRICT GENERATION RULES:
${rules.map((rule, idx) => `${idx + 1}. ${rule}`).join('\n')}

Candidate pool breadth: minimum approved options ${minimumPromptCandidateCount}; preferred approved options ${preferredPromptCandidateCount}; provided approved options ${providedApprovedOptionCount}. This is not the number of exercises to output.
Approved green exercise ID map by movement ({movement:{id:name}}): ${JSON.stringify(approvedExerciseMapByMovement)}.
Amber candidates (at most one per day; include every required modification in notes): ${JSON.stringify(amberCandidates)}.

JSON OUTPUT SPECIFICATION:
Return a JSON object containing a "days" array where each day object has:
- "dayIndex": integer (1 to ${input.frequencyDays})
- "name": string (e.g., "Day 1: Upper Body Focus")
- "exercises": array of ${sizing.minExercisesPerDay} to ${sizing.maxExercisesPerDay} exercise objects, each containing:
  - "masterExerciseId": string (MUST match an exercise ID from the approved maps verbatim)
  - "name": string (exercise name copied verbatim from the map)
  - "movementPattern": string
  - "sets": integer (e.g., 3)
  - "reps": string (e.g., "8-12" or "30s")
  - "restSeconds": integer (e.g., 60)
  - "notes": optional string guidance (MUST include required amber modifications if amber exercise used)

OUTPUT ONLY VALID JSON MATCHING THIS SPECIFICATION.`;
}
