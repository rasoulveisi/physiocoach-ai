export interface ExerciseLogDto {
  id: string;
  exerciseName: string;
  movementPattern: string;
  muscleGroups: string[];
  setIndex: number;
  targetReps?: string | null;
  masterExerciseId?: string | null;
  reps: number;
  weightKg: number;
  rpe?: number | null;
  completed: boolean;
  notes?: string | null;
}

export interface ExerciseLogGroup {
  key: string;
  name: string;
  masterExerciseId?: string | null;
  movementPattern: string;
  muscleGroups: string[];
  targetReps?: string | null;
  notes?: string | null;
  logs: ExerciseLogDto[];
}

export interface WorkoutSessionDto {
  id: string;
  workoutPlanId: string;
  dayIndex: number;
  status: 'active' | 'completed';
  scheduledDate: string;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  progress: {
    completedSets: number;
    totalSets: number;
  };
  logs: ExerciseLogDto[];
}

export interface CreateSessionPayload {
  workoutPlanId: string;
  dayIndex: number;
  scheduledDate: string;
}

export interface SaveSetLogPayload {
  reps: number;
  weightKg: number;
  rpe?: number;
  completed: boolean;
  notes?: string;
}
