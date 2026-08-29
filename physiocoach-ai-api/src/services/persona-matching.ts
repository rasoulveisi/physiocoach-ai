/**
 * Persona Matching Evaluation Service
 *
 * Deterministically evaluates movement patterns, muscle group volumes, and exercise
 * selections in a workout plan to match intelligent clinical and athletic personas.
 */

export interface PersonaEvaluationResult {
  personas: string[];
  targetAudience: string;
  jointTags: string[];
}

interface PlanExercise {
  id?: string;
  name?: string;
  exerciseName?: string;
  movementPattern?: string;
  muscleGroup?: string;
  muscleGroups?: string[];
  sets?: number | unknown[];
  notes?: string;
}

interface PlanDay {
  name?: string;
  focus?: string;
  exercises?: PlanExercise[];
}

interface PlanInput {
  name?: string;
  title?: string;
  description?: string;
  split?: string;
  scheduleType?: string;
  frequencyDays?: number;
  equipment?: string[];
  days?: PlanDay[];
}

function countSets(ex: PlanExercise): number {
  if (typeof ex.sets === 'number') return ex.sets;
  if (Array.isArray(ex.sets)) return ex.sets.length;
  return 3;
}

function normalize(str: string | undefined): string {
  return (str || '').toLowerCase().trim();
}

export function evaluatePlanPersonas(rawPlan: unknown): PersonaEvaluationResult {
  const plan = (rawPlan && typeof rawPlan === 'object' ? rawPlan : {}) as PlanInput;
  const days: PlanDay[] = Array.isArray(plan.days) ? plan.days : [];

  let totalSets = 0;
  let pushSets = 0;
  let pullSets = 0;
  let squatSets = 0;
  let hingeSets = 0;
  let lungeSets = 0;
  let coreSets = 0;
  let mobilitySets = 0;

  const muscleSets: Record<string, number> = {};
  const exerciseNames: string[] = [];

  for (const day of days) {
    const exercises = Array.isArray(day.exercises) ? day.exercises : [];
    for (const ex of exercises) {
      const sets = countSets(ex);
      totalSets += sets;

      const name = normalize(ex.name || ex.exerciseName);
      if (name) exerciseNames.push(name);

      const pattern = normalize(ex.movementPattern);
      if (pattern.includes('push')) pushSets += sets;
      else if (pattern.includes('pull')) pullSets += sets;
      else if (pattern.includes('squat')) squatSets += sets;
      else if (pattern.includes('hinge')) hingeSets += sets;
      else if (pattern.includes('lunge')) lungeSets += sets;
      else if (pattern.includes('core')) coreSets += sets;
      else if (pattern.includes('mobility') || pattern.includes('carry')) mobilitySets += sets;

      const primaryMuscle = normalize(
        ex.muscleGroup || (Array.isArray(ex.muscleGroups) ? ex.muscleGroups[0] : ''),
      );
      if (primaryMuscle) {
        muscleSets[primaryMuscle] = (muscleSets[primaryMuscle] || 0) + sets;
      }
    }
  }

  const allNamesJoined = exerciseNames.join(' ');
  const matchedPersonas: string[] = [];
  const jointTags: string[] = [];

  const backVolume = (muscleSets['back'] || 0) + (muscleSets['lats'] || 0) + (muscleSets['upper_back'] || 0);
  const chestVolume = muscleSets['chest'] || 0;
  const hamstringGluteVolume = (muscleSets['hamstrings'] || 0) + (muscleSets['glutes'] || 0);
  const quadVolume = muscleSets['quads'] || 0;

  // 1. Desk Workers with Lower Back Discomfort / Posture
  const hasDeskWorkFocus =
    pullSets >= pushSets ||
    backVolume >= chestVolume ||
    coreSets + mobilitySets >= 2 ||
    allNamesJoined.includes('row') ||
    allNamesJoined.includes('face pull') ||
    allNamesJoined.includes('deadbug') ||
    allNamesJoined.includes('bird dog') ||
    allNamesJoined.includes('plank');

  if (hasDeskWorkFocus) {
    matchedPersonas.push('Desk Workers with Lower Back Discomfort');
    jointTags.push('Low Spine Load');
  }

  // 2. Knee-Friendly Hypertrophy
  const hasKneeFriendlyFocus =
    hingeSets + lungeSets >= squatSets ||
    hamstringGluteVolume >= quadVolume ||
    allNamesJoined.includes('rdl') ||
    allNamesJoined.includes('romanian') ||
    allNamesJoined.includes('hip thrust') ||
    allNamesJoined.includes('box squat') ||
    allNamesJoined.includes('split squat') ||
    allNamesJoined.includes('curl');

  if (hasKneeFriendlyFocus) {
    matchedPersonas.push('Knee-Friendly Hypertrophy');
    jointTags.push('Knee-Friendly');
  }

  // 3. Shoulder-Safe Strength
  const hasShoulderSafeFocus =
    pullSets >= pushSets ||
    allNamesJoined.includes('dumbbell') ||
    allNamesJoined.includes('incline') ||
    allNamesJoined.includes('neutral') ||
    allNamesJoined.includes('face pull') ||
    allNamesJoined.includes('lateral raise') ||
    !allNamesJoined.includes('behind neck');

  if (hasShoulderSafeFocus) {
    matchedPersonas.push('Shoulder-Safe Strength');
    jointTags.push('Shoulder-Safe');
  }

  // 4. Minimal Equipment Longevity
  const hasMinimalEquipment =
    allNamesJoined.includes('dumbbell') ||
    allNamesJoined.includes('bodyweight') ||
    allNamesJoined.includes('band') ||
    allNamesJoined.includes('push-up') ||
    allNamesJoined.includes('pull-up');

  if (hasMinimalEquipment) {
    matchedPersonas.push('Minimal Equipment Longevity');
  }

  // 5. Post-Rehab Foundation
  if ((totalSets <= 45 && days.length <= 4) || mobilitySets >= 2) {
    matchedPersonas.push('Post-Rehab Foundation');
    if (!jointTags.includes('Thoracic Mobility')) {
      jointTags.push('Thoracic Mobility');
    }
  }

  // Fallbacks to guarantee 2-3 rich personas
  if (matchedPersonas.length < 2) {
    matchedPersonas.push('All-Round Athletic Conditioning');
  }
  if (matchedPersonas.length < 3) {
    matchedPersonas.push('Community Hypertrophy & Longevity');
  }

  // Ensure joint tags have default if empty
  if (jointTags.length === 0) {
    jointTags.push('AI Personalized', 'Active Plan');
  }

  const primaryPersonas = matchedPersonas.slice(0, 3);
  const targetAudience = `Suitable for ${primaryPersonas.slice(0, 2).join(' and ')} seeking structured joint-safe progression.`;

  return {
    personas: primaryPersonas,
    targetAudience,
    jointTags: Array.from(new Set(jointTags)),
  };
}
