import { z } from 'zod';
import { workoutPlanSchema } from '../../types/workout';
import type {
  WorkoutPlanDto,
  WorkoutPlanParseResult,
  WorkoutPlanRecord,
  WorkoutPlanRecordFromDb,
  WorkoutPlanRecordInput,
} from '../../types/workout-generator';

export function buildWorkoutPlanRecord(input: WorkoutPlanRecordInput): WorkoutPlanRecord {
  return {
    id: input.id,
    userId: input.userId,
    assessmentId: input.assessmentId,
    status: 'active',
    planJson: JSON.stringify(input.result.plan),
    safetyWarningsJson: JSON.stringify(input.result.warnings),
    aiMetadataJson: JSON.stringify({
      source: input.result.source,
      model: input.result.model,
      ...(input.result.generation ? { generation: input.result.generation } : {}),
      providerMetadata: input.result.providerMetadata,
    }),
    version: 1,
    inputHash: input.inputHash,
    createdAt: input.createdAt,
  };
}

function parseWorkoutPlanRecordCore(
  record: WorkoutPlanRecord | WorkoutPlanRecordFromDb,
): WorkoutPlanDto {
  const metadata = z
    .object({
      source: z.enum(['ai', 'fallback', 'repaired']),
      model: z.string().min(1),
      generation: z
        .object({
          fallbackUsed: z.boolean(),
          errorCode: z
            .enum(['rate_limited', 'provider_timeout', 'provider_error', 'fallback_used'])
            .optional(),
        })
        .optional(),
      providerMetadata: z.unknown().optional(),
    })
    .parse(JSON.parse(record.aiMetadataJson));

  return {
    id: record.id,
    source: metadata.source,
    model: metadata.model,
    plan: workoutPlanSchema.parse(JSON.parse(record.planJson)),
    warnings: z.array(z.string()).parse(JSON.parse(record.safetyWarningsJson)),
    ...(metadata.generation ? { generation: metadata.generation } : {}),
    createdAt: record.createdAt,
    inputHash: record.inputHash,
    cached: false,
  };
}

export function parseWorkoutPlanRecord(
  record: WorkoutPlanRecord | WorkoutPlanRecordFromDb,
): WorkoutPlanDto {
  const parsed = parseWorkoutPlanRecordOrError(record);
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }

  return parsed.dto;
}

export function parseWorkoutPlanRecordOrError(
  record: WorkoutPlanRecord | WorkoutPlanRecordFromDb,
): WorkoutPlanParseResult {
  try {
    return {
      ok: true,
      dto: parseWorkoutPlanRecordCore(record),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        error: {
          code: 'invalid_workout_plan_record',
          message: 'Stored workout plan record is not compatible with current schema.',
          issues: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        },
      };
    }

    return {
      ok: false,
      error: {
        code: 'invalid_workout_plan_record',
        message: 'Stored workout plan record is malformed.',
        issues: [error instanceof Error ? error.message : 'Unknown parse error.'],
      },
    };
  }
}
