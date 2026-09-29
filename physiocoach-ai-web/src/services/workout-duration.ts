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

export function parseRepCount(reps: string | number | undefined): {
  isTimed: boolean;
  seconds?: number;
  avgReps: number;
} {
  if (typeof reps === 'number' && Number.isFinite(reps) && reps > 0) {
    return { isTimed: false, avgReps: reps };
  }

  const str = String(reps || '').toLowerCase().trim();

  // Check for timed holds, e.g. "30s", "40 sec", "45 seconds", "1 min", "1.5 min"
  const minMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:min|minute|minutes)\b/);
  if (minMatch && minMatch[1]) {
    const mins = parseFloat(minMatch[1]);
    const secs = Math.min(180, Math.max(15, Math.round(mins * 60)));
    return { isTimed: true, seconds: secs, avgReps: 1 };
  }

  const secMatch = str.match(/(\d+)\s*(?:s|sec|secs|second|seconds)\b/);
  if (secMatch && secMatch[1]) {
    const secs = Math.min(180, Math.max(10, parseInt(secMatch[1], 10)));
    return { isTimed: true, seconds: secs, avgReps: 1 };
  }

  // Check for rep range: e.g. "5-8", "8-12", "12-15", "10-12"
  const rangeMatch = str.match(/(\d+)\s*[-–/]\s*(\d+)/);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    const low = parseInt(rangeMatch[1], 10);
    const high = parseInt(rangeMatch[2], 10);
    const avg = Math.round((low + high) / 2);
    return { isTimed: false, avgReps: Math.min(50, Math.max(1, avg)) };
  }

  // Check for single integer: e.g. "10", "12", "8 reps"
  const singleMatch = str.match(/(\d+)/);
  if (singleMatch && singleMatch[1]) {
    const count = parseInt(singleMatch[1], 10);
    return { isTimed: false, avgReps: Math.min(50, Math.max(1, count)) };
  }

  return { isTimed: false, avgReps: 10 };
}

export function isUnilateralExercise(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes('split squat') ||
    n.includes('step-up') ||
    n.includes('step up') ||
    n.includes('lunge') ||
    n.includes('single-leg') ||
    n.includes('single leg') ||
    n.includes('one-arm') ||
    n.includes('one arm') ||
    n.includes('single-arm') ||
    n.includes('single arm') ||
    n.includes('bulgarian') ||
    n.includes('pistol')
  );
}

export function calculateExerciseDuration(exercise: {
  sets?: number;
  reps?: string | number;
  restSeconds?: number;
  movementPattern?: string;
  name?: string;
}): ExerciseDurationDetails {
  const sets =
    typeof exercise.sets === 'number' && Number.isFinite(exercise.sets) && exercise.sets > 0
      ? exercise.sets
      : 3;

  const restPerSet =
    typeof exercise.restSeconds === 'number' &&
    Number.isFinite(exercise.restSeconds) &&
    exercise.restSeconds > 0
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

export function calculateWorkoutDayDuration(day: {
  dayNumber?: number;
  exercises?: Array<{
    sets?: number;
    reps?: string | number;
    restSeconds?: number;
    movementPattern?: string;
    name?: string;
  }>;
}): DayDurationDetails {
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

  const totalSeconds = totalWorkSeconds + totalRestSeconds + totalSetupSeconds + sessionBufferSeconds;
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

export function calculateWorkoutDayDurationMinutes(day: {
  exercises?: Array<{
    sets?: number;
    reps?: string | number;
    restSeconds?: number;
    movementPattern?: string;
    name?: string;
  }>;
}): number {
  return calculateWorkoutDayDuration(day).totalMinutes;
}
