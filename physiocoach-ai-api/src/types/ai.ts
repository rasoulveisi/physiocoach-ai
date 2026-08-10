import type { ZodType } from 'zod';

export type ConsiderationSeverity = 'mild' | 'moderate' | 'severe';

/** The active, severity-specific consideration selected for the current generation. */
export interface WorkoutPlanConsideration {
  code: string;
  severity: ConsiderationSeverity;
}

export interface GenerateWorkoutPlanRequest {
  prompt: string;
  primaryModel?: string;
  fallbackModels?: string[];
  timeoutMs?: number;
}

export interface AIProviderOptions {
  forceFresh?: boolean;
}

export interface AITextResponse {
  text: string;
  model: string;
}

export interface AIStructuredResponse<T> {
  model: string;
  payload: T;
  metadata?: {
    attempts?: number;
    providerRequestId?: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    providerRawResponse?: unknown;
  };
}

export interface AIStructuredResponseFormat {
  name: string;
  strict: boolean;
  schema: object;
}

export interface GenerateStructuredRequest<T> {
  task: string;
  inputHash: string;
  prompt: string;
  schema: ZodType<T>;
  responseFormat?: AIStructuredResponseFormat;
  primaryModel?: string;
  fallbackModels?: string[];
  timeoutMs?: number;
  options?: AIProviderOptions;
}

export interface AIProvider {
  generateWorkoutPlan(request: GenerateWorkoutPlanRequest): Promise<AITextResponse>;
  generateStructured<T>(request: GenerateStructuredRequest<T>): Promise<AIStructuredResponse<T>>;
}

export type PostureFlags = {
  roundedShoulders?: boolean;
  shoulderPain?: boolean;
  kneePain?: boolean;
  lowerBackPain?: boolean;
  neckPain?: boolean;
  forwardHeadPain?: boolean;
  tightHips?: boolean;
  anteriorPelvicTilt?: boolean;
  lowerBackDiscomfort?: boolean;
};

export interface SafetyContext {
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  limitations: string[];
  postureFlags: PostureFlags;
}

export interface WorkoutPlanGenerationContext extends SafetyContext {
  goal: string;
  goals?: readonly string[];
  frequencyDays: number;
  sessionMinutes?: number;
  equipment: readonly string[];
  age?: number;
  sex?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  heightCm?: number;
  weightKg?: number;
  bodyFatEstimate?: number;
  lifestyle?: 'desk_job' | 'standing_job' | 'active';
  considerations?: readonly WorkoutPlanConsideration[];
}

export interface WorkoutPlanPromptInputs {
  userGoal: string;
  goals?: readonly string[];
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  frequencyDays: number;
  age?: number;
  sex?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  heightCm?: number;
  weightKg?: number;
  bodyFatEstimate?: number;
  lifestyle?: 'desk_job' | 'standing_job' | 'active';
  equipment: readonly string[];
  limitations: readonly string[];
  postureFlags: readonly string[];
  sessionMinutes?: number;
}

export interface WorkoutPlanPromptContract {
  task: 'workout_plan_generation';
  promptVersion: string;
  outputSchemaVersion: string;
  context: WorkoutPlanPromptInputs & {
    equipment: readonly string[];
    limitations: readonly string[];
    postureFlags: readonly string[];
  };
  mustIncludeDisclaimer: string;
  generationRunHint: string;
  constraints: readonly string[];
}
