import { z } from 'zod';
import {
  workoutPlanStrictSchema,
  workoutPlanDaySchema,
  workoutPlanExerciseSchema,
} from './workout-plan-contract';

export const DISCLAIMER = 'Educational fitness recommendations only. Not medical advice.' as const;

export const movementPatterns = [
  'squat',
  'hinge',
  'push',
  'pull',
  'lunge',
  'carry',
  'core',
  'mobility',
] as const;

export const MovementPatternSchema = z.enum(movementPatterns);

export const WorkoutExerciseSchema = workoutPlanExerciseSchema;
export const WorkoutDaySchema = workoutPlanDaySchema;

export const workoutPlanSchema = workoutPlanStrictSchema;

export const WorkoutPlanSchema = workoutPlanSchema;

export type MovementPattern = z.infer<typeof MovementPatternSchema>;
export type WorkoutExercise = z.infer<typeof WorkoutExerciseSchema>;
export type WorkoutDay = z.infer<typeof WorkoutDaySchema>;
export type WorkoutPlan = z.infer<typeof workoutPlanSchema>;
