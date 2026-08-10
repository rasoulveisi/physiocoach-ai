import { z } from 'zod';
import { WORKOUT_PLAN_MOVEMENT_PATTERNS } from './workout-plan-contract';
import type { WorkoutPlanGenerationContext } from './ai';

type ExperienceLevel = WorkoutPlanGenerationContext['experienceLevel'];

const PHYSIOCOACH_SOURCE_NAME = 'physiocoach';
const PhysioCoachSourceSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.toLowerCase());

const SourceAttributionBaseSchema = z.object({
  source: PhysioCoachSourceSchema,
  sourceId: z.string().trim().min(1),
  licenseName: z.string().trim().min(1).optional(),
  licenseUrl: z.string().url().optional(),
  licenseAuthor: z.string().trim().min(1).optional(),
  attributionText: z.string().trim().min(1).optional(),
});

export const sourceAttributionSchema = SourceAttributionBaseSchema.superRefine((value, context) => {
  if (value.source === PHYSIOCOACH_SOURCE_NAME) {
    return;
  }

  if (value.licenseName === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'licenseName is required when source is not owned by PhysioCoach',
      path: ['licenseName'],
    });
  }
  if (value.licenseUrl === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'licenseUrl is required when source is not owned by PhysioCoach',
      path: ['licenseUrl'],
    });
  }
  if (value.licenseAuthor === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'licenseAuthor is required when source is not owned by PhysioCoach',
      path: ['licenseAuthor'],
    });
  }
  if (value.attributionText === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'attributionText is required when source is not owned by PhysioCoach',
      path: ['attributionText'],
    });
  }
});

export const CatalogMediaMetadataSchema = z
  .object({
    id: z.string().trim().min(1),
    exerciseId: z.string().trim().min(1),
    storageUrl: z.string().url(),
    mediaType: z.enum(['image', 'video', 'gif']),
  })
  .merge(sourceAttributionSchema);

const stableIdSchema = z.string().trim().min(1);
const ExerciseCatalogLinkSchema = z.object({
  exerciseId: stableIdSchema,
});

const ExerciseEquipmentLinkSchema = ExerciseCatalogLinkSchema.extend({
  equipmentId: stableIdSchema,
});

const ExerciseMuscleLinkSchema = ExerciseCatalogLinkSchema.extend({
  muscleId: stableIdSchema,
  isPrimary: z.boolean().default(true),
});
const exerciseEquipmentLinkSchema = ExerciseEquipmentLinkSchema;
const exerciseMuscleLinkSchema = ExerciseMuscleLinkSchema;

export const ExerciseCatalogRecordSchema = z
  .object({
    id: stableIdSchema,
    canonicalId: z.string().trim().min(1),
    name: z.string().trim().min(1),
    nameLocalized: z.string().trim().min(1).optional(),
    movementPattern: z.enum(WORKOUT_PLAN_MOVEMENT_PATTERNS),
    instructions: z.string().trim().min(1).optional(),
    recommendedLevel: z
      .enum(['beginner', 'intermediate', 'advanced'] as const satisfies readonly ExperienceLevel[])
      .optional(),
    goalTags: z.array(z.string().trim().min(1)).optional().default([]),
    excludedLimitations: z.array(z.string().trim().min(1)).optional().default([]),
    equipmentLinks: z.array(exerciseEquipmentLinkSchema).min(1),
    muscleLinks: z.array(exerciseMuscleLinkSchema).min(1),
    aliases: z.array(z.string().trim().min(1)).default([]),
    media: z.array(CatalogMediaMetadataSchema).default([]),
  })
  .merge(sourceAttributionSchema)
  .superRefine((record, context) => {
    record.equipmentLinks.forEach((link, index) => {
      if (link.exerciseId !== record.id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'equipmentLinks exerciseId must match catalog record id',
          path: ['equipmentLinks', index, 'exerciseId'],
        });
      }
    });

    record.muscleLinks.forEach((link, index) => {
      if (link.exerciseId !== record.id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'muscleLinks exerciseId must match catalog record id',
          path: ['muscleLinks', index, 'exerciseId'],
        });
      }
    });
  });

export const MasterMuscleSchema = z
  .object({
    id: stableIdSchema,
    canonicalId: z.string().trim().min(1),
    name: z.string().trim().min(1),
    nameLocalized: z.string().trim().min(1).optional(),
  })
  .merge(sourceAttributionSchema);

export const MasterEquipmentSchema = z
  .object({
    id: stableIdSchema,
    canonicalId: z.string().trim().min(1),
    name: z.string().trim().min(1),
    nameLocalized: z.string().trim().min(1).optional(),
  })
  .merge(sourceAttributionSchema);

export const MasterExerciseSchema = z
  .object({
    id: stableIdSchema,
    canonicalId: z.string().trim().min(1),
    name: z.string().trim().min(1),
    nameLocalized: z.string().trim().min(1).optional(),
    movementPattern: z.enum(WORKOUT_PLAN_MOVEMENT_PATTERNS),
    instructions: z.string().trim().min(1).optional(),
    recommendedLevel: z
      .enum(['beginner', 'intermediate', 'advanced'] as const satisfies readonly ExperienceLevel[])
      .optional(),
    goalTags: z.array(z.string().trim().min(1)).optional().default([]),
    excludedLimitations: z.array(z.string().trim().min(1)).optional().default([]),
  })
  .merge(sourceAttributionSchema);

export type SourceAttribution = z.infer<typeof sourceAttributionSchema>;
export type CatalogMediaMetadata = z.infer<typeof CatalogMediaMetadataSchema>;
export type ExerciseCatalogRecord = z.infer<typeof ExerciseCatalogRecordSchema>;
