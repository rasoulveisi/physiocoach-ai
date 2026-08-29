import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
} as const;

describe('E2E: Multi-Plan Library & Single Active Plan Switcher', () => {
  const planA = {
    title: 'Routine A: 3-Day Full Body',
    description: 'Comprehensive strength full body split.',
    split: 'full_body',
    frequencyDays: 3,
    days: [
      {
        dayName: 'Day 1 Full Body',
        exercises: [
          {
            exerciseId: 'ex-squat',
            exerciseName: 'Barbell Back Squat',
            movementPattern: 'squat',
            muscleGroups: ['quads', 'glutes'],
            sets: [
              {
                setNumber: 1,
                setType: 'NORMAL',
                targetReps: 8,
                targetRir: 2,
                tempo: '3-0-1-0',
                restSeconds: 90,
              },
            ],
          },
        ],
      },
    ],
  };

  const planB = {
    title: 'Routine B: Upper Lower Split',
    description: '4-Day Hypertrophy split.',
    split: 'upper_lower',
    frequencyDays: 4,
    days: [
      {
        dayName: 'Upper Day 1',
        exercises: [
          {
            exerciseId: 'ex-bench',
            exerciseName: 'Incline Bench Press',
            movementPattern: 'push',
            muscleGroups: ['chest'],
            sets: [
              {
                setNumber: 1,
                setType: 'NORMAL',
                targetReps: 10,
                targetRir: 2,
                tempo: '3-0-1-0',
                restSeconds: 90,
              },
            ],
          },
        ],
      },
    ],
  };

  it('creates multiple plans, lists them via /workout-plans/my-plans, and switches active plan via /workout-plans/:id/activate', async () => {
    const app = createApp();

    // 1. Create Plan A
    const resA = await app.fetch(
      '/api/v1/workout-plans/custom',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(planA),
      },
      mockEnv,
    );
    expect(resA.status).toBe(201);
    const jsonA = (await resA.json()) as { planId: string };
    const planIdA = jsonA.planId;

    // 2. Create Plan B (will become active by default, archiving Plan A)
    const resB = await app.fetch(
      '/api/v1/workout-plans/custom',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(planB),
      },
      mockEnv,
    );
    expect(resB.status).toBe(201);
    const jsonB = (await resB.json()) as { planId: string };
    const planIdB = jsonB.planId;

    // 3. Query /workout-plans/my-plans
    const myPlansRes = await app.fetch('/api/v1/workout-plans/my-plans', { method: 'GET' }, mockEnv);
    expect(myPlansRes.status).toBe(200);
    const myPlansJson = (await myPlansRes.json()) as {
      data: Array<{
        id: string;
        title: string;
        status: string;
        split: string;
        frequencyDays: number;
        primaryExercise?: { name: string };
      }>;
      total: number;
    };

    expect(myPlansJson.data.length).toBeGreaterThanOrEqual(2);
    const foundA = myPlansJson.data.find((p) => p.id === planIdA);
    const foundB = myPlansJson.data.find((p) => p.id === planIdB);
    expect(foundA).toBeDefined();
    expect(foundB).toBeDefined();
    expect(foundA?.title).toBe('Routine A: 3-Day Full Body');
    expect(foundB?.title).toBe('Routine B: Upper Lower Split');
    expect(foundA?.primaryExercise?.name).toBe('Barbell Back Squat');
    expect(foundB?.primaryExercise?.name).toBe('Incline Bench Press');
    expect(foundB?.status).toBe('active');

    // 4. Activate Plan A via /workout-plans/:id/activate
    const activateRes = await app.fetch(
      `/api/v1/workout-plans/${planIdA}/activate`,
      {
        method: 'POST',
      },
      mockEnv,
    );
    expect(activateRes.status).toBe(200);
    const activateJson = (await activateRes.json()) as { success: boolean; activePlanId: string };
    expect(activateJson.success).toBe(true);
    expect(activateJson.activePlanId).toBe(planIdA);

    // 5. Verify /workout-plans/current now returns Plan A
    const currentRes = await app.fetch('/api/v1/workout-plans/current', { method: 'GET' }, mockEnv);
    expect(currentRes.status).toBe(200);
    const currentJson = (await currentRes.json()) as { data: { id: string; plan: { name?: string } } };
    expect(currentJson.data.id).toBe(planIdA);
  });
});
