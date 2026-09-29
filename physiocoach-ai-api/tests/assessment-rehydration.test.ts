import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { persistAssessmentAndPlan } from '../src/routes/workout-plans';
import type { GeneratePlanInput } from '../src/services/workout-generator/context';
import type { WorkoutPlanRecord } from '../src/types/workout-generator';
import { getDb } from '../src/db';

vi.mock('../src/db', () => ({
  getDb: vi.fn(),
}));

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
  WORKOUT_MODEL_PRIMARY: 'meta-llama/llama-3.1-8b-instruct',
} as const;

type DbParam = Parameters<typeof persistAssessmentAndPlan>[0];

describe('Phase 3: Route Ingestion, Persistence & Assessment Re-hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persistAssessmentAndPlan saves goals, sessionMinutes, and archetype in goalsJson', async () => {
    const insertedValues: Record<string, unknown>[] = [];
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((val) => {
          insertedValues.push(val as Record<string, unknown>);
          return Promise.resolve();
        }),
      }),
    };

    const input: GeneratePlanInput = {
      assessment: {
        goals: ['muscle_gain', 'strength'],
        sessionMinutes: 60,
        archetype: 'powerbuilder',
        frequencyDays: 4,
        equipment: ['barbell', 'dumbbells'],
        considerations: [],
        limitations: [],
        postureFlags: [],
      },
      profile: {
        age: 29,
        sex: 'male',
        heightCm: 180,
        weightKg: 80,
        lifestyle: 'active',
        experienceLevel: 'intermediate',
      },
    };

    const record: WorkoutPlanRecord = {
      id: 'plan_test_1',
      userId: 'user_test_1',
      assessmentId: 'assessment_test_1',
      status: 'active',
      planJson: JSON.stringify({ days: [] }),
      safetyWarningsJson: JSON.stringify([]),
      aiMetadataJson: JSON.stringify({}),
      version: 1,
      inputHash: 'hash_test_1',
      createdAt: '2026-09-29T12:00:00.000Z',
    };

    await persistAssessmentAndPlan(mockDb as unknown as DbParam, 'user_test_1', input, record);

    expect(insertedValues.length).toBeGreaterThanOrEqual(1);
    const assessmentInsert = insertedValues.find((v) => 'goalsJson' in v);
    expect(assessmentInsert).toBeDefined();

    const parsedGoalsPayload = JSON.parse(assessmentInsert!.goalsJson as string);
    expect(parsedGoalsPayload).toEqual({
      goals: ['muscle_gain', 'strength'],
      sessionMinutes: 60,
      archetype: 'powerbuilder',
    });
  });

  it('persistAssessmentAndPlan omits sessionMinutes and archetype when not provided', async () => {
    const insertedValues: Record<string, unknown>[] = [];
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((val) => {
          insertedValues.push(val as Record<string, unknown>);
          return Promise.resolve();
        }),
      }),
    };

    const input: GeneratePlanInput = {
      assessment: {
        goals: ['strength'],
        frequencyDays: 3,
        equipment: ['home_gym'],
        considerations: [],
        limitations: [],
        postureFlags: [],
      },
    };

    const record: WorkoutPlanRecord = {
      id: 'plan_test_2',
      userId: 'user_test_2',
      assessmentId: 'assessment_test_2',
      status: 'active',
      planJson: JSON.stringify({ days: [] }),
      safetyWarningsJson: JSON.stringify([]),
      aiMetadataJson: JSON.stringify({}),
      version: 1,
      inputHash: 'hash_test_2',
      createdAt: '2026-09-29T12:00:00.000Z',
    };

    await persistAssessmentAndPlan(mockDb as unknown as DbParam, 'user_test_2', input, record);

    const assessmentInsert = insertedValues.find((v) => 'goalsJson' in v);
    expect(assessmentInsert).toBeDefined();

    const parsedGoalsPayload = JSON.parse(assessmentInsert!.goalsJson as string);
    expect(parsedGoalsPayload).toEqual({
      goals: ['strength'],
    });
  });

  it('GET /assessments/latest rehydrates sessionMinutes and archetype from object goalsJson', async () => {
    const mockAssessmentRow = {
      id: 'assessment_123',
      userId: '00000000-0000-4000-8000-000000000001',
      goalsJson: JSON.stringify({
        goals: ['hypertrophy', 'strength'],
        sessionMinutes: 45,
        archetype: 'strength_builder',
      }),
      frequencyDays: 4,
      equipmentJson: JSON.stringify(['barbell', 'dumbbells']),
      limitationsJson: JSON.stringify([]),
      postureFlagsJson: JSON.stringify([]),
      completedAt: '2026-09-29T10:00:00.000Z',
      inputHash: 'test_hash_123',
    };

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAssessmentRow]),
            }),
          }),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const app = createApp();
    const res = await app.fetch(
      '/api/v1/assessments/latest',
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
      mockEnv,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        goals: string[];
        sessionMinutes?: number;
        archetype?: string;
        frequencyDays: number;
      };
    };
    expect(body.data).toBeDefined();
    expect(body.data.goals).toEqual(['hypertrophy', 'strength']);
    expect(body.data.sessionMinutes).toBe(45);
    expect(body.data.archetype).toBe('strength_builder');
    expect(body.data.frequencyDays).toBe(4);
  });

  it('GET /assessments/latest rehydrates legacy array goalsJson gracefully', async () => {
    const mockAssessmentRow = {
      id: 'assessment_legacy_1',
      userId: '00000000-0000-4000-8000-000000000001',
      goalsJson: JSON.stringify(['strength']),
      frequencyDays: 3,
      equipmentJson: JSON.stringify(['home_gym']),
      limitationsJson: JSON.stringify([]),
      postureFlagsJson: JSON.stringify([]),
      completedAt: '2026-09-29T10:00:00.000Z',
      inputHash: 'legacy_hash',
    };

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAssessmentRow]),
            }),
          }),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const app = createApp();
    const res = await app.fetch(
      '/api/v1/assessments/latest',
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
      mockEnv,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        goals: string[];
        sessionMinutes?: number;
        archetype?: string;
        frequencyDays: number;
      };
    };
    expect(body.data).toBeDefined();
    expect(body.data.goals).toEqual(['strength']);
    expect(body.data.sessionMinutes).toBeUndefined();
    expect(body.data.archetype).toBeUndefined();
  });

  it('POST /workout-plans/evaluate-safety reads dbGoals from object goalsJson in assessment row', async () => {
    const mockAssessmentRow = {
      id: 'assessment_eval_1',
      userId: 'test-user-eval',
      goalsJson: JSON.stringify({
        goals: ['muscle_gain'],
        sessionMinutes: 50,
        archetype: 'bodybuilder',
      }),
      frequencyDays: 4,
      equipmentJson: JSON.stringify(['barbell']),
      limitationsJson: JSON.stringify([]),
      postureFlagsJson: JSON.stringify([]),
      completedAt: '2026-09-29T10:00:00.000Z',
      inputHash: 'eval_hash',
    };

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAssessmentRow]),
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };

    vi.mocked(getDb).mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const app = createApp();
    const res = await app.fetch(
      '/api/v1/workout-plans/evaluate-safety',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'test-user-eval',
        },
        body: JSON.stringify({
          days: [
            {
              dayName: 'Day 1',
              exercises: [
                {
                  exerciseId: 'incline-db-bench',
                  exerciseName: 'Incline Dumbbell Bench Press',
                  movementPattern: 'push',
                  muscleGroups: ['chest'],
                  sets: 3,
                },
              ],
            },
          ],
        }),
      },
      mockEnv,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { safetyScore: number };
    expect(body.safetyScore).toBeGreaterThan(0);
  });
});
