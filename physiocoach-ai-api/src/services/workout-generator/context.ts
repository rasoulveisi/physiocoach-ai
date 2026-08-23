import { z } from 'zod';
import { createInputHash } from '../input-hash';
import { WORKOUT_PLAN_PROMPT_VERSION } from '../../types/workout-plan-contract';
import {
  assessmentInputSchema,
  legacySafetyContextFromConsiderations,
  resolveAssessmentConsiderations,
} from '../../types/assessment';
import { profileInputSchema } from '../../types/profile';
import type { WorkoutPlanContext, PostureFlags } from '../../types/workout-generator';

export const generatePlanInputSchema = z
  .object({
    profile: profileInputSchema.optional(),
    assessment: assessmentInputSchema,
  })
  .strict();

export type GeneratePlanInput = z.input<typeof generatePlanInputSchema>;

export async function buildPlanInputHash(input: GeneratePlanInput): Promise<string> {
  const considerations = resolveAssessmentConsiderations(input.assessment);
  const legacySafety = legacySafetyContextFromConsiderations(considerations);
  return createInputHash({
    promptVersion: WORKOUT_PLAN_PROMPT_VERSION,
    profile: input.profile,
    assessment: {
      ...input.assessment,
      limitations: legacySafety.limitations,
      postureFlags: legacySafety.postureFlags,
      considerations: considerations
        .map(({ code, severity, side }) => ({ code, severity, side }))
        .sort((a, b) =>
          `${a.code}:${a.severity}:${a.side}`.localeCompare(`${b.code}:${b.severity}:${b.side}`),
        ),
    },
  });
}

export function buildWorkoutPlanContext(input: GeneratePlanInput): WorkoutPlanContext {
  if (!input.profile) {
    throw new Error('Profile is required to build workout context.');
  }

  const considerations = resolveAssessmentConsiderations(input.assessment);
  const legacySafety = legacySafetyContextFromConsiderations(considerations);

  return {
    goal: input.assessment.goals[0] ?? 'posture_improvement',
    goals: input.assessment.goals,
    frequencyDays: input.assessment.frequencyDays,
    ...(typeof input.assessment.sessionMinutes === 'number'
      ? { sessionMinutes: input.assessment.sessionMinutes }
      : {}),
    equipment: input.assessment.equipment,
    experienceLevel: input.profile.experienceLevel,
    limitations: legacySafety.limitations ?? [],
    postureFlags: mapPostureFlags(legacySafety.postureFlags ?? [], legacySafety.limitations ?? []),
    considerations: considerations.map(({ code, severity }) => ({ code, severity })),
    ...(typeof input.profile.age === 'number' ? { age: input.profile.age } : {}),
    ...(typeof input.profile.sex === 'string' ? { sex: input.profile.sex } : {}),
    ...(typeof input.profile.heightCm === 'number' ? { heightCm: input.profile.heightCm } : {}),
    ...(typeof input.profile.weightKg === 'number' ? { weightKg: input.profile.weightKg } : {}),
    ...(typeof input.profile.bodyFatEstimate === 'number'
      ? { bodyFatEstimate: input.profile.bodyFatEstimate }
      : {}),
    ...(typeof input.profile.lifestyle === 'string' ? { lifestyle: input.profile.lifestyle } : {}),
  };
}

export function mapPostureFlags(postureFlags: string[], limitations: string[]): PostureFlags {
  const values = new Set([...postureFlags, ...limitations]);

  return {
    roundedShoulders: values.has('rounded_shoulders'),
    shoulderPain: values.has('shoulder_pain'),
    kneePain: values.has('knee_pain'),
    lowerBackPain: values.has('lower_back_pain') || values.has('lower_back_discomfort'),
    neckPain: values.has('neck_pain') || values.has('forward_head'),
  };
}
