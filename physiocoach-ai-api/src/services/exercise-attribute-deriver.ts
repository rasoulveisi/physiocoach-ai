export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'push'
  | 'pull'
  | 'lunge'
  | 'carry'
  | 'core'
  | 'mobility'
  | 'unclassified';
export type LoadLevel = 'low' | 'moderate' | 'high';
export type TechnicalComplexity = 'beginner' | 'intermediate' | 'advanced';

export interface ExerciseAttributeInput {
  name: string;
  instructions?: string;
  target?: string;
  primaryMuscle?: string;
  muscleGroup?: string;
  secondaryMuscles?: string[];
  equipment?: string;
  bodyPart?: string;
}

export interface DerivedExerciseAttributes {
  movementPattern: MovementPattern;
  loadedRegions: string[];
  impactLevel: LoadLevel;
  spinalLoad: LoadLevel;
  balanceDemand: LoadLevel;
  technicalComplexity: TechnicalComplexity;
  overhead: boolean;
  behindNeck: boolean;
  deepFlexion: boolean;
  explosive: boolean;
  unilateral: boolean;
  rotational: boolean;
  inverted: boolean;
}

export const derivedExerciseAttributesSchema = z
  .object({
    movementPattern: z.enum([
      'squat',
      'hinge',
      'push',
      'pull',
      'lunge',
      'carry',
      'core',
      'mobility',
      'unclassified',
    ]),
    loadedRegions: z.array(z.string()),
    impactLevel: z.enum(['low', 'moderate', 'high']),
    spinalLoad: z.enum(['low', 'moderate', 'high']),
    balanceDemand: z.enum(['low', 'moderate', 'high']),
    technicalComplexity: z.enum(['beginner', 'intermediate', 'advanced']),
    overhead: z.boolean(),
    behindNeck: z.boolean(),
    deepFlexion: z.boolean(),
    explosive: z.boolean(),
    unilateral: z.boolean(),
    rotational: z.boolean(),
    inverted: z.boolean(),
  })
  .strict();

function normalizedExerciseText(exercise: ExerciseAttributeInput): string {
  return [
    exercise.name,
    exercise.instructions,
    exercise.target,
    exercise.primaryMuscle,
    exercise.muscleGroup,
    ...(exercise.secondaryMuscles ?? []),
    exercise.equipment,
    exercise.bodyPart,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[-_/]+/g, ' ');
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function deriveMovementPattern(text: string): MovementPattern {
  if (has(text, /\b(push jerk|jerk)\b/)) return 'push';
  if (has(text, /\bthruster\b/)) return 'squat';
  if (has(text, /\b(hang clean|power clean|clean and jerk|clean|snatch|kettlebell swing)\b/))
    return 'hinge';
  if (has(text, /\bhigh pull\b/)) return 'pull';
  if (has(text, /\b(squat|sissy squat|goblet squat|front squat|back squat)\b/)) return 'squat';
  if (has(text, /\b(lunge|split squat|step up)\b/)) return 'lunge';
  if (has(text, /\b(deadlift|good morning|hip thrust|glute bridge|romanian)\b/)) return 'hinge';
  if (has(text, /\b(row|pull up|pulldown|pull down|curl)\b/)) return 'pull';
  if (has(text, /\b(press|push up|dip|fly)\b/)) return 'push';
  if (has(text, /\b(carry|farmer.s walk|suitcase walk)\b/)) return 'carry';
  if (has(text, /\b(stretch|mobility|roll|flexibility)\b/)) return 'mobility';
  if (has(text, /\b(plank|crunch|sit up|leg raise|bird dog|dead bug)\b/)) return 'core';
  return 'unclassified';
}

/** Derives conservative, explainable movement attributes from published exercise metadata. */
export function deriveExerciseAttributes(
  exercise: ExerciseAttributeInput,
): DerivedExerciseAttributes {
  const text = normalizedExerciseText(exercise);
  const movementPattern = deriveMovementPattern(text);
  const behindNeck = has(text, /\b(behind|back of) (the )?neck\b|\bneck press\b/);
  const overhead =
    behindNeck ||
    has(
      text,
      /\b(overhead|over head|military press|shoulder press|push jerk|jerk|snatch|thruster)\b/,
    );
  const explosive = has(
    text,
    /\b(jump|jumping|explosive|ballistic|clean and jerk|hang clean|power clean|clean|snatch|plyometric|push jerk|jerk|thruster|kettlebell swing|high pull)\b/,
  );
  const unilateral = has(
    text,
    /\b(single arm|one arm|single leg|one leg|unilateral|alternating)\b/,
  );
  const inverted = has(text, /\b(handstand|inverted|upside down)\b/);
  const rotational = has(text, /\b(rotation|rotational|twist|wood chop|russian twist)\b/);
  const deepFlexion = has(text, /\b(deep squat|ass to grass|full squat|deep lunge|sissy squat)\b/);
  const loaded = has(
    text,
    /\b(barbell|dumbbell|kettlebell|cable|machine|weighted|weight plate|lever)\b/,
  );
  const landing = has(text, /\b(land|landing|jump|jumping|plyometric)\b/);
  const loadedRegions = new Set<string>();

  if (
    movementPattern === 'squat' ||
    movementPattern === 'lunge' ||
    has(text, /\b(quad|knee|leg extension|step up)\b/)
  )
    loadedRegions.add('knee');
  if (
    movementPattern === 'squat' ||
    movementPattern === 'lunge' ||
    movementPattern === 'hinge' ||
    has(text, /\b(glute|hamstring|hip|adductor|abductor)\b/)
  )
    loadedRegions.add('hip');
  if (
    movementPattern === 'hinge' ||
    movementPattern === 'carry' ||
    has(text, /\b(back|spine|erector|deadlift|good morning)\b/)
  )
    loadedRegions.add('spine');
  if (
    movementPattern === 'push' ||
    movementPattern === 'pull' ||
    overhead ||
    has(text, /\b(shoulder|delt|rotator cuff)\b/)
  )
    loadedRegions.add('shoulder');
  if (has(text, /\b(elbow|tricep|bicep|curl)\b/)) loadedRegions.add('elbow');
  if (has(text, /\b(wrist|forearm|grip)\b/)) loadedRegions.add('wrist_hand');
  if (has(text, /\b(ankle|calf|jump|landing)\b/)) loadedRegions.add('ankle_foot');
  if (has(text, /\b(neck|cervical)\b/)) loadedRegions.add('neck');

  const spinalLoad: LoadLevel = has(
    text,
    /\b(barbell back squat|back squat.*barbell|deadlift|good morning|barbell overhead press|barbell shoulder press|military press|axial load)\b/,
  )
    ? 'high'
    : movementPattern === 'hinge' || movementPattern === 'carry' || loaded
      ? 'moderate'
      : 'low';
  const balanceDemand: LoadLevel =
    inverted || has(text, /\b(balance|bosu|unstable|single leg|one leg)\b/)
      ? 'high'
      : unilateral
        ? 'moderate'
        : 'low';
  const technicalComplexity: TechnicalComplexity = has(
    text,
    /\b(snatch|clean and jerk|hang clean|power clean|clean|push jerk|jerk|thruster|kettlebell swing|high pull|handstand|turkish get up|advanced ballistic)\b/,
  )
    ? 'advanced'
    : explosive || unilateral || overhead || rotational
      ? 'intermediate'
      : 'beginner';

  return {
    movementPattern,
    loadedRegions: [...loadedRegions].sort(),
    impactLevel: landing ? 'high' : explosive ? 'moderate' : 'low',
    spinalLoad,
    balanceDemand,
    technicalComplexity,
    overhead,
    behindNeck,
    deepFlexion,
    explosive,
    unilateral,
    rotational,
    inverted,
  };
}
import { z } from 'zod';
