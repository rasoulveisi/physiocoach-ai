import type { WorkoutPlan } from './workout';

export type WeightUnit = 'kg' | 'lb';

export interface ProgressionInput {
  currentWeight: number;
  achievedReps: number;
  targetRepRange: {
    min: number;
    max: number;
  };
  achievedRpe: number;
  targetRpe: number;
  unit?: WeightUnit;
}

export interface ProgressionSuggestion {
  nextWeight: number;
  reason: string;
}

export type LimitationRiskName =
  'rounded_shoulders' | 'shoulder_pain' | 'knee_pain' | 'lower_back_pain' | 'neck_pain';

export interface PostureFlags {
  roundedShoulders?: boolean;
  shoulderPain?: boolean;
  kneePain?: boolean;
  lowerBackPain?: boolean;
  neckPain?: boolean;
}

export interface SafetyContext {
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  limitations: string[];
  postureFlags: PostureFlags;
}

export interface SafetyResult {
  ok: boolean;
  correctedPlan: WorkoutPlan;
  warnings: string[];
  corrections: string[];
}
