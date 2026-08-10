import { type GeneratedWorkoutPlan } from '../onboarding/onboarding.model';

export interface WorkoutExerciseView {
  id: string;
  masterExerciseId?: string | null;
  name: string;
  muscleGroup: string;
  movementPattern: string;
  sets: number;
  reps: string;
  rpe?: number;
  notes?: string;
  restSeconds?: number;
}

export interface WorkoutDayView {
  dayNumber: number;
  name: string;
  focus: string;
  exercises: WorkoutExerciseView[];
}

export interface WorkoutPlanView {
  id: string;
  source: 'ai' | 'fallback' | 'repaired';
  model: string;
  createdAt: string;
  cached: boolean;
  inputHash: string;
  plan: GeneratedWorkoutPlan;
}
