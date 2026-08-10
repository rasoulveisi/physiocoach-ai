import { z } from 'zod';

export const profileInputSchema = z
  .object({
    age: z.number().int().min(13).max(100),
    sex: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
    heightCm: z.number().min(100).max(250),
    weightKg: z.number().min(30).max(300),
    bodyFatEstimate: z.number().min(3).max(70).optional(),
    lifestyle: z.enum(['desk_job', 'standing_job', 'active']),
    experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  })
  .strict();

export type ProfileInput = z.infer<typeof profileInputSchema>;
