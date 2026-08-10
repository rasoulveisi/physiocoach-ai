import { z } from 'zod';

export const progressSummarySchema = z.object({
  workoutsCompletedThisWeek: z.number().int().min(0),
  streakDays: z.number().int().min(0),
  personalRecords: z.number().int().min(0),
  totalVolumeThisWeek: z.number().nonnegative(),
  plateauDetected: z.boolean(),
  complianceScore: z.number().min(0).max(100).int(),
  warnings: z.array(z.string()),
});

const optionalMeasurementSchema = z.number().positive().optional();

export const bodyMeasurementInputSchema = z
  .object({
    measuredAt: z.string().datetime(),
    bodyWeightKg: z.number().positive(),
    bodyFatEstimate: z.number().min(0).max(100).optional(),
    neckCm: optionalMeasurementSchema,
    shouldersCm: optionalMeasurementSchema,
    chestCm: optionalMeasurementSchema,
    waistCm: optionalMeasurementSchema,
    hipsCm: optionalMeasurementSchema,
    upperArmLeftCm: optionalMeasurementSchema,
    upperArmRightCm: optionalMeasurementSchema,
    forearmLeftCm: optionalMeasurementSchema,
    forearmRightCm: optionalMeasurementSchema,
    thighLeftCm: optionalMeasurementSchema,
    thighRightCm: optionalMeasurementSchema,
    calfLeftCm: optionalMeasurementSchema,
    calfRightCm: optionalMeasurementSchema,
    notes: z.string().min(1).optional(),
  })
  .strict();

export type BodyMeasurementInput = z.infer<typeof bodyMeasurementInputSchema>;
export type ProgressSummary = z.infer<typeof progressSummarySchema>;

export type SessionRecord = {
  id: string;
  userId: string;
  workoutPlanId: string;
  dayIndex: number;
  status: string;
  scheduledDate: string;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
};

export type SessionLogRow = {
  id: string;
  userId: string;
  workoutSessionId: string;
  exerciseName: string;
  movementPattern: string;
  setIndex: number;
  targetReps: string | null;
  reps: number;
  weight: number;
  rpe: number | null;
  completed: number;
  notes: string | null;
  sessionCompletedAt: string | null;
  sessionScheduledDate: string;
};

export interface ProgressDb {
  findCompletedSessionsForUser: (userId: string) => Promise<SessionRecord[]>;
  findCompletedSessionsForUserInRange: (
    userId: string,
    fromInclusive: string,
    toInclusive: string,
  ) => Promise<SessionRecord[]>;
  findExerciseLogsForSessionIds: (sessionIds: string[]) => Promise<SessionLogRow[]>;
}
