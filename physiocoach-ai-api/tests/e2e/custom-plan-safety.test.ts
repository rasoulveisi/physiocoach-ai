import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import type { CustomPlanSafetyEvaluationResult } from '../../src/services/custom-plan-evaluator';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
} as const;

interface TestErrorResponse {
  error: {
    code: string;
    details?: {
      traceId?: string;
      issues?: unknown[];
    };
  };
}

async function postEvaluateSafety(body: unknown, userId = 'test-safety-user') {
  const app = createApp();
  return app.fetch(
    '/api/v1/workout-plans/evaluate-safety',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(body),
    },
    mockEnv,
  );
}

describe('POST /api/v1/workout-plans/evaluate-safety', () => {
  it('evaluates a safe balanced plan with a high safety score and zero issues', async () => {
    const safePlan = {
      days: [
        {
          dayName: 'Day 1 - Push',
          exercises: [
            {
              exerciseId: 'incline-db-bench',
              exerciseName: 'Incline Dumbbell Bench Press',
              movementPattern: 'push',
              muscleGroups: ['chest'],
              sets: 3,
            },
            {
              exerciseId: 'cable-fly',
              exerciseName: 'Cable Chest Fly',
              movementPattern: 'push',
              muscleGroups: ['chest'],
              sets: 3,
            },
          ],
        },
      ],
      userContext: {
        experienceLevel: 'intermediate',
        limitations: [],
      },
    };

    const response = await postEvaluateSafety(safePlan);
    expect(response.status).toBe(200);

    const data = (await response.json()) as CustomPlanSafetyEvaluationResult;
    expect(data.safetyScore).toBeGreaterThanOrEqual(90);
    expect(data.status).toBe('safe');
    expect(data.issues).toHaveLength(0);
    expect(data.summary).toContain('safe for your body');
    expect(data.traceId).toBeDefined();
    expect(data.auditLogId).toBeDefined();
  });

  it('detects lower back contraindication and recommends a plain-language swap', async () => {
    const riskyPlan = {
      days: [
        {
          dayName: 'Day 1 - Heavy Pull',
          exercises: [
            {
              exerciseId: 'barbell-deadlift',
              exerciseName: 'Barbell Deadlift',
              movementPattern: 'hinge',
              muscleGroups: ['back', 'hamstrings'],
              sets: 4,
            },
          ],
        },
      ],
      userContext: {
        experienceLevel: 'intermediate',
        limitations: ['lower_back_pain'],
      },
    };

    const response = await postEvaluateSafety(riskyPlan);
    expect(response.status).toBe(200);

    const data = (await response.json()) as CustomPlanSafetyEvaluationResult;
    expect(data.safetyScore).toBeLessThan(90);
    expect(['caution', 'unsafe']).toContain(data.status);
    expect(data.issues.length).toBeGreaterThanOrEqual(1);

    const deadliftIssue = data.issues.find(
      (i: { exerciseName: string }) => i.exerciseName === 'Barbell Deadlift',
    );
    expect(deadliftIssue).toBeDefined();
    expect(deadliftIssue?.actionType).toBe('SWAP');
    expect(deadliftIssue?.problemText).toBe('Puts heavy stress on your lower back. Can trigger pain.');
    expect(deadliftIssue?.suggestedExerciseName).toBeDefined();
  });

  it('detects knee pain contraindication on knee-stressing movements', async () => {
    const kneeStrainPlan = {
      days: [
        {
          dayName: 'Day 1 - Quads',
          exercises: [
            {
              exerciseId: 'hack-squat',
              exerciseName: 'Machine Hack Squat',
              movementPattern: 'squat',
              muscleGroups: ['quads'],
              sets: 4,
            },
          ],
        },
      ],
      userContext: {
        experienceLevel: 'beginner',
        limitations: ['knee_pain'],
      },
    };

    const response = await postEvaluateSafety(kneeStrainPlan);
    expect(response.status).toBe(200);

    const data = (await response.json()) as CustomPlanSafetyEvaluationResult;
    const kneeIssue = data.issues.find((i: { exerciseName: string }) =>
      i.exerciseName.includes('Hack Squat'),
    );
    expect(kneeIssue).toBeDefined();
    expect(kneeIssue?.actionType).toBe('SWAP');
    expect(kneeIssue?.problemText).toBe('Puts heavy pressure on your bad knee.');
    expect(kneeIssue?.suggestedExerciseName).toBe('Goblet Box Squat');
  });

  it('detects excessive muscle volume and suggests set reduction', async () => {
    const highVolumePlan = {
      days: [
        {
          dayName: 'Day 1 - Chest Overload',
          exercises: [
            {
              exerciseId: 'bench-1',
              exerciseName: 'Flat Dumbbell Press',
              movementPattern: 'push',
              muscleGroups: ['chest'],
              sets: 8,
            },
            {
              exerciseId: 'bench-2',
              exerciseName: 'Incline Dumbbell Press',
              movementPattern: 'push',
              muscleGroups: ['chest'],
              sets: 8,
            },
          ],
        },
      ],
      userContext: {
        experienceLevel: 'beginner', // Beginner max sets = 14
        limitations: [],
      },
    };

    const response = await postEvaluateSafety(highVolumePlan);
    expect(response.status).toBe(200);

    const data = (await response.json()) as CustomPlanSafetyEvaluationResult;
    const volumeIssue = data.issues.find(
      (i: { actionType: string }) => i.actionType === 'REDUCE_SETS',
    );
    expect(volumeIssue).toBeDefined();
    expect(volumeIssue?.problemText).toContain('Too many sets for your chest');
    expect(volumeIssue?.suggestedSets).toBeDefined();
  });

  it('rejects malformed requests with 409 and detailed validation issues', async () => {
    const response = await postEvaluateSafety({ invalid: true });
    expect(response.status).toBe(409);

    const data = (await response.json()) as TestErrorResponse;
    expect(data.error.code).toBe('invalid_request');
    expect(data.error.details?.traceId).toBeDefined();
    expect(data.error.details?.issues).toBeDefined();
  });
});
