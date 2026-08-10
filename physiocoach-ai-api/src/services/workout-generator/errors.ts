import type { WorkoutPlanGenerationFailureDetails } from '../../types/workout-generator';

export class WorkoutPlanGenerationError extends Error {
  readonly code = 'workout_plan_generation_failed';

  constructor(
    message: string,
    public readonly details: WorkoutPlanGenerationFailureDetails,
    cause?: unknown,
  ) {
    super(message);
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
    this.name = 'WorkoutPlanGenerationError';
  }
}
