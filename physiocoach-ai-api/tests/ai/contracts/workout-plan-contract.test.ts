import { describe, expect, it } from 'vitest';
import {
  CANONICAL_PROGRESSION_RULE,
  buildCanonicalPromptContract,
  isCanonicalProgressionRule,
  workoutPlanAiOutputSchema,
  workoutPlanStrictSchema,
} from '../../../src/types/workout-plan-contract';

const validPlanFixture = {
  schemaVersion: '1.0',
  source: 'ai',
  days: [
    {
      dayNumber: 1,
      name: 'Day 1',
      focus: 'Upper Body',
      exercises: [
        {
          id: 'ex_1',
          masterExerciseId: 'master_ex_1',
          name: 'Chest-supported row',
          muscleGroup: 'back',
          movementPattern: 'pull',
          sets: 3,
          reps: '10-12',
          rpe: 6,
          restSeconds: 90,
          notes: 'Keep shoulders down',
        },
      ],
    },
  ],
  progression: {
    baselineIntensity: 'low-moderate',
    progressionRule: CANONICAL_PROGRESSION_RULE,
    increasePercent: 10,
    conditions: ['Double progression only'],
  },
  safetyNotes: ['Warm up thoroughly'],
  warnings: [
    'Educational fitness recommendations only. Not medical advice.',
    'Stop if pain or dizziness appears.',
  ],
};

describe('workout plan AI contracts', () => {
  it('identifies and validates canonical progression rules', () => {
    expect(isCanonicalProgressionRule(CANONICAL_PROGRESSION_RULE)).toBe(true);
    expect(isCanonicalProgressionRule('Do cardio every day')).toBe(false);
  });

  it('validates a correct flat workout plan payload', () => {
    const result = workoutPlanStrictSchema.safeParse(validPlanFixture);
    expect(result.success).toBe(true);
  });

  it('builds prompt contract correctly', () => {
    const contract = buildCanonicalPromptContract({
      userGoal: 'fat_loss',
      goals: ['fat_loss'],
      experienceLevel: 'beginner',
      frequencyDays: 3,
      equipment: ['dumbbells'],
      limitations: [],
      postureFlags: [],
    });

    expect(contract.task).toBe('workout_plan_generation');
    expect(contract.context.userGoal).toBe('fat_loss');
  });

  it('requires masterExerciseId for AI output exercises', () => {
    const aiPlan = {
      ...validPlanFixture,
      source: 'ai',
      days: validPlanFixture.days.map((day) => ({
        ...day,
        exercises: day.exercises.map((exercise) => {
          const rest = {
            ...exercise,
          } as Record<string, unknown> & {
            masterExerciseId?: string;
          };
          delete rest.masterExerciseId;
          return rest;
        }),
      })),
    };

    const result = workoutPlanAiOutputSchema.safeParse(aiPlan);
    expect(result.success).toBe(false);
  });
});
