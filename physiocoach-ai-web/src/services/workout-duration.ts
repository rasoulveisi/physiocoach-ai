/**
 * Workout Duration Calculation Service (Frontend)
 *
 * Provides realistic gym floor time estimation factoring in:
 * - Movement tempo and time under tension (TUT) by exercise type
 * - Unilateral movements (both limbs performed)
 * - Timed holds (e.g. "30s", "45s", "1 min") vs rep ranges ("5-8", "8-12", "15-20")
 * - True rest intervals between working sets
 * - Exercise station setup, plate loading, and warmup sets
 * - Session-level dynamic mobility warmup and cooldown buffers
 */

export interface ExerciseDurationDetails {
  sets: number;
  workPerSetSeconds: number;
  workSeconds: number;
  restSeconds: number;
  setupSeconds: number;
  totalSeconds: number;
}

export interface DayDurationDetails {
  dayNumber?: number;
  totalMinutes: number;
  workMinutes: number;
  restMinutes: number;
  transitionMinutes: number;
  warmupMinutes: number;
  exerciseCount: number;
  totalSets: number;
}

interface ExerciseDurationInput {
  sets?: number;
  reps?: string | number;
  restSeconds?: number;
  movementPattern?: string;
  name?: string;
}

interface WorkoutDayDurationInput {
  dayNumber?: number;
  exercises?: ExerciseDurationInput[];
}

function parseRepCount(reps: string | number | undefined): {
  isTimed: boolean;
  seconds?: number;
  avgReps: number;
} {
  if (typeof reps === 'number' && Number.isFinite(reps) && reps > 0) {
    return { isTimed: false, avgReps: reps };
  }

  const str = String(reps || '').toLowerCase().trim();

  // Timed holds: "1 min", "1.5 min", etc.
  const minMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:min|minute|minutes)\b/);
  if (minMatch?.[1]) {
    const secs = Math.min(180, Math.max(15, Math.round(parseFloat(minMatch[1]) * 60)));
    return { isTimed: true, seconds: secs, avgReps: 1 };
  }

  // Timed holds in seconds: "30s", "45 secs", etc.
  const secMatch = str.match(/(\d+)\s*(?:s|sec|secs|second|seconds)\b/);
  if (secMatch?.[1]) {
    const secs = Math.min(180, Math.max(10, parseInt(secMatch[1], 10)));
    return { isTimed: true, seconds: secs, avgReps: 1 };
  }

  // Rep range: "8-12", "5-8"
  const rangeMatch = str.match(/(\d+)\s*[-–/]\s*(\d+)/);
  if (rangeMatch?.[1] && rangeMatch[2]) {
    const avg = Math.round((parseInt(rangeMatch[1], 10) + parseInt(rangeMatch[2], 10)) / 2);
    return { isTimed: false, avgReps: Math.min(50, Math.max(1, avg)) };
  }

  // Single count: "10", "12 reps"
  const singleMatch = str.match(/(\d+)/);
  if (singleMatch?.[1]) {
    return { isTimed: false, avgReps: Math.min(50, Math.max(1, parseInt(singleMatch[1], 10))) };
  }

  return { isTimed: false, avgReps: 10 };
}

function isUnilateralExercise(name: string): boolean {
  const n = name.toLowerCase();
  return /split squat|step-?up|lunge|single-?(?:leg|arm)|one-?arm|bulgarian|pistol/.test(n);
}

function calculateExerciseDuration(exercise: ExerciseDurationInput): ExerciseDurationDetails {
  const sets = typeof exercise.sets === 'number' && exercise.sets > 0 ? exercise.sets : 3;
  const restPerSet =
    typeof exercise.restSeconds === 'number' && exercise.restSeconds > 0
      ? exercise.restSeconds
      : 60;
  const restSeconds = Math.max(0, sets - 1) * restPerSet;

  const name = (exercise.name || '').toLowerCase();
  const pattern = (exercise.movementPattern || '').toLowerCase();
  const repInfo = parseRepCount(exercise.reps);

  let workPerSetSeconds: number;

  if (repInfo.isTimed && typeof repInfo.seconds === 'number') {
    workPerSetSeconds = repInfo.seconds;
  } else {
    const isHeavyCompound =
      name.includes('barbell') ||
      pattern === 'squat' ||
      pattern === 'hinge' ||
      name.includes('deadlift') ||
      name.includes('squat');

    const isCore =
      pattern === 'core' ||
      name.includes('crunch') ||
      name.includes('sit-up') ||
      name.includes('knee raise');

    let secondsPerRep = 3.5;
    if (isHeavyCompound) {
      secondsPerRep = 4.0;
    } else if (isCore) {
      secondsPerRep = 2.5;
    } else if (pattern === 'mobility') {
      secondsPerRep = 3.0;
    }

    let calculatedWork = Math.round(repInfo.avgReps * secondsPerRep);
    if (isUnilateralExercise(name)) {
      calculatedWork = Math.round(calculatedWork * 1.85);
    }

    workPerSetSeconds = Math.min(120, Math.max(12, calculatedWork));
  }

  const workSeconds = sets * workPerSetSeconds;

  let setupSeconds = 60;
  if (name.includes('barbell') || pattern === 'squat' || pattern === 'hinge') {
    setupSeconds = 120;
  } else if (name.includes('cable') || name.includes('machine') || name.includes('press')) {
    setupSeconds = 75;
  } else if (name.includes('dumbbell')) {
    setupSeconds = 60;
  } else if (pattern === 'core' || pattern === 'mobility' || name.includes('bodyweight')) {
    setupSeconds = 30;
  }

  return {
    sets,
    workPerSetSeconds,
    workSeconds,
    restSeconds,
    setupSeconds,
    totalSeconds: workSeconds + restSeconds + setupSeconds,
  };
}

/**
 * Estimates duration in seconds for a single exercise
 */
export function estimateExerciseDurationSeconds(exercise: ExerciseDurationInput): number {
  return calculateExerciseDuration(exercise).totalSeconds;
}

/**
 * Calculates complete duration details for a workout day
 */
export function calculateWorkoutDayDuration(day: WorkoutDayDurationInput): DayDurationDetails {
  const exercises = Array.isArray(day.exercises) ? day.exercises : [];
  if (exercises.length === 0) {
    return {
      dayNumber: day.dayNumber,
      totalMinutes: 0,
      workMinutes: 0,
      restMinutes: 0,
      transitionMinutes: 0,
      warmupMinutes: 0,
      exerciseCount: 0,
      totalSets: 0,
    };
  }

  let totalWorkSeconds = 0;
  let totalRestSeconds = 0;
  let totalSetupSeconds = 0;
  let totalSets = 0;

  for (const exercise of exercises) {
    const details = calculateExerciseDuration(exercise);
    totalWorkSeconds += details.workSeconds;
    totalRestSeconds += details.restSeconds;
    totalSetupSeconds += details.setupSeconds;
    totalSets += details.sets;
  }

  const warmupSeconds = 240;
  const cooldownSeconds = 120;
  const sessionBufferSeconds = warmupSeconds + cooldownSeconds;

  const totalSeconds =
    totalWorkSeconds + totalRestSeconds + totalSetupSeconds + sessionBufferSeconds;
  const totalMinutes = Math.max(10, Math.round(totalSeconds / 60));

  return {
    dayNumber: day.dayNumber,
    totalMinutes,
    workMinutes: Math.round(totalWorkSeconds / 60),
    restMinutes: Math.round(totalRestSeconds / 60),
    transitionMinutes: Math.round(totalSetupSeconds / 60),
    warmupMinutes: Math.round(sessionBufferSeconds / 60),
    exerciseCount: exercises.length,
    totalSets,
  };
}

/**
 * Returns estimated duration in minutes for a workout day
 */
export function calculateWorkoutDayDurationMinutes(day: WorkoutDayDurationInput): number {
  return calculateWorkoutDayDuration(day).totalMinutes;
}

/**
 * Alias for calculateWorkoutDayDurationMinutes
 */
export const calculateWorkoutDuration = calculateWorkoutDayDurationMinutes;
