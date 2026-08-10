import { describe, expect, it } from 'vitest';
import {
  MISSING_MASTER_EXERCISE_ID_ERROR_MESSAGE,
  buildDefaultExerciseLogs,
  calculateSessionProgress,
  exerciseLogInputSchema,
  findCanonicalExerciseForLog,
  workoutSessionCreateSchema,
  exerciseLogPatchSchema,
} from '../src/services/workout-session';
import type { WorkoutDay } from '../src/types/workout';

const day: WorkoutDay = {
  name: 'Day 1',
  focus: 'Full body',
  dayNumber: 1,
  exercises: [
    {
      id: 'ex_1',
      name: 'Goblet squat',
      masterExerciseId: 'master_ex_1',
      muscleGroup: 'legs',
      movementPattern: 'squat',
      sets: 3,
      reps: '8-10',
      rpe: 6,
      restSeconds: 90,
    },
    {
      id: 'ex_2',
      name: 'Chest-supported row',
      masterExerciseId: 'master_ex_2',
      muscleGroup: 'back',
      movementPattern: 'pull',
      sets: 2,
      reps: '10-12',
      rpe: 7,
      restSeconds: 90,
    },
  ],
};

describe('workout session service helpers', () => {
  it('validates create session input', () => {
    expect(
      workoutSessionCreateSchema.parse({
        workoutPlanId: 'plan_1',
        dayIndex: 0,
        scheduledDate: '2026-06-01',
      }),
    ).toEqual({
      workoutPlanId: 'plan_1',
      dayIndex: 0,
      scheduledDate: '2026-06-01',
    });
  });

  it('builds default logs from a workout day', () => {
    const logs = buildDefaultExerciseLogs({
      userId: 'user_1',
      workoutSessionId: 'session_1',
      day,
    });

    expect(logs).toHaveLength(5);
    expect(logs[0]).toMatchObject({
      userId: 'user_1',
      workoutSessionId: 'session_1',
      exerciseName: 'Goblet squat',
      masterExerciseId: 'master_ex_1',
      setIndex: 1,
      targetReps: '8-10',
      reps: 0,
      weight: 0,
      completed: 0,
    });
    expect(logs[3]?.exerciseName).toBe('Chest-supported row');
    expect(logs[3]?.setIndex).toBe(1);

    expect(logs[0]?.exerciseName).toBe('Goblet squat');
    expect(logs[2]?.masterExerciseId).toBe('master_ex_1');
  });

  it('requires masterExerciseId in exercise definitions', () => {
    const legacyDay: WorkoutDay = {
      name: 'Legacy Day',
      focus: 'Legacy',
      dayNumber: 2,
      exercises: [
        {
          id: 'ex_legacy',
          name: 'Legacy squat',
          muscleGroup: 'legs',
          movementPattern: 'squat',
          sets: 2,
          reps: '10-12',
          rpe: 7,
          restSeconds: 60,
        },
      ],
    };

    expect(() =>
      buildDefaultExerciseLogs({
        userId: 'user_legacy',
        workoutSessionId: 'session_legacy',
        day: legacyDay,
      }),
    ).toThrowError(MISSING_MASTER_EXERCISE_ID_ERROR_MESSAGE);
  });

  it('requires masterExerciseId in manual exercise log input', () => {
    const input = {
      workoutSessionId: 'session_1',
      exerciseName: 'Goblet squat',
      masterExerciseId: 'master_ex_1',
      movementPattern: 'squat',
      muscleGroups: ['legs'],
      setIndex: 1,
      targetReps: '8-10',
      reps: 10,
      weightKg: 24,
      completed: true,
    };

    expect(exerciseLogInputSchema.parse(input)).toEqual(input);

    const withoutMasterExerciseId = { ...input } as Record<string, unknown> & {
      masterExerciseId?: string;
    };
    delete withoutMasterExerciseId.masterExerciseId;
    expect(() => exerciseLogInputSchema.parse(withoutMasterExerciseId)).toThrow();
  });

  it('loads canonical exercise details for manual log persistence', async () => {
    const db = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            leftJoin: () => ({
              where: () =>
                Promise.resolve([
                  {
                    masterExerciseId: 'master_ex_1',
                    exerciseName: 'Catalog Goblet Squat',
                    movementPattern: 'squat',
                    muscleName: 'Quadriceps',
                    isPrimary: 1,
                  },
                ]),
            }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof findCanonicalExerciseForLog>[0];

    await expect(findCanonicalExerciseForLog(db, 'master_ex_1')).resolves.toEqual({
      masterExerciseId: 'master_ex_1',
      exerciseName: 'Catalog Goblet Squat',
      movementPattern: 'squat',
      muscleGroups: ['Quadriceps'],
    });
  });

  it('validates set log patches', () => {
    expect(
      exerciseLogPatchSchema.parse({
        reps: 10,
        weightKg: 32.5,
        rpe: 7,
        completed: true,
        notes: 'Clean reps',
      }),
    ).toEqual({
      reps: 10,
      weightKg: 32.5,
      rpe: 7,
      completed: true,
      notes: 'Clean reps',
    });
  });

  it('calculates completed set progress', () => {
    expect(
      calculateSessionProgress([{ completed: 1 }, { completed: 0 }, { completed: 1 }]),
    ).toEqual({
      completedSets: 2,
      totalSets: 3,
    });
  });
});
