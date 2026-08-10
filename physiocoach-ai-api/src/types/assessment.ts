import { z } from 'zod';

export const assessmentConsiderationSchema = z
  .object({
    code: z.string().trim().min(1).max(120),
    severity: z.enum(['mild', 'moderate', 'severe']),
    side: z.enum(['left', 'right', 'bilateral', 'unspecified']).default('unspecified'),
    notes: z.string().trim().max(1_000).optional(),
    inferred: z.boolean().default(false),
  })
  .strict();

export type AssessmentConsideration = z.infer<typeof assessmentConsiderationSchema>;

type LegacyAssessmentInput = {
  limitations?: string[] | undefined;
  postureFlags?: string[] | undefined;
};

const legacyPostureAliases: Record<string, string> = {
  forward_head: 'forward_head_posture',
  tight_hips: 'limited_hip_mobility',
  lower_back_discomfort: 'lower_back_pain',
};

export function normalizeLegacyAssessmentConsiderations(
  input: LegacyAssessmentInput,
): AssessmentConsideration[] {
  const normalized = [
    ...(input.limitations ?? []).map((code) => ({
      code,
      severity: 'moderate' as const,
      side: 'unspecified' as const,
      inferred: true,
    })),
    ...(input.postureFlags ?? []).map((code) => ({
      code: legacyPostureAliases[code] ?? code,
      severity: 'mild' as const,
      side: 'unspecified' as const,
      inferred: true,
    })),
  ];
  const seenCodes = new Set<string>();
  return normalized.filter(({ code }) => {
    if (seenCodes.has(code)) return false;
    seenCodes.add(code);
    return true;
  });
}

export function resolveAssessmentConsiderations(input: {
  considerations?: Array<z.input<typeof assessmentConsiderationSchema>> | undefined;
  limitations?: string[] | undefined;
  postureFlags?: string[] | undefined;
}): AssessmentConsideration[] {
  if (input.considerations !== undefined) {
    return input.considerations!.map((consideration) => ({
      ...consideration,
      side: consideration.side ?? 'unspecified',
      inferred: consideration.inferred ?? false,
    }));
  }
  return normalizeLegacyAssessmentConsiderations(input);
}

export function legacySafetyContextFromConsiderations(
  considerations: readonly AssessmentConsideration[],
): Pick<AssessmentInput, 'limitations' | 'postureFlags'> {
  const limitationCodes = new Set(['shoulder_pain', 'knee_pain', 'lower_back_pain', 'neck_pain']);
  const postureCodes = new Set([
    'rounded_shoulders',
    'forward_head',
    'anterior_pelvic_tilt',
    'tight_hips',
    'lower_back_discomfort',
  ]);

  const postureAliases: Record<string, NonNullable<AssessmentInput['postureFlags']>[number]> = {
    forward_head_posture: 'forward_head',
    limited_hip_mobility: 'tight_hips',
  };

  return {
    limitations: considerations
      .map(({ code }) => code)
      .filter((code): code is NonNullable<AssessmentInput['limitations']>[number] =>
        limitationCodes.has(code),
      ),
    postureFlags: considerations
      .map(({ code }) => postureAliases[code] ?? code)
      .filter((code): code is NonNullable<AssessmentInput['postureFlags']>[number] =>
        postureCodes.has(code),
      ),
  };
}

export const assessmentInputSchema = z
  .object({
    goals: z
      .array(
        z.enum([
          'muscle_gain',
          'fat_loss',
          'posture_improvement',
          'mobility',
          'strength',
          'aesthetics',
          'recomposition',
        ]),
      )
      .min(1),
    frequencyDays: z.number().int().min(2).max(5),
    equipment: z
      .array(z.enum(['full_gym', 'dumbbells_only', 'home_gym', 'resistance_bands']))
      .min(1),
    considerations: z.array(assessmentConsiderationSchema).default([]),
    limitations: z
      .array(z.enum(['shoulder_pain', 'knee_pain', 'lower_back_pain', 'neck_pain']))
      .default([]),
    postureFlags: z
      .array(
        z.enum([
          'rounded_shoulders',
          'forward_head',
          'anterior_pelvic_tilt',
          'tight_hips',
          'lower_back_discomfort',
        ]),
      )
      .default([]),
  })
  .strict()
  .refine(
    ({ considerations }) => {
      const codes = considerations.map(({ code }) => code);
      return new Set(codes).size === codes.length;
    },
    { path: ['considerations'], message: 'Duplicate consideration codes are not allowed.' },
  );

// Use the input shape so TypeScript callers can continue omitting defaulted legacy fields.
export type AssessmentInput = z.input<typeof assessmentInputSchema>;

export const latestAssessmentOutputSchema = z.object({
  goals: z.array(z.string()),
  frequencyDays: z.number().int().min(2).max(5),
  equipment: z.array(z.string()),
  limitations: z.array(z.string()),
  postureFlags: z.array(z.string()),
  considerations: z.array(assessmentConsiderationSchema),
  completedAt: z.string().datetime(),
  inputHash: z.string(),
});
