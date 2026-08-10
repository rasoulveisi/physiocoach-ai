import { describe, expect, it } from 'vitest';
import { createInputHash } from '../src/services/input-hash';
import { validateWorkoutPlan } from '../src/services/plan-validator';
import { DISCLAIMER } from '../src/types/workout';

describe('createInputHash', () => {
  it('creates the same hash for equivalent input with different key order', async () => {
    await expect(createInputHash({ goals: ['strength'], frequencyDays: 3 })).resolves.toBe(
      await createInputHash({ frequencyDays: 3, goals: ['strength'] }),
    );
  });

  it('creates the same hash for nested objects and arrays with equivalent object key order', async () => {
    await expect(
      createInputHash({
        goals: ['strength', { secondary: 'posture', primary: 'muscle' }],
        postureFlags: {
          roundedShoulders: true,
          kneePain: false,
        },
      }),
    ).resolves.toBe(
      await createInputHash({
        postureFlags: {
          kneePain: false,
          roundedShoulders: true,
        },
        goals: ['strength', { primary: 'muscle', secondary: 'posture' }],
      }),
    );
  });
});

const validStrictFixture = {
  schemaVersion: '1.0' as const,
  source: 'ai' as const,
  days: [
    {
      dayNumber: 1,
      name: 'Day 1',
      focus: 'Upper Body',
      exercises: [
        {
          id: 'ex_1',
          name: 'Chest-supported row',
          muscleGroup: 'back',
          movementPattern: 'pull' as const,
          sets: 3,
          reps: '10-12',
          rpe: 6,
          restSeconds: 90,
          notes: 'controlled tempo',
        },
      ],
    },
  ],
  progression: {
    baselineIntensity: 'low-moderate' as const,
    progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
    increasePercent: 10,
    conditions: [],
  },
  safetyNotes: [],
  warnings: [DISCLAIMER],
};

describe('validateWorkoutPlan', () => {
  it('validates and accepts correct strict flat plan', () => {
    const result = validateWorkoutPlan(validStrictFixture, {
      experienceLevel: 'intermediate',
      limitations: [],
      postureFlags: {},
    });

    expect(result.ok).toBe(true);
    expect(result.correctedPlan.schemaVersion).toBe('1.0');
    expect(result.warnings).toContain(DISCLAIMER);
  });

  it('corrects shoulder pain and replaces behind-neck press', () => {
    const planWithRisky = {
      ...validStrictFixture,
      days: [
        {
          dayNumber: 1,
          name: 'Day 1',
          focus: 'Shoulders',
          exercises: [
            {
              id: 'ex_1',
              name: 'Behind-neck press',
              muscleGroup: 'shoulders',
              movementPattern: 'push' as const,
              sets: 3,
              reps: '8-10',
              rpe: 7,
              restSeconds: 90,
            },
          ],
        },
      ],
    };

    const result = validateWorkoutPlan(planWithRisky, {
      experienceLevel: 'intermediate',
      limitations: ['shoulder_pain'],
      postureFlags: { shoulderPain: true },
    });

    expect(result.ok).toBe(true);
    // Should replace with chest supported row
    expect(result.correctedPlan.days[0]?.exercises[0]?.name).toBe('Chest-supported row');
    expect(result.corrections.some((c) => c.includes('Removed risky exercise pattern'))).toBe(true);
  });

  it('enforces beginner muscle set caps', () => {
    const highVolumePlan = {
      ...validStrictFixture,
      days: [
        {
          dayNumber: 1,
          name: 'Day 1',
          focus: 'Back volume',
          exercises: [
            {
              id: 'ex_1',
              name: 'Row',
              muscleGroup: 'back',
              movementPattern: 'pull' as const,
              sets: 25, // exceeds 20 sets beginner limit
              reps: '10',
              restSeconds: 90,
            },
          ],
        },
      ],
    };

    const result = validateWorkoutPlan(highVolumePlan, {
      experienceLevel: 'beginner',
      limitations: [],
      postureFlags: {},
    });

    expect(result.correctedPlan.days[0]?.exercises[0]?.sets).toBe(20);
    expect(result.corrections.some((c) => c.includes('capped at 20 sets'))).toBe(true);
  });
});
