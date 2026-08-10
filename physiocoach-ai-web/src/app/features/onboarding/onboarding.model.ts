export interface AssessmentPayload {
  goals: string[];
  frequencyDays: number;
  equipment: string[];
  considerations: AssessmentConsideration[];
  limitations: string[];
  postureFlags: string[];
}

export interface AssessmentConsideration {
  code: string;
  severity: 'mild' | 'moderate' | 'severe';
  side: 'left' | 'right' | 'bilateral' | 'unspecified';
  notes?: string;
  inferred: boolean;
}

export interface BodyConsiderationOption {
  code: string;
  displayName: string;
  groupCode: string;
  bodyRegion: string;
  kind: string;
  severityEnabled: boolean;
}

export interface ProfilePayload {
  age: number;
  sex: string;
  heightCm: number;
  weightKg: number;
  bodyFatEstimate?: number;
  lifestyle: string;
  experienceLevel: string;
}

export interface ProfileResponse {
  data: ProfilePayload | null;
}

export interface WorkoutExercise {
  id: string;
  masterExerciseId?: string | null;
  name: string;
  muscleGroup: string;
  movementPattern: string;
  sets: number;
  reps: string;
  rpe?: number;
  restSeconds?: number;
  notes?: string;
}

export interface PlanProgression {
  baselineIntensity: string;
  progressionRule: string;
  increasePercent: number;
  conditions: string[];
}

export interface WorkoutDay {
  dayNumber: number;
  name: string;
  focus: string;
  exercises: WorkoutExercise[];
}

export interface GeneratedWorkoutPlan {
  schemaVersion: '1.0';
  source: 'ai' | 'fallback' | 'repaired';
  days: WorkoutDay[];
  progression: PlanProgression;
  safetyNotes: string[];
  warnings: string[];
}

export interface GeneratePlanResponse {
  data: {
    id: string;
    source: 'ai' | 'fallback' | 'repaired';
    model: string;
    plan: GeneratedWorkoutPlan;
    warnings: string[];
    createdAt: string;
    cached: boolean;
    inputHash: string;
  };
}

export interface CurrentPlanResponse {
  data: null | {
    id: string;
    source: 'ai' | 'fallback' | 'repaired';
    model: string;
    plan: GeneratedWorkoutPlan;
    warnings: string[];
    createdAt: string;
    cached: boolean;
    inputHash: string;
  };
}

export interface DeleteCurrentPlanResponse {
  data: null | {
    id: string;
    deleted: true;
  };
}

export interface OnboardingState {
  age: number | null;
  sex: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bodyFatEstimate?: number;
  lifestyle: string | null;
  experienceLevel: string | null;
  goals: string[];
  frequencyDays: number | null;
  equipment: string[];
  limitations: string[];
  postureFlags: string[];
  considerations: AssessmentConsideration[];
}

export interface GenerationSnapshot {
  inputHash: string;
  assessment: AssessmentPayload & { frequencyDays: number };
  profile: ProfilePayload;
  updatedAt: string;
}
