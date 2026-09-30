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
  const result: AssessmentConsideration[] = [];
  const seenCodes = new Set<string>();

  for (const code of input.limitations ?? []) {
    if (!seenCodes.has(code)) {
      seenCodes.add(code);
      result.push({
        code,
        severity: 'moderate',
        side: 'unspecified',
        inferred: true,
      });
    }
  }

  for (const code of input.postureFlags ?? []) {
    const resolvedCode = legacyPostureAliases[code] ?? code;
    if (!seenCodes.has(resolvedCode)) {
      seenCodes.add(resolvedCode);
      result.push({
        code: resolvedCode,
        severity: 'mild',
        side: 'unspecified',
        inferred: true,
      });
    }
  }

  return result;
}

export function hasExplicitConsiderations(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  return (
    'considerations' in input &&
    Array.isArray((input as { considerations?: unknown }).considerations) &&
    (input as { considerations: unknown[] }).considerations.length > 0
  );
}

export function resolveAssessmentConsiderations(input: {
  considerations?: Array<z.input<typeof assessmentConsiderationSchema>> | undefined;
  limitations?: string[] | undefined;
  postureFlags?: string[] | undefined;
}): AssessmentConsideration[] {
  if (input.considerations !== undefined) {
    return input.considerations.map((consideration) => ({
      code: consideration.code,
      severity: consideration.severity,
      side: consideration.side ?? 'unspecified',
      notes: consideration.notes,
      inferred: consideration.inferred ?? false,
    }));
  }
  return normalizeLegacyAssessmentConsiderations(input);
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
    sessionMinutes: z.number().int().min(15).max(180).optional(),
    archetype: z.string().optional(),
    equipment: z.array(z.string().trim().min(1).max(100)).min(1),
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
  .strict();

// Use the input shape so TypeScript callers can continue omitting defaulted legacy fields.
export type AssessmentInput = z.input<typeof assessmentInputSchema>;

const VALID_LIMITATIONS = new Set(['shoulder_pain', 'knee_pain', 'lower_back_pain', 'neck_pain']);
const VALID_POSTURE_FLAGS = new Set([
  'rounded_shoulders',
  'forward_head',
  'anterior_pelvic_tilt',
  'tight_hips',
  'lower_back_discomfort',
]);

const POSTURE_ALIASES: Record<string, NonNullable<AssessmentInput['postureFlags']>[number]> = {
  forward_head_posture: 'forward_head',
  limited_hip_mobility: 'tight_hips',
};

export function legacySafetyContextFromConsiderations(
  considerations: readonly AssessmentConsideration[],
): Pick<AssessmentInput, 'limitations' | 'postureFlags'> {
  const limitations: NonNullable<AssessmentInput['limitations']> = [];
  const postureFlags: NonNullable<AssessmentInput['postureFlags']> = [];

  for (const { code } of considerations) {
    if (VALID_LIMITATIONS.has(code)) {
      limitations.push(code as NonNullable<AssessmentInput['limitations']>[number]);
    }
    const postureCode = POSTURE_ALIASES[code] ?? code;
    if (VALID_POSTURE_FLAGS.has(postureCode)) {
      postureFlags.push(postureCode as NonNullable<AssessmentInput['postureFlags']>[number]);
    }
  }

  return { limitations, postureFlags };
}

export const latestAssessmentOutputSchema = z.object({
  goals: z.array(z.string()),
  frequencyDays: z.number().int().min(2).max(5),
  sessionMinutes: z.number().int().min(15).max(180).optional(),
  archetype: z.string().optional(),
  equipment: z.array(z.string()),
  limitations: z.array(z.string()),
  postureFlags: z.array(z.string()),
  considerations: z.array(assessmentConsiderationSchema),
  completedAt: z.string().datetime(),
  inputHash: z.string(),
});
