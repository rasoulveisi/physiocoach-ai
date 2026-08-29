import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
} as const;

describe('E2E: Workout Plan Publishing & Persona Matching (/workout-plans/:id/publish)', () => {
  const sampleCustomPlan = {
    title: 'Desk Worker Spine & Posture Routine',
    description: 'Targeted routine to counteract sitting with rows, face pulls, and core stability.',
    split: 'upper_lower',
    frequencyDays: 3,
    days: [
      {
        dayName: 'Upper Body & Posture Day',
        exercises: [
          {
            exerciseId: 'ex-chest-supported-row',
            exerciseName: 'Chest Supported Dumbbell Row',
            movementPattern: 'pull',
            muscleGroups: ['back', 'lats', 'rear_delts'],
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
            ],
          },
          {
            exerciseId: 'ex-face-pull',
            exerciseName: 'Cable Face Pull',
            movementPattern: 'pull',
            muscleGroups: ['rear_delts', 'upper_back', 'rotator_cuff'],
            sets: [
              {
                setNumber: 1,
                setType: 'NORMAL',
                targetReps: '12-15',
                targetRir: 2,
                tempo: '2-0-1-1',
                restSeconds: 60,
              },
            ],
          },
          {
            exerciseId: 'ex-neutral-db-press',
            exerciseName: 'Neutral Grip Dumbbell Bench Press',
            movementPattern: 'push',
            muscleGroups: ['chest', 'triceps', 'front_delts'],
            sets: [
              {
                setNumber: 1,
                setType: 'NORMAL',
                targetReps: '8-10',
                targetRir: 2,
                tempo: '3-0-1-0',
                restSeconds: 90,
              },
            ],
          },
        ],
      },
      {
        dayName: 'Lower Body & Core Day',
        exercises: [
          {
            exerciseId: 'ex-romanian-deadlift',
            exerciseName: 'Dumbbell Romanian Deadlift',
            movementPattern: 'hinge',
            muscleGroups: ['hamstrings', 'glutes'],
            sets: [
              {
                setNumber: 1,
                setType: 'NORMAL',
                targetReps: '10-12',
                targetRir: 2,
                tempo: '3-1-1-0',
                restSeconds: 90,
              },
            ],
          },
          {
            exerciseId: 'ex-deadbug',
            exerciseName: 'Deadbug Core Activation',
            movementPattern: 'core',
            muscleGroups: ['abdominals', 'core'],
            sets: [
              {
                setNumber: 1,
                setType: 'NORMAL',
                targetReps: '12 per side',
                targetRir: 2,
                tempo: '2-1-2-1',
                restSeconds: 60,
              },
            ],
          },
        ],
      },
    ],
  };

  it('returns 404 when publishing a non-existent workout plan', async () => {
    const app = createApp();
    const response = await app.fetch(
      '/api/v1/workout-plans/non-existent-id/publish',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      },
      mockEnv,
    );

    expect(response.status).toBe(404);
  });

  it('creates custom plan, evaluates personas, and successfully publishes to Explore Hub', async () => {
    const app = createApp();

    // 1. Create a custom plan
    const createRes = await app.fetch(
      '/api/v1/workout-plans/custom',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sampleCustomPlan),
      },
      mockEnv,
    );

    expect(createRes.status).toBe(201);
    const createdJson = (await createRes.json()) as { success: boolean; planId: string };
    expect(createdJson.success).toBe(true);
    expect(createdJson.planId).toBeDefined();
    const planId = createdJson.planId;

    // 2. Publish the plan
    const publishRes = await app.fetch(
      `/api/v1/workout-plans/${planId}/publish`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      },
      mockEnv,
    );

    expect(publishRes.status).toBe(200);
    const publishJson = (await publishRes.json()) as {
      success: boolean;
      publishedPlanId: string;
      personas: string[];
      targetAudience: string;
      exploreUrl: string;
    };

    expect(publishJson.success).toBe(true);
    expect(publishJson.publishedPlanId).toBe(planId);
    expect(Array.isArray(publishJson.personas)).toBe(true);
    expect(publishJson.personas.length).toBeGreaterThanOrEqual(1);
    expect(publishJson.personas).toContain('Desk Workers with Lower Back Discomfort');
    expect(publishJson.personas).toContain('Shoulder-Safe Strength');
    expect(publishJson.exploreUrl).toBe(`/explore?plan=${planId}`);
    expect(publishJson.targetAudience).toBeDefined();

    // 3. Verify plan appears in Explore Plans feed
    const exploreFeedRes = await app.fetch('/api/v1/explore/plans', { method: 'GET' }, mockEnv);
    expect(exploreFeedRes.status).toBe(200);
    const exploreJson = (await exploreFeedRes.json()) as {
      data: Array<{
        id: string;
        title: string;
        targetPersonas: string[];
        jointTags: string[];
      }>;
      total: number;
    };

    const publishedInFeed = exploreJson.data.find((p) => p.id === planId);
    expect(publishedInFeed).toBeDefined();
    expect(publishedInFeed?.title).toBe('Desk Worker Spine & Posture Routine');
    expect(publishedInFeed?.targetPersonas).toContain('Desk Workers with Lower Back Discomfort');

    // 4. Verify single explore plan endpoint
    const singlePlanRes = await app.fetch(`/api/v1/explore/plans/${planId}`, { method: 'GET' }, mockEnv);
    expect(singlePlanRes.status).toBe(200);
    const singleJson = (await singlePlanRes.json()) as {
      data: {
        id: string;
        title: string;
        targetPersonas: string[];
        days: Array<{ dayNumber: number; exercises: unknown[] }>;
      };
    };

    expect(singleJson.data.id).toBe(planId);
    expect(singleJson.data.title).toBe('Desk Worker Spine & Posture Routine');
    expect(singleJson.data.days.length).toBe(2);
    expect(singleJson.data.targetPersonas).toContain('Desk Workers with Lower Back Discomfort');

    // 5. Test search filter with persona keyword
    const searchRes = await app.fetch(
      '/api/v1/explore/plans?search=desk+worker',
      { method: 'GET' },
      mockEnv,
    );
    expect(searchRes.status).toBe(200);
    const searchJson = (await searchRes.json()) as {
      data: Array<{ id: string; targetPersonas: string[] }>;
    };
    expect(searchJson.data.some((p) => p.id === planId)).toBe(true);

    // 6. Test cloning the published plan
    const cloneRes = await app.fetch(
      `/api/v1/workout-plans/${planId}/clone`,
      { method: 'POST' },
      mockEnv,
    );
    expect(cloneRes.status).toBe(201);
    const cloneJson = (await cloneRes.json()) as { data: { id: string; plan: unknown } };
    expect(cloneJson.data.id).toBeDefined();
    expect(cloneJson.data.id).not.toBe(planId);
  });
});
