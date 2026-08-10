export interface ExerciseSafetyNotes {
  tips: string[];
}

const FALLBACK_SAFETY_NOTES: ExerciseSafetyNotes = {
  tips: ['Use a weight you can control from start to finish.'],
};

const KEY_GOBLET_SQUAT = 'goblet squat';
const KEY_LAT_PULLDOWN = 'lat pulldown';
const KEY_BARBELL_ROW = 'chest supported row';
const KEY_ROMANIAN_DEADLIFT = 'romanian deadlift';
const KEY_HIP_THRUST = 'hip thrust';

const EXERCISE_SAFETY_NOTES: Record<string, ExerciseSafetyNotes> = {
  [KEY_GOBLET_SQUAT]: {
    tips: ['Keep torso upright and knees tracking over toes.', 'Move with control through full range of motion.'],
  },
  [KEY_LAT_PULLDOWN]: {
    tips: ['Keep shoulders depressed and avoid shrugging.', 'Pull toward ribs, not behind the neck.'],
  },
  'lat pull down': {
    tips: ['Keep shoulders depressed and avoid shrugging.', 'Pull toward ribs, not behind the neck.'],
  },
  [KEY_BARBELL_ROW]: {
    tips: ['Keep chest supported on the bench.', 'Pause briefly at top contraction.'],
  },
  'chest-support row': {
    tips: ['Keep chest supported on the bench.', 'Pause briefly at top contraction.'],
  },
  [KEY_ROMANIAN_DEADLIFT]: {
    tips: ['Hinge at hips, not lower back.', 'Use a neutral spine through the whole rep.'],
  },
  'db rdl': {
    tips: ['Hinge at hips, not lower back.', 'Use a neutral spine through the whole rep.'],
  },
  [KEY_HIP_THRUST]: {
    tips: ['Keep core braced and avoid overarch at top.'],
  },
};

const normalizeExerciseName = (value: string): string =>
  (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export const resolveExerciseSafetyNotes = (name: string): ExerciseSafetyNotes => {
  const normalizedName = normalizeExerciseName(name);

  return Object.prototype.hasOwnProperty.call(EXERCISE_SAFETY_NOTES, normalizedName)
    ? EXERCISE_SAFETY_NOTES[normalizedName]
    : FALLBACK_SAFETY_NOTES;
};
