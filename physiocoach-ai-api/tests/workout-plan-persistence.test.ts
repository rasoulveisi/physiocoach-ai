import { describe, expect, it } from 'vitest';
import { workoutPlanSchema } from '../src/types/workout';
import {
  buildWorkoutPlanRecord,
  parseWorkoutPlanRecord,
  parseWorkoutPlanRecordOrError,
  type WorkoutPlanRecordInput,
} from '../src/services/workout-generator';
import { createDb } from '../src/db/client';
import { persistAssessmentAndPlan } from '../src/routes/workout-plans';
import type { WorkoutPlanOrchestrationResult } from '../src/services/workout-generator';

const generatedResult: WorkoutPlanOrchestrationResult = {
  source: 'fallback',
  model: 'deterministic-fallback',
  warnings: ['Educational fitness recommendations only. Not medical advice.'],
  plan: workoutPlanSchema.parse({
    schemaVersion: '1.0',
    source: 'fallback',
    days: [
      {
        dayNumber: 1,
        name: 'Day 1',
        focus: 'Full body',
        exercises: [
          {
            id: 'ex_1',
            name: 'Goblet squat',
            muscleGroup: 'legs',
            movementPattern: 'squat',
            sets: 3,
            reps: '8-10',
            rpe: 6,
            restSeconds: 90,
          },
        ],
      },
    ],
    progression: {
      baselineIntensity: 'low-moderate',
      progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
      increasePercent: 10,
      conditions: [],
    },
    safetyNotes: [],
    warnings: [
      'Educational fitness recommendations only. Not medical advice.',
      'Stop if pain or dizziness appears.',
    ],
  }),
};

describe('workout plan persistence helpers', () => {
  it('serializes and parses a generated workout plan record', () => {
    const input: WorkoutPlanRecordInput = {
      id: 'plan_1',
      userId: 'user_1',
      assessmentId: 'assessment_1',
      inputHash: 'hash_1',
      createdAt: '2026-06-01T10:00:00.000Z',
      result: generatedResult,
    };

    const record = buildWorkoutPlanRecord(input);
    const dto = parseWorkoutPlanRecord(record);

    expect(record.status).toBe('active');
    expect(record.version).toBe(1);
    expect(dto.id).toBe('plan_1');
    expect(dto.source).toBe('fallback');
    expect(dto.model).toBe('deterministic-fallback');
    expect(dto.plan.days[0]?.exercises[0]?.name).toBe('Goblet squat');
  });

  it('reports invalid workout plan records without throwing', () => {
    const input: WorkoutPlanRecordInput = {
      id: 'plan_invalid',
      userId: 'user_1',
      assessmentId: 'assessment_1',
      inputHash: 'hash_invalid',
      createdAt: '2026-06-01T10:00:00.000Z',
      result: {
        source: 'fallback',
        model: 'deterministic-fallback',
        warnings: ['Educational fitness recommendations only. Not medical advice.'],
        plan: workoutPlanSchema.parse({
          schemaVersion: '1.0',
          source: 'fallback',
          days: [
            {
              dayNumber: 1,
              name: 'Day 1',
              focus: 'Full body',
              exercises: [
                {
                  id: 'ex_1',
                  name: 'Goblet squat',
                  muscleGroup: 'legs',
                  movementPattern: 'squat',
                  sets: 3,
                  reps: '8-10',
                  restSeconds: 90,
                },
              ],
            },
          ],
          progression: {
            baselineIntensity: 'low-moderate',
            progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
            increasePercent: 10,
            conditions: [],
          },
          safetyNotes: [],
          warnings: [
            'Educational fitness recommendations only. Not medical advice.',
            'Stop if pain or dizziness appears.',
          ],
        }),
      },
    };

    const corrupted = buildWorkoutPlanRecord(input);
    corrupted.aiMetadataJson = '{"source":"unknown"}';

    expect(parseWorkoutPlanRecordOrError(corrupted).ok).toBe(false);
  });

  it('validates considerations before changing persisted workout plans', async () => {
    const statements: string[] = [];
    const database = {
      prepare(sql: string) {
        statements.push(sql);
        return {
          bind() {
            return this;
          },
          async raw() {
            return [];
          },
          async run() {
            return { success: true, meta: { changes: 1 } };
          },
        };
      },
    } as unknown as D1Database;

    await expect(
      persistAssessmentAndPlan(
        createDb(database),
        'user_1',
        {
          profile: {
            age: 29,
            sex: 'male',
            heightCm: 178,
            weightKg: 80,
            lifestyle: 'desk_job',
            experienceLevel: 'intermediate',
          },
          assessment: {
            goals: ['strength'],
            frequencyDays: 3,
            equipment: ['full_gym'],
            considerations: [{ code: 'unknown_code', severity: 'severe', side: 'bilateral' }],
          },
        },
        buildWorkoutPlanRecord({
          id: 'plan_1',
          userId: 'user_1',
          assessmentId: 'assessment_1',
          inputHash: 'hash_1',
          createdAt: '2026-06-01T10:00:00.000Z',
          result: generatedResult,
        }),
      ),
    ).rejects.toThrow('inactive or unknown consideration');

    expect(statements).not.toEqual(
      expect.arrayContaining([expect.stringContaining('update "workout_plans"')]),
    );
    expect(statements).not.toEqual(
      expect.arrayContaining([expect.stringContaining('insert into "assessments"')]),
    );
  });

  it('persists an overlapping legacy lower-back payload once', async () => {
    const statements: string[] = [];
    const database = {
      prepare(sql: string) {
        statements.push(sql);
        return {
          bind() {
            return this;
          },
          async raw() {
            return [['bc_lower_back_pain', 'lower_back_pain']];
          },
          async run() {
            return { success: true, meta: { changes: 1 } };
          },
        };
      },
    } as unknown as D1Database;

    await expect(
      persistAssessmentAndPlan(
        createDb(database),
        'user_1',
        {
          profile: {
            age: 29,
            sex: 'male',
            heightCm: 178,
            weightKg: 80,
            lifestyle: 'desk_job',
            experienceLevel: 'intermediate',
          },
          assessment: {
            goals: ['strength'],
            frequencyDays: 3,
            equipment: ['full_gym'],
            limitations: ['lower_back_pain'],
            postureFlags: ['lower_back_discomfort'],
          },
        },
        buildWorkoutPlanRecord({
          id: 'plan_legacy_1',
          userId: 'user_1',
          assessmentId: 'assessment_legacy_1',
          inputHash: 'hash_legacy_1',
          createdAt: '2026-06-01T10:00:00.000Z',
          result: generatedResult,
        }),
      ),
    ).resolves.toBeUndefined();

    expect(statements.filter((sql) => sql.includes('assessment_considerations'))).toHaveLength(1);
  });
});
