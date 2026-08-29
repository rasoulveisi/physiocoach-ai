import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
} as const;

describe('E2E: Interactive Plan Builder API (/workout-plans/custom)', () => {
  const validPlanPayload = {
    title: 'Hypertrophy Upper Lower Split',
    description: 'Custom 4-day Upper/Lower hypertrophy split focused on chest, back, and quads.',
    split: 'upper_lower',
    frequencyDays: 4,
    days: [
      {
        dayName: 'Upper Body A',
        exercises: [
          {
            exerciseId: 'ex-incline-db-bench',
            exerciseName: 'Incline Dumbbell Bench Press',
            movementPattern: 'push',
            muscleGroups: ['chest', 'front_delts', 'triceps'],
            sets: [
              {
                setNumber: 1,
                setType: 'WARMUP',
                targetReps: '12-15',
                targetRir: 3,
                tempo: '3-0-1-0',
                restSeconds: 60,
              },
              {
                setNumber: 2,
                setType: 'NORMAL',
                targetReps: '8-10',
                targetRir: 2,
                tempo: '3-0-1-0',
                restSeconds: 90,
              },
              {
                setNumber: 3,
                setType: 'FAILURE',
                targetReps: '8-10',
                targetRir: 0,
                tempo: '3-0-1-0',
                restSeconds: 120,
              },
            ],
          },
          {
            exerciseId: 'ex-chest-supported-row',
            exerciseName: 'Chest-Supported Dumbbell Row',
            movementPattern: 'pull',
            muscleGroups: ['upper_back', 'lats', 'biceps'],
            sets: [
              {
                setNumber: 1,
                setType: 'NORMAL',
                targetReps: '10-12',
                targetRir: 2,
                tempo: '2-0-1-1',
                restSeconds: 90,
              },
              {
                setNumber: 2,
                setType: 'DROP',
                targetReps: '10-12',
                targetRir: 1,
                tempo: '2-0-1-1',
                restSeconds: 60,
              },
            ],
          },
        ],
      },
      {
        dayName: 'Lower Body A',
        exercises: [
          {
            exerciseId: 'ex-barbell-squat',
            exerciseName: 'Barbell Back Squat',
            movementPattern: 'squat',
            muscleGroups: ['quads', 'glutes'],
            sets: [
              {
                setNumber: 1,
                setType: 'NORMAL',
                targetReps: '6-8',
                targetRir: 2,
                tempo: '3-1-1-0',
                restSeconds: 120,
              },
            ],
          },
        ],
      },
    ],
  };

  it('creates a custom workout plan successfully via POST /api/v1/workout-plans/custom', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/workout-plans/custom',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'test-user-custom-builder-1',
        },
        body: JSON.stringify(validPlanPayload),
      },
      mockEnv,
    );

    expect(response.status).toBe(201);
    const json = (await response.json()) as {
      success: boolean;
      planId: string;
      data: {
        id: string;
        plan: {
          name: string;
          scheduleType: string;
          days: Array<{
            dayNumber: number;
            name: string;
            exercises: Array<{
              name: string;
              sets: number;
              movementPattern: string;
              restSeconds: number;
            }>;
          }>;
        };
      };
    };

    expect(json.success).toBe(true);
    expect(json.planId).toBeDefined();
    expect(json.data.id).toBe(json.planId);
    expect(json.data.plan.name).toBe('Hypertrophy Upper Lower Split');
    expect(json.data.plan.scheduleType).toBe('upper_lower');
    expect(json.data.plan.days.length).toBe(2);
    expect(json.data.plan.days[0]?.exercises.length).toBe(2);
    expect(json.data.plan.days[0]?.exercises[0]?.sets).toBe(3);
    expect(json.data.plan.days[0]?.exercises[0]?.movementPattern).toBe('push');
  });

  it('validates minimum title length', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/workout-plans/custom',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...validPlanPayload,
          title: 'Hi', // Less than 3 chars
        }),
      },
      mockEnv,
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { message: string } };
    expect(json.error).toBeDefined();
  });

  it('validates maximum title length', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/workout-plans/custom',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...validPlanPayload,
          title: 'A'.repeat(121), // More than 120 chars
        }),
      },
      mockEnv,
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { message: string } };
    expect(json.error).toBeDefined();
  });

  it('rejects invalid split enum values', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/workout-plans/custom',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...validPlanPayload,
          split: 'invalid_split_type',
        }),
      },
      mockEnv,
    );

    expect(response.status).toBe(400);
  });

  it('rejects invalid frequency days', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/workout-plans/custom',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...validPlanPayload,
          frequencyDays: 8, // Exceeds 7
        }),
      },
      mockEnv,
    );

    expect(response.status).toBe(400);
  });

  it('rejects invalid set types and out-of-range target RIR', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/workout-plans/custom',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...validPlanPayload,
          days: [
            {
              dayName: 'Day 1',
              exercises: [
                {
                  exerciseId: 'ex-1',
                  exerciseName: 'Bench Press',
                  movementPattern: 'push',
                  muscleGroups: ['chest'],
                  sets: [
                    {
                      setNumber: 1,
                      setType: 'INVALID_SET_TYPE',
                      targetReps: '10',
                      targetRir: 6, // RIR must be 0-4
                      tempo: '3-0-1-0',
                      restSeconds: 90,
                    },
                  ],
                },
              ],
            },
          ],
        }),
      },
      mockEnv,
    );

    expect(response.status).toBe(400);
  });

  it('rejects empty body or non-json request', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/workout-plans/custom',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '',
      },
      mockEnv,
    );

    expect(response.status).toBe(400);
  });
});
