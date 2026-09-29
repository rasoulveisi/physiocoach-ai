import type { WorkoutPlanGenerationContext } from '../../types/ai';
import type { CatalogCandidate } from '../../types/workout-generator';
import { WORKOUT_PLAN_MOVEMENT_PATTERNS } from '../../types/workout-plan-contract';

type WorkoutPlanMovementPattern = (typeof WORKOUT_PLAN_MOVEMENT_PATTERNS)[number];
type ExperienceLevel = WorkoutPlanGenerationContext['experienceLevel'];

const MIN_PROMPT_CANDIDATE_MULTIPLIER = 5;
const PREFERRED_PROMPT_CANDIDATE_MULTIPLIER = 6;
const DEFAULT_SESSION_MINUTES = 45;

export function getPromptCandidateTargets(frequencyDays: number, sessionMinutes?: number) {
  const sizing = getSessionSizingGuidance(sessionMinutes);
  const finalExerciseCount = frequencyDays * sizing.targetExercisesPerDay;
  const minimumPromptCandidateCount = Math.max(50, finalExerciseCount * MIN_PROMPT_CANDIDATE_MULTIPLIER);
  const preferredPromptCandidateCount = Math.max(70, finalExerciseCount * PREFERRED_PROMPT_CANDIDATE_MULTIPLIER);

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
  targetExercisesPerDay: number;
  minTotalSets: number;
  maxTotalSets: number;
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
      minExercisesPerDay: 4,
      maxExercisesPerDay: 5,
      targetExercisesPerDay: 4,
      minTotalSets: 12,
      maxTotalSets: 15,
      setsGuidance: '3 sets per exercise (12-15 total sets)',
      restGuidance: '45-60s rest between sets',
    };
  }

  if (minutes < 55) {
    return {
      sessionMinutes: minutes,
      styleLabel: 'Standard balanced session',
      minExercisesPerDay: 5,
      maxExercisesPerDay: 6,
      targetExercisesPerDay: 5,
      minTotalSets: 16,
      maxTotalSets: 20,
      setsGuidance: '3-4 sets per exercise (16-20 total sets)',
      restGuidance: '60-90s on compound lifts and 60s on isolation',
    };
  }

  if (minutes < 75) {
    return {
      sessionMinutes: minutes,
      styleLabel: 'Full compound & hypertrophy session',
      minExercisesPerDay: 6,
      maxExercisesPerDay: 7,
      targetExercisesPerDay: 6,
      minTotalSets: 20,
      maxTotalSets: 24,
      setsGuidance:
        '3-4 sets per exercise (20-24 total sets: 1-2 primary compounds with 4 sets, secondary lifts with 3-4 sets, accessories with 3 sets)',
      restGuidance:
        '90-120s rest on primary compound lifts (squat/bench/deadlift/row), 75-90s on secondary compounds, and 60s on isolation/core',
    };
  }

  return {
    sessionMinutes: minutes,
    styleLabel: 'Comprehensive athlete session',
    minExercisesPerDay: 7,
    maxExercisesPerDay: 8,
    targetExercisesPerDay: 7,
    minTotalSets: 24,
    maxTotalSets: 28,
    setsGuidance: '3-4 sets per exercise (24-28 total sets)',
    restGuidance: '120-180s rest on heavy compounds and 60-75s on isolation',
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

export interface UnifiedCatalogEntry {
  id: string;
  name: string;
  tier: 'green' | 'amber';
  modification?: string;
}

export function buildUnifiedApprovedCandidateCatalog(
  candidates: readonly CatalogCandidate[],
): Record<string, UnifiedCatalogEntry[]> {
  return candidates.reduce<Record<string, UnifiedCatalogEntry[]>>((grouped, candidate) => {
    const pattern = candidate.movementPattern;
    const entry: UnifiedCatalogEntry = {
      id: getPromptCandidateId(candidate),
      name: candidate.name,
      tier: candidate.cluster === 'amber' ? 'amber' : 'green',
      ...(candidate.cluster === 'amber' && candidate.requiredModifications?.length
        ? { modification: candidate.requiredModifications.join('; ') }
        : {}),
    };
    if (!grouped[pattern]) {
      grouped[pattern] = [];
    }
    grouped[pattern].push(entry);
    return grouped;
  }, {});
}

export interface SlotBlueprint {
  slot: number;
  label: string;
  sets: number | string;
  reps: string;
  restSeconds: number;
  description: string;
}

export interface SlotArchitecture {
  sessionMinutes: number;
  slotCount: number;
  targetWorkingSets: string;
  slots: SlotBlueprint[];
  guidanceText: string;
}

export type DayTrainingType = 'upper' | 'lower' | 'full_body' | 'general';

export interface DaySlotBlueprint extends SlotArchitecture {
  dayType: DayTrainingType;
  dayNumber: number;
}

export function getDayTrainingType(dayNumber: number, frequencyDays: number): DayTrainingType {
  if (frequencyDays === 1) {
    return 'full_body';
  }
  if (frequencyDays === 2) {
    return dayNumber === 1 ? 'upper' : 'lower';
  }
  if (frequencyDays === 3) {
    if (dayNumber === 1) return 'upper';
    if (dayNumber === 2) return 'lower';
    return 'full_body';
  }
  if (frequencyDays === 4) {
    return dayNumber % 2 === 1 ? 'upper' : 'lower';
  }
  if (frequencyDays === 5) {
    if (dayNumber === 1 || dayNumber === 3) return 'upper';
    if (dayNumber === 2 || dayNumber === 4) return 'lower';
    return 'full_body';
  }
  if (frequencyDays === 6) {
    return dayNumber % 2 === 1 ? 'upper' : 'lower';
  }
  return 'general';
}

export function getDaySlotBlueprint(
  dayType: DayTrainingType,
  dayNumber: number = 1,
  sessionMinutes: number = 60,
): DaySlotBlueprint {
  const minutes =
    typeof sessionMinutes === 'number' && Number.isFinite(sessionMinutes) && sessionMinutes > 0
      ? sessionMinutes
      : 60;

  if (minutes <= 30) {
    let slots: SlotBlueprint[];
    switch (dayType) {
      case 'upper':
        slots = [
          {
            slot: 1,
            label: 'Primary Upper Push/Pull Compound',
            sets: 3,
            reps: '6-8',
            restSeconds: 90,
            description: '3 sets, 6-8 reps, 90s rest',
          },
          {
            slot: 2,
            label: 'Secondary Upper Push/Pull Compound',
            sets: 3,
            reps: '8-10',
            restSeconds: 75,
            description: '3 sets, 8-10 reps, 75s rest',
          },
          {
            slot: 3,
            label: 'Upper Hypertrophy Accessory / Unilateral',
            sets: 3,
            reps: '8-12',
            restSeconds: 60,
            description: '3 sets, 8-12 reps, 60s rest',
          },
          {
            slot: 4,
            label: 'Core Anti-Rotation / Postural Support',
            sets: '2-3',
            reps: '12-15 or 30-45s hold',
            restSeconds: 60,
            description: '2-3 sets, 12-15 reps or 30-45s hold, 60s rest',
          },
        ];
        break;
      case 'lower':
        slots = [
          {
            slot: 1,
            label: 'Primary Lower Compound (Squat or Hinge)',
            sets: 3,
            reps: '6-8',
            restSeconds: 90,
            description: '3 sets, 6-8 reps, 90s rest',
          },
          {
            slot: 2,
            label: 'Secondary Lower Compound / Unilateral',
            sets: 3,
            reps: '8-10',
            restSeconds: 75,
            description: '3 sets, 8-10 reps, 75s rest',
          },
          {
            slot: 3,
            label: 'Lower Hypertrophy Isolation / Hip Stability',
            sets: 3,
            reps: '8-12',
            restSeconds: 60,
            description: '3 sets, 8-12 reps, 60s rest',
          },
          {
            slot: 4,
            label: 'Core Anti-Extension / Pelvic Stability',
            sets: '2-3',
            reps: '12-15 or 30-45s hold',
            restSeconds: 60,
            description: '2-3 sets, 12-15 reps or 30-45s hold, 60s rest',
          },
        ];
        break;
      case 'full_body':
        slots = [
          {
            slot: 1,
            label: 'Primary Lower Compound (Squat or Hinge)',
            sets: 3,
            reps: '6-8',
            restSeconds: 90,
            description: '3 sets, 6-8 reps, 90s rest',
          },
          {
            slot: 2,
            label: 'Primary Upper Compound (Press or Row)',
            sets: 3,
            reps: '8-10',
            restSeconds: 75,
            description: '3 sets, 8-10 reps, 75s rest',
          },
          {
            slot: 3,
            label: 'Unilateral / Hypertrophy Accessory',
            sets: 3,
            reps: '8-12',
            restSeconds: 60,
            description: '3 sets, 8-12 reps, 60s rest',
          },
          {
            slot: 4,
            label: 'Core Stability / Loaded Carry',
            sets: '2-3',
            reps: '12-15 or 30-45s hold',
            restSeconds: 60,
            description: '2-3 sets, 12-15 reps or 30-45s hold, 60s rest',
          },
        ];
        break;
      case 'general':
      default:
        slots = [
          {
            slot: 1,
            label: 'Primary Compound Lift',
            sets: 3,
            reps: '6-8',
            restSeconds: 90,
            description: '3 sets, 6-8 reps, 90s rest',
          },
          {
            slot: 2,
            label: 'Secondary Compound Lift',
            sets: 3,
            reps: '8-10',
            restSeconds: 75,
            description: '3 sets, 8-10 reps, 75s rest',
          },
          {
            slot: 3,
            label: 'Hypertrophy Accessory / Unilateral',
            sets: 3,
            reps: '8-12',
            restSeconds: 60,
            description: '3 sets, 8-12 reps, 60s rest',
          },
          {
            slot: 4,
            label: 'Core / Postural Support',
            sets: '2-3',
            reps: '12-15 or 30-45s hold',
            restSeconds: 60,
            description: '2-3 sets, 12-15 reps or 30-45s hold, 60s rest',
          },
        ];
        break;
    }
    return {
      dayType,
      dayNumber,
      sessionMinutes: minutes,
      slotCount: 4,
      targetWorkingSets: '11-12',
      slots,
      guidanceText: slots.map((s) => `Slot ${s.slot}: ${s.label} — ${s.description}`).join('\n'),
    };
  }

  if (minutes < 55) {
    let slots: SlotBlueprint[];
    switch (dayType) {
      case 'upper':
        slots = [
          {
            slot: 1,
            label: 'Primary Upper Push/Pull Compound',
            sets: '3-4',
            reps: '6-8',
            restSeconds: 90,
            description: '3-4 sets, 6-8 reps, 90-120s rest',
          },
          {
            slot: 2,
            label: 'Secondary Upper Push/Pull Compound',
            sets: 3,
            reps: '8-10',
            restSeconds: 90,
            description: '3 sets, 8-10 reps, 90s rest',
          },
          {
            slot: 3,
            label: 'Upper Compound / Unilateral',
            sets: 3,
            reps: '8-12',
            restSeconds: 75,
            description: '3 sets, 8-12 reps, 75s rest',
          },
          {
            slot: 4,
            label: 'Upper Hypertrophy Accessory',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            description: '3 sets, 10-12 reps, 60s rest (Lateral Raise, Biceps Curl, or Triceps Pushdown from the catalog)',
          },
          {
            slot: 5,
            label: 'Postural Support / Rear Delt / Upper Back',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            description: '3 sets, 12-15 reps, 60s rest',
          },
        ];
        break;
      case 'lower':
        slots = [
          {
            slot: 1,
            label: 'Primary Lower Compound (Squat or Hinge)',
            sets: '3-4',
            reps: '6-8',
            restSeconds: 90,
            description: '3-4 sets, 6-8 reps, 90-120s rest',
          },
          {
            slot: 2,
            label: 'Secondary Lower Compound (Hinge or Squat)',
            sets: 3,
            reps: '8-10',
            restSeconds: 90,
            description: '3 sets, 8-10 reps, 90s rest',
          },
          {
            slot: 3,
            label: 'Unilateral Lower (Lunge / Split Squat / Step-Up)',
            sets: 3,
            reps: '8-12',
            restSeconds: 75,
            description: '3 sets, 8-12 reps, 75s rest',
          },
          {
            slot: 4,
            label: 'Lower Hypertrophy Isolation',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            description: '3 sets, 10-12 reps, 60s rest (Leg Curl, Leg Extension, or Calf Raise from the catalog)',
          },
          {
            slot: 5,
            label: 'Hip / Pelvic / Glute Postural Stability',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            description: '3 sets, 12-15 reps, 60s rest (Glute Bridge, Hip Thrust, or Hip Abduction from the catalog)',
          },
        ];
        break;
      case 'full_body':
        slots = [
          {
            slot: 1,
            label: 'Primary Lower Compound (Squat or Hinge)',
            sets: '3-4',
            reps: '6-8',
            restSeconds: 90,
            description: '3-4 sets, 6-8 reps, 90-120s rest',
          },
          {
            slot: 2,
            label: 'Primary Upper Compound (Press or Row)',
            sets: 3,
            reps: '8-10',
            restSeconds: 90,
            description: '3 sets, 8-10 reps, 90s rest',
          },
          {
            slot: 3,
            label: 'Unilateral / Secondary Compound',
            sets: 3,
            reps: '8-12',
            restSeconds: 75,
            description: '3 sets, 8-12 reps, 75s rest',
          },
          {
            slot: 4,
            label: 'Upper Back / Postural Support',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            description: '3 sets, 10-12 reps, 60s rest',
          },
          {
            slot: 5,
            label: 'Core Stability / Loaded Carry',
            sets: 3,
            reps: '12-15 or 30-45s hold',
            restSeconds: 60,
            description: '3 sets, 12-15 reps or 30-45s hold, 60s rest',
          },
        ];
        break;
      case 'general':
      default:
        slots = [
          {
            slot: 1,
            label: 'Primary Compound Lift',
            sets: '3-4',
            reps: '6-8',
            restSeconds: 90,
            description: '3-4 sets, 6-8 reps, 90-120s rest',
          },
          {
            slot: 2,
            label: 'Secondary Compound Lift',
            sets: 3,
            reps: '8-10',
            restSeconds: 90,
            description: '3 sets, 8-10 reps, 90s rest',
          },
          {
            slot: 3,
            label: 'Secondary Compound / Unilateral',
            sets: 3,
            reps: '8-12',
            restSeconds: 75,
            description: '3 sets, 8-12 reps, 75s rest',
          },
          {
            slot: 4,
            label: 'Hypertrophy Accessory',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            description: '3 sets, 10-12 reps, 60s rest',
          },
          {
            slot: 5,
            label: 'Postural Support / Core',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            description: '3 sets, 12-15 reps or 30-45s hold, 60s rest',
          },
        ];
        break;
    }
    return {
      dayType,
      dayNumber,
      sessionMinutes: minutes,
      slotCount: 5,
      targetWorkingSets: '15-16',
      slots,
      guidanceText: slots.map((s) => `Slot ${s.slot}: ${s.label} — ${s.description}`).join('\n'),
    };
  }

  if (minutes < 75) {
    let slots: SlotBlueprint[];
    switch (dayType) {
      case 'upper':
        slots = [
          {
            slot: 1,
            label: 'Primary Upper Push/Pull Compound',
            sets: 4,
            reps: '6-8',
            restSeconds: 120,
            description: '4 sets, 6-8 reps, 120s rest',
          },
          {
            slot: 2,
            label: 'Secondary Upper Push/Pull Compound',
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
            description: '4 sets, 8-10 reps, 90s rest',
          },
          {
            slot: 3,
            label: 'Upper Compound / Unilateral',
            sets: 3,
            reps: '8-12',
            restSeconds: 75,
            description: '3 sets, 8-12 reps, 75s rest',
          },
          {
            slot: 4,
            label: 'Upper Hypertrophy Accessory',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            description: '3 sets, 10-12 reps, 60s rest (Lateral Raise, Biceps Curl, or Triceps Pushdown from the catalog)',
          },
          {
            slot: 5,
            label: 'Postural Support / Rear Delt / Upper Back',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            description: '3 sets, 12-15 reps, 60s rest',
          },
          {
            slot: 6,
            label: 'Core Anti-Rotation / Trunk Stability',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            description: '3 sets, 12-15 reps, 60s rest',
          },
        ];
        break;
      case 'lower':
        slots = [
          {
            slot: 1,
            label: 'Primary Lower Compound (Squat or Hinge)',
            sets: 4,
            reps: '6-8',
            restSeconds: 120,
            description: '4 sets, 6-8 reps, 120s rest',
          },
          {
            slot: 2,
            label: 'Secondary Lower Compound (Hinge or Squat)',
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
            description: '4 sets, 8-10 reps, 90s rest',
          },
          {
            slot: 3,
            label: 'Unilateral Lower (Lunge / Split Squat / Step-Up)',
            sets: 3,
            reps: '8-12',
            restSeconds: 75,
            description: '3 sets, 8-12 reps, 75s rest',
          },
          {
            slot: 4,
            label: 'Lower Hypertrophy Isolation',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            description: '3 sets, 10-12 reps, 60s rest (Leg Curl, Leg Extension, or Calf Raise from the catalog)',
          },
          {
            slot: 5,
            label: 'Hip / Pelvic / Glute Postural Stability',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            description: '3 sets, 12-15 reps, 60s rest (Glute Bridge, Hip Thrust, or Hip Abduction from the catalog)',
          },
          {
            slot: 6,
            label: 'Core Anti-Extension / Pelvic Stability',
            sets: 3,
            reps: '12-15 or hold',
            restSeconds: 60,
            description: '3 sets, 12-15 reps or hold, 60s rest (Plank, Dead Bug, or Pallof Press from the catalog)',
          },
        ];
        break;
      case 'full_body':
        slots = [
          {
            slot: 1,
            label: 'Primary Lower Compound (Squat or Hinge)',
            sets: 4,
            reps: '6-8',
            restSeconds: 120,
            description: '4 sets, 6-8 reps, 120s rest',
          },
          {
            slot: 2,
            label: 'Primary Upper Compound (Press or Row)',
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
            description: '4 sets, 8-10 reps, 90s rest',
          },
          {
            slot: 3,
            label: 'Unilateral / Secondary Compound',
            sets: 3,
            reps: '8-12',
            restSeconds: 75,
            description: '3 sets, 8-12 reps, 75s rest',
          },
          {
            slot: 4,
            label: 'Hypertrophy Accessory',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            description: '3 sets, 10-12 reps, 60s rest',
          },
          {
            slot: 5,
            label: 'Upper Back / Postural Support',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            description: '3 sets, 12-15 reps, 60s rest',
          },
          {
            slot: 6,
            label: 'Core Stability / Loaded Carry',
            sets: 3,
            reps: '12-15 or 30-45s carry',
            restSeconds: 60,
            description: '3 sets, 12-15 reps or 30-45s carry, 60s rest',
          },
        ];
        break;
      case 'general':
      default:
        slots = [
          {
            slot: 1,
            label: 'Primary Compound Lift',
            sets: 4,
            reps: '6-8',
            restSeconds: 120,
            description: '4 sets, 6-8 reps, 120s rest',
          },
          {
            slot: 2,
            label: 'Secondary Compound Lift',
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
            description: '4 sets, 8-10 reps, 90s rest',
          },
          {
            slot: 3,
            label: 'Secondary Compound / Unilateral',
            sets: 3,
            reps: '8-12',
            restSeconds: 75,
            description: '3 sets, 8-12 reps, 75s rest',
          },
          {
            slot: 4,
            label: 'Hypertrophy Accessory',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            description: '3 sets, 10-12 reps, 60s rest',
          },
          {
            slot: 5,
            label: 'Postural Support / Rear Delt / Upper Back',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            description: '3 sets, 12-15 reps, 60s rest',
          },
          {
            slot: 6,
            label: 'Core / Anti-Rotation / Loaded Carry',
            sets: 3,
            reps: '12-15 or 30-45s hold',
            restSeconds: 60,
            description: '3 sets, 12-15 reps or 30-45s hold, 60s rest',
          },
        ];
        break;
    }
    return {
      dayType,
      dayNumber,
      sessionMinutes: minutes,
      slotCount: 6,
      targetWorkingSets: 'exactly 20',
      slots,
      guidanceText: slots.map((s) => `Slot ${s.slot}: ${s.label} — ${s.description}`).join('\n'),
    };
  }

  if (minutes < 85) {
    let slots: SlotBlueprint[];
    switch (dayType) {
      case 'upper':
        slots = [
          {
            slot: 1,
            label: 'Primary Upper Push Compound',
            sets: 4,
            reps: '6-8',
            restSeconds: 120,
            description: '4 sets, 6-8 reps, 120-150s rest',
          },
          {
            slot: 2,
            label: 'Primary Upper Pull Compound',
            sets: 4,
            reps: '6-8',
            restSeconds: 90,
            description: '4 sets, 6-8 reps, 90-120s rest',
          },
          {
            slot: 3,
            label: 'Secondary Upper Compound / Unilateral',
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
            description: '4 sets, 8-10 reps, 90s rest',
          },
          {
            slot: 4,
            label: 'Upper Hypertrophy Accessory A',
            sets: 3,
            reps: '8-12',
            restSeconds: 75,
            description: '3 sets, 8-12 reps, 60-75s rest',
          },
          {
            slot: 5,
            label: 'Upper Hypertrophy Accessory B',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            description: '3 sets, 10-12 reps, 60-75s rest',
          },
          {
            slot: 6,
            label: 'Postural Support / Rear Delt / Upper Back',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            description: '3 sets, 12-15 reps, 60s rest',
          },
          {
            slot: 7,
            label: 'Core Anti-Rotation / Trunk Stability',
            sets: 3,
            reps: '12-15 or 30-45s hold',
            restSeconds: 60,
            description: '3 sets, 12-15 reps or 30-45s hold, 60s rest',
          },
        ];
        break;
      case 'lower':
        slots = [
          {
            slot: 1,
            label: 'Primary Lower Compound (Squat or Hinge)',
            sets: 4,
            reps: '6-8',
            restSeconds: 120,
            description: '4 sets, 6-8 reps, 120-150s rest',
          },
          {
            slot: 2,
            label: 'Secondary Lower Compound (Hinge or Squat)',
            sets: 4,
            reps: '6-8',
            restSeconds: 90,
            description: '4 sets, 6-8 reps, 90-120s rest',
          },
          {
            slot: 3,
            label: 'Unilateral Lower (Lunge / Split Squat / Step-Up)',
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
            description: '4 sets, 8-10 reps, 90s rest',
          },
          {
            slot: 4,
            label: 'Lower Hypertrophy Isolation A (Leg Curl / Leg Extension)',
            sets: 3,
            reps: '8-12',
            restSeconds: 75,
            description: '3 sets, 8-12 reps, 60-75s rest',
          },
          {
            slot: 5,
            label: 'Lower Hypertrophy Isolation B (Calves / Adductors)',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            description: '3 sets, 10-12 reps, 60-75s rest',
          },
          {
            slot: 6,
            label: 'Hip / Pelvic / Glute Postural Stability',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            description: '3 sets, 12-15 reps, 60s rest',
          },
          {
            slot: 7,
            label: 'Core Anti-Extension / Pelvic Stability',
            sets: 3,
            reps: '12-15 or 30-45s hold',
            restSeconds: 60,
            description: '3 sets, 12-15 reps or 30-45s hold, 60s rest',
          },
        ];
        break;
      case 'full_body':
        slots = [
          {
            slot: 1,
            label: 'Primary Lower Compound (Squat or Hinge)',
            sets: 4,
            reps: '6-8',
            restSeconds: 120,
            description: '4 sets, 6-8 reps, 120-150s rest',
          },
          {
            slot: 2,
            label: 'Primary Upper Compound (Press or Row)',
            sets: 4,
            reps: '6-8',
            restSeconds: 90,
            description: '4 sets, 6-8 reps, 90-120s rest',
          },
          {
            slot: 3,
            label: 'Secondary Compound / Unilateral',
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
            description: '4 sets, 8-10 reps, 90s rest',
          },
          {
            slot: 4,
            label: 'Hypertrophy Accessory A',
            sets: 3,
            reps: '8-12',
            restSeconds: 75,
            description: '3 sets, 8-12 reps, 60-75s rest',
          },
          {
            slot: 5,
            label: 'Hypertrophy Accessory B',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            description: '3 sets, 10-12 reps, 60-75s rest',
          },
          {
            slot: 6,
            label: 'Upper Back / Postural Support',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            description: '3 sets, 12-15 reps, 60s rest',
          },
          {
            slot: 7,
            label: 'Core Stability / Loaded Carry',
            sets: 3,
            reps: '12-15 or 30-45s hold',
            restSeconds: 60,
            description: '3 sets, 12-15 reps or 30-45s hold, 60s rest',
          },
        ];
        break;
      case 'general':
      default:
        slots = [
          {
            slot: 1,
            label: 'Primary Compound Lift',
            sets: 4,
            reps: '6-8',
            restSeconds: 120,
            description: '4 sets, 6-8 reps, 120-150s rest',
          },
          {
            slot: 2,
            label: 'Secondary Compound Lift',
            sets: 4,
            reps: '6-8',
            restSeconds: 90,
            description: '4 sets, 6-8 reps, 90-120s rest',
          },
          {
            slot: 3,
            label: 'Secondary Compound / Unilateral',
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
            description: '4 sets, 8-10 reps, 90s rest',
          },
          {
            slot: 4,
            label: 'Hypertrophy Accessory A',
            sets: 3,
            reps: '8-12',
            restSeconds: 75,
            description: '3 sets, 8-12 reps, 60-75s rest',
          },
          {
            slot: 5,
            label: 'Hypertrophy Accessory B',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            description: '3 sets, 10-12 reps, 60-75s rest',
          },
          {
            slot: 6,
            label: 'Postural Support / Rear Delt / Upper Back',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            description: '3 sets, 12-15 reps, 60s rest',
          },
          {
            slot: 7,
            label: 'Core / Anti-Rotation / Loaded Carry',
            sets: 3,
            reps: '12-15 or 30-45s hold',
            restSeconds: 60,
            description: '3 sets, 12-15 reps or 30-45s hold, 60s rest',
          },
        ];
        break;
    }
    return {
      dayType,
      dayNumber,
      sessionMinutes: minutes,
      slotCount: 7,
      targetWorkingSets: '24',
      slots,
      guidanceText: slots.map((s) => `Slot ${s.slot}: ${s.label} — ${s.description}`).join('\n'),
    };
  }

  // >= 85 minutes
  let slots: SlotBlueprint[];
  switch (dayType) {
    case 'upper':
      slots = [
        {
          slot: 1,
          label: 'Primary Upper Push Compound',
          sets: 4,
          reps: '6-8',
          restSeconds: 120,
          description: '4 sets, 6-8 reps, 120-150s rest',
        },
        {
          slot: 2,
          label: 'Primary Upper Pull Compound',
          sets: 4,
          reps: '6-8',
          restSeconds: 90,
          description: '4 sets, 6-8 reps, 90-120s rest',
        },
        {
          slot: 3,
          label: 'Secondary Upper Compound / Unilateral',
          sets: 4,
          reps: '8-10',
          restSeconds: 90,
          description: '4 sets, 8-10 reps, 90s rest',
        },
        {
          slot: 4,
          label: 'Upper Hypertrophy Accessory A',
          sets: '3-4',
          reps: '8-12',
          restSeconds: 75,
          description: '3-4 sets, 8-12 reps, 60-75s rest',
        },
        {
          slot: 5,
          label: 'Upper Hypertrophy Accessory B',
          sets: 3,
          reps: '10-12',
          restSeconds: 60,
          description: '3 sets, 10-12 reps, 60-75s rest',
        },
        {
          slot: 6,
          label: 'Postural Support / Rear Delt / Upper Back',
          sets: 3,
          reps: '12-15',
          restSeconds: 60,
          description: '3 sets, 12-15 reps, 60s rest',
        },
        {
          slot: 7,
          label: 'Core Anti-Rotation / Trunk Bracing',
          sets: 3,
          reps: '12-15 or 30-45s hold',
          restSeconds: 60,
          description: '3 sets, 12-15 reps or 30-45s hold, 60s rest',
        },
        {
          slot: 8,
          label: 'Loaded Carry / Dynamic Finisher',
          sets: 3,
          reps: '30-60s hold or carry',
          restSeconds: 60,
          description: '3 sets, 30-60s hold or carry, 60s rest',
        },
      ];
      break;
    case 'lower':
      slots = [
        {
          slot: 1,
          label: 'Primary Lower Compound (Squat or Hinge)',
          sets: 4,
          reps: '6-8',
          restSeconds: 120,
          description: '4 sets, 6-8 reps, 120-150s rest',
        },
        {
          slot: 2,
          label: 'Secondary Lower Compound (Hinge or Squat)',
          sets: 4,
          reps: '6-8',
          restSeconds: 90,
          description: '4 sets, 6-8 reps, 90-120s rest',
        },
        {
          slot: 3,
          label: 'Unilateral Lower (Lunge / Split Squat / Step-Up)',
          sets: 4,
          reps: '8-10',
          restSeconds: 90,
          description: '4 sets, 8-10 reps, 90s rest',
        },
        {
          slot: 4,
          label: 'Lower Hypertrophy Isolation A (Leg Curl / Leg Extension)',
          sets: '3-4',
          reps: '8-12',
          restSeconds: 75,
          description: '3-4 sets, 8-12 reps, 60-75s rest',
        },
        {
          slot: 5,
          label: 'Lower Hypertrophy Isolation B (Calves / Shins)',
          sets: 3,
          reps: '10-12',
          restSeconds: 60,
          description: '3 sets, 10-12 reps, 60-75s rest',
        },
        {
          slot: 6,
          label: 'Hip / Pelvic / Glute Postural Stability',
          sets: 3,
          reps: '12-15',
          restSeconds: 60,
          description: '3 sets, 12-15 reps, 60s rest',
        },
        {
          slot: 7,
          label: 'Core Anti-Extension / Pelvic Stability',
          sets: 3,
          reps: '12-15 or 30-45s hold',
          restSeconds: 60,
          description: '3 sets, 12-15 reps or 30-45s hold, 60s rest',
        },
        {
          slot: 8,
          label: 'Loaded Carry / Functional Finisher',
          sets: 3,
          reps: '30-60s carry or hold',
          restSeconds: 60,
          description: '3 sets, 30-60s carry or hold, 60s rest',
        },
      ];
      break;
    case 'full_body':
      slots = [
        {
          slot: 1,
          label: 'Primary Lower Compound (Squat or Hinge)',
          sets: 4,
          reps: '6-8',
          restSeconds: 120,
          description: '4 sets, 6-8 reps, 120-150s rest',
        },
        {
          slot: 2,
          label: 'Primary Upper Compound (Press or Row)',
          sets: 4,
          reps: '6-8',
          restSeconds: 90,
          description: '4 sets, 6-8 reps, 90-120s rest',
        },
        {
          slot: 3,
          label: 'Secondary Compound / Unilateral',
          sets: 4,
          reps: '8-10',
          restSeconds: 90,
          description: '4 sets, 8-10 reps, 90s rest',
        },
        {
          slot: 4,
          label: 'Hypertrophy Accessory A',
          sets: '3-4',
          reps: '8-12',
          restSeconds: 75,
          description: '3-4 sets, 8-12 reps, 60-75s rest',
        },
        {
          slot: 5,
          label: 'Hypertrophy Accessory B',
          sets: 3,
          reps: '10-12',
          restSeconds: 60,
          description: '3 sets, 10-12 reps, 60-75s rest',
        },
        {
          slot: 6,
          label: 'Upper Back / Postural Support',
          sets: 3,
          reps: '12-15',
          restSeconds: 60,
          description: '3 sets, 12-15 reps, 60s rest',
        },
        {
          slot: 7,
          label: 'Core Anti-Rotation / Trunk Bracing',
          sets: 3,
          reps: '12-15 or 30-45s hold',
          restSeconds: 60,
          description: '3 sets, 12-15 reps or 30-45s hold, 60s rest',
        },
        {
          slot: 8,
          label: 'Loaded Carry / Dynamic Finisher',
          sets: 3,
          reps: '30-60s hold or carry',
          restSeconds: 60,
          description: '3 sets, 30-60s hold or carry, 60s rest',
        },
      ];
      break;
    case 'general':
    default:
      slots = [
        {
          slot: 1,
          label: 'Primary Compound Lift',
          sets: 4,
          reps: '6-8',
          restSeconds: 120,
          description: '4 sets, 6-8 reps, 120-150s rest',
        },
        {
          slot: 2,
          label: 'Secondary Compound Lift',
          sets: 4,
          reps: '6-8',
          restSeconds: 90,
          description: '4 sets, 6-8 reps, 90-120s rest',
        },
        {
          slot: 3,
          label: 'Secondary Compound / Unilateral',
          sets: 4,
          reps: '8-10',
          restSeconds: 90,
          description: '4 sets, 8-10 reps, 90s rest',
        },
        {
          slot: 4,
          label: 'Hypertrophy Accessory A',
          sets: '3-4',
          reps: '8-12',
          restSeconds: 75,
          description: '3-4 sets, 8-12 reps, 60-75s rest',
        },
        {
          slot: 5,
          label: 'Hypertrophy Accessory B',
          sets: 3,
          reps: '10-12',
          restSeconds: 60,
          description: '3 sets, 10-12 reps, 60-75s rest',
        },
        {
          slot: 6,
          label: 'Postural Support / Rear Delt / Upper Back',
          sets: 3,
          reps: '12-15',
          restSeconds: 60,
          description: '3 sets, 12-15 reps, 60s rest',
        },
        {
          slot: 7,
          label: 'Core / Anti-Rotation / Trunk Bracing',
          sets: 3,
          reps: '12-15 or 30-45s hold',
          restSeconds: 60,
          description: '3 sets, 12-15 reps or 30-45s hold, 60s rest',
        },
        {
          slot: 8,
          label: 'Loaded Carry / Dynamic Finisher',
          sets: 3,
          reps: '30-60s carry or hold',
          restSeconds: 60,
          description: '3 sets, 30-60s hold or carry, 60s rest',
        },
      ];
      break;
  }
  return {
    dayType,
    dayNumber,
    sessionMinutes: minutes,
    slotCount: 8,
    targetWorkingSets: '27-28',
    slots,
    guidanceText: slots.map((s) => `Slot ${s.slot}: ${s.label} — ${s.description}`).join('\n'),
  };
}

export function getSlotArchitecture(sessionMinutes?: number): SlotArchitecture {
  return getDaySlotBlueprint('general', 1, sessionMinutes);
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
    forwardHead: 'forward_head',
    forwardHeadPain: 'forward_head',
    tightHips: 'tight_hips',
    anteriorPelvicTilt: 'anterior_pelvic_tilt',
    lowerBackDiscomfort: 'lower_back_discomfort',
  };

  const painKeys = new Set([
    'kneePain',
    'knee_pain',
    'shoulderPain',
    'shoulder_pain',
    'lowerBackPain',
    'lower_back_pain',
    'neckPain',
    'neck_pain',
  ]);

  return Object.entries(postureFlags)
    .filter(([key, enabled]) => enabled === true && !painKeys.has(key))
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
  const baseBlueprint = getDaySlotBlueprint('general', 1, sizing.sessionMinutes);

  const rules: string[] = [];
  rules.push(`exactly ${input.frequencyDays} days`);

  const rawPosture = (input.postureFlags ?? {}) as Record<string, unknown>;
  const hasRoundedShoulders =
    postureFlags.includes('rounded_shoulders') || rawPosture.roundedShoulders === true;
  const hasKneePain =
    (input.limitations ?? []).includes('knee_pain') ||
    rawPosture.kneePain === true ||
    rawPosture.knee_pain === true ||
    (input.considerations ?? []).some((c) => c.code === 'knee_pain');

  const archetype = (input.archetype ?? '').toLowerCase();
  const isStrengthOrHypertrophy =
    orderedGoals.some((g) =>
      ['strength', 'muscle_gain', 'hypertrophy', 'recomposition', 'aesthetics'].includes(
        g.toLowerCase(),
      ),
    ) ||
    archetype.includes('strength') ||
    archetype.includes('powerbuilding') ||
    archetype.includes('hypertrophy');

  const pullBiasedDay1Desc =
    'Upper Body Pull-Biased (Two of Slots 1–3 must contain designated upper-body pulling compounds like rows or pulldowns, and one must contain an upper-body pushing compound like bench press or overhead press)';

  if (input.frequencyDays === 3) {
    if (isStrengthOrHypertrophy) {
      const day1Bias = hasRoundedShoulders
        ? pullBiasedDay1Desc
        : 'Upper Body Push & Pull Balanced';
      const day2Bias = hasKneePain
        ? 'Lower Body Knee-Friendly (Squat/Hinge/Glutes; Slots 1–2 must include one squat-pattern option and one hinge-pattern option)'
        : 'Lower Body Strength (Squat, Hinge, Quads, Hamstrings, Calves; Slots 1–2 must include one squat-pattern option and one hinge-pattern option)';
      const day3Bias =
        'Full Body Compound & Posterior Chain (Multi-joint Squat/Hinge or Compound Push/Pull with Core Stability / Loaded Carry)';
      rules.push(`Day 1 ${day1Bias}, Day 2 ${day2Bias}, Day 3 ${day3Bias}`);
    } else {
      const day1Bias = hasRoundedShoulders
        ? pullBiasedDay1Desc
        : 'Upper Body Push/Pull Balanced';
      const day2Bias = hasKneePain
        ? 'Lower Body Knee-Friendly & Posterior Chain (Slots 1–2 must include one squat-pattern option and one hinge-pattern option)'
        : 'Lower Body & Hip Mobility Focus (Slots 1–2 must include one squat-pattern option and one hinge-pattern option)';
      const day3Bias =
        'Full Body Functional Strength & Core Integration (Multi-joint compound + Core Stability / Loaded Carry)';
      rules.push(`Day 1 ${day1Bias}, Day 2 ${day2Bias}, Day 3 ${day3Bias}`);
    }
  } else if (input.frequencyDays === 2) {
    const day1Bias = hasRoundedShoulders ? pullBiasedDay1Desc : 'Upper Body Push & Pull';
    const day2Bias = hasKneePain
      ? 'Lower Body Knee-Friendly & Core (Slots 1–2 must include one squat-pattern option and one hinge-pattern option)'
      : 'Lower Body Compound & Core Integration (Slots 1–2 must include one squat-pattern option and one hinge-pattern option)';
    rules.push(`Day 1 ${day1Bias}, Day 2 ${day2Bias}`);
  } else if (input.frequencyDays === 4) {
    const day1Bias = hasRoundedShoulders
      ? pullBiasedDay1Desc
      : 'Upper Body Push/Pull A';
    const day2Bias = hasKneePain
      ? 'Lower Body Knee-Friendly (Squat/Glutes; Slots 1–2 must include one squat-pattern option and one hinge-pattern option)'
      : 'Lower Body Squat & Quads Focus (Slots 1–2 must include one squat-pattern option and one hinge-pattern option)';
    const day3Bias = 'Upper Body Push/Pull B (Lats, Delts, Arms)';
    const day4Bias = 'Lower Body Hinge & Hamstring/Glute Focus';
    rules.push(`Day 1 ${day1Bias}, Day 2 ${day2Bias}, Day 3 ${day3Bias}, Day 4 ${day4Bias}`);
  } else if (input.frequencyDays === 5) {
    rules.push(
      'Day 1 Upper Body Push, Day 2 Lower Body Quad Focus, Day 3 Upper Body Pull, Day 4 Lower Body Posterior Chain, Day 5 Full Body / Weak Point Accessories',
    );
  } else {
    if (hasRoundedShoulders) {
      rules.push(`upper body sessions must be pull-biased: ${pullBiasedDay1Desc}`);
    }
    if (hasKneePain) {
      rules.push('lower body sessions must be knee-friendly');
    }
  }

  rules.push(
    'SPLIT INTEGRITY (Upper Body): Slots 1-5 MUST strictly contain UPPER BODY exercises: push (chest, shoulders, triceps) and pull (lats, upper back, biceps). Slot 6 is reserved for core/trunk stability. NEVER include squats, deadlifts, or lower body leg exercises on an Upper Body day.',
  );
  rules.push(
    'SPLIT INTEGRITY (Lower Body): Slots 1-4 MUST strictly contain LOWER BODY exercises (squat, hinge, lunge, calves). Slots 1–2 must include one squat-pattern option and one hinge-pattern option. Slot 5 is reserved for hip/glute/pelvic stability. Slot 6 is reserved for core/pelvic stability.',
  );
  rules.push(
    'SPLIT INTEGRITY (Full Body): Must feature both lower-body and upper-body compound movements across Slots 1-3. Slot 5 is postural upper back. Slot 6 is Core Stability / Loaded Carry. NEVER output an entire workout day consisting exclusively of isolated mat/core exercises.',
  );
  rules.push(
    'Movement patterns may repeat across days. Satisfy the explicit daily coverage requirements in the slot blueprints.',
  );
  rules.push(
    'Every exercise within a single workout day must have a unique masterExerciseId. Exercise IDs may repeat across different days unless an explicit cross-day reuse limit prohibits this. Variety is a preference. Do not sacrifice slot eligibility or required training coverage merely to avoid cross-day repetition.',
  );
  rules.push(
    `STRICT EQUIPMENT BOUNDARY: Athlete ONLY has access to: ${formatList(input.equipment, 'bodyweight')}. NEVER prescribe exercises requiring equipment outside this list.`,
  );

  rules.push(
    'CRITICAL MANDATE: For every exercise, masterExerciseId MUST match an ID from the Approved Candidate Catalog verbatim. Do not invent exercises outside the catalog.',
  );
  rules.push(`prefer movements ${requiredMovementPatternText}`);
  rules.push(
    'Prefer green candidates; use at most one amber candidate per day and include its required modification verbatim in notes',
  );

  const dayBlueprints = Array.from({ length: input.frequencyDays }, (_, i) => {
    const dayNumber = i + 1;
    const dayType = getDayTrainingType(dayNumber, input.frequencyDays);
    const blueprint = getDaySlotBlueprint(dayType, dayNumber, sizing.sessionMinutes);
    const dayTypeLabel =
      dayType === 'upper'
        ? 'Upper Body'
        : dayType === 'lower'
          ? 'Lower Body'
          : dayType === 'full_body'
            ? 'Full Body'
            : 'General';
    return `  - Day ${dayNumber} (${dayTypeLabel}) Blueprint (${blueprint.slotCount} slots, ${blueprint.targetWorkingSets} working sets):\n${blueprint.slots.map((s) => `    * Slot ${s.slot}: ${s.label} — ${s.description}`).join('\n')}`;
  });

  rules.push(
    `CRITICAL SESSION DURATION & SLOT ARCHITECTURE: The athlete selected a target workout duration of ${sizing.sessionMinutes} minutes. Every training day MUST strictly follow its assigned ${baseBlueprint.slotCount}-slot blueprint (${baseBlueprint.targetWorkingSets} working sets per day):\n${dayBlueprints.join('\n')}`,
  );
  rules.push(
    `CRITICAL EXERCISE COUNT: Every day MUST contain exactly ${baseBlueprint.slotCount} exercises, fulfilling Slots 1 through ${baseBlueprint.slotCount}.`,
  );

  const { preferredPromptCandidateCount } = getPromptCandidateTargets(
    input.frequencyDays,
    sizing.sessionMinutes,
  );
  const promptCandidateCount = Math.min(candidates.length, preferredPromptCandidateCount);
  const promptCandidates = candidates.slice(0, promptCandidateCount);
  const unifiedCatalog = buildUnifiedApprovedCandidateCatalog(promptCandidates);

  const bmi =
    input.heightCm && input.weightKg
      ? (input.weightKg / Math.pow(input.heightCm / 100, 2)).toFixed(1)
      : undefined;

  const biometricsText = `Athlete Biometrics: Age ${input.age ?? 'unspecified'}; Sex ${input.sex ?? 'unspecified'}; Stature ${input.heightCm ? input.heightCm + 'cm' : 'unspecified'}, ${input.weightKg ? input.weightKg + 'kg' : 'unspecified'}${bmi ? ' (BMI ' + bmi + ')' : ''}; Experience ${input.experienceLevel}`;

  const lifestyleText =
    input.lifestyle === 'desk_job'
      ? 'Occupational context: prolonged sitting. Program balanced posterior chain engagement and hip extension.'
      : `Occupational Lifestyle: ${input.lifestyle ?? 'unspecified'}`;

  const clinicalProfileLines: string[] = [
    `Profile: goals ${orderedGoals.join(' > ')}; level ${input.experienceLevel}; ${input.frequencyDays} days/week; session duration ${formatSessionDuration(sizing.sessionMinutes)}; equipment ${formatList(input.equipment, 'bodyweight')}; limits ${formatList(input.limitations, 'none')}; posture ${formatList(postureFlags, 'none')}.`,
    biometricsText,
    lifestyleText,
  ];

  if (input.archetype) {
    clinicalProfileLines.push(`Training Archetype: ${input.archetype}`);
  }

  if (input.considerations && input.considerations.length > 0) {
    const formattedConsiderations = input.considerations
      .map((c) => (c.side ? `${c.code} (${c.severity}, ${c.side})` : `${c.code} (${c.severity})`))
      .join(', ');
    clinicalProfileLines.push(`Clinical Considerations: ${formattedConsiderations}`);
  }

  const clinicalProfile = clinicalProfileLines.join('\n');

  return `You are a safety-first senior physiotherapist and strength coach.
Generate a high-quality, customized workout plan in JSON format.

${clinicalProfile}

STRICT GENERATION RULES:
${rules.map((rule, idx) => `${idx + 1}. ${rule}`).join('\n')}

Approved Candidate Catalog: ${JSON.stringify(unifiedCatalog)}

JSON OUTPUT SPECIFICATION:
Return a JSON object containing a "days" array where each day object has:
- "dayIndex": integer (1 to ${input.frequencyDays})
- "name": string (e.g., "Day 1: Upper Body Focus")
- "focus": string (e.g., "Strength and Hypertrophy")
- "exercises": array of ${baseBlueprint.slotCount} exercise objects (corresponding to Slots 1 through ${baseBlueprint.slotCount}), each containing:
  - "slot": integer (1 to ${baseBlueprint.slotCount})
  - "masterExerciseId": string (MUST match an ID from the Approved Candidate Catalog verbatim)
  - "notes": optional string guidance (MUST include required modification if an amber candidate is selected)

Day-level name and focus are required. Do not output exercise-level name, movementPattern, sets, reps, restSeconds, or estimatedDurationMinutes; these will be deterministically populated from the catalog.
OUTPUT ONLY VALID JSON MATCHING THIS SPECIFICATION.`;
}
