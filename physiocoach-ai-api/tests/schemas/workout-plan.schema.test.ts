import { describe, expect, it } from 'vitest';
import { workoutPlanSchema } from '../../src/types/workout';

describe('workout plan schema validation', () => {
  it('parses strict plan payload', () => {
    const payload = workoutPlanSchema.parse({
      schemaVersion: '1.0',
      source: 'ai',
      days: [
        {
          dayNumber: 1,
          name: 'Day 1',
          focus: 'Full body',
          exercises: [
            {
              id: 'ex_1',
              name: 'Chest-supported row',
              muscleGroup: 'back',
              movementPattern: 'pull',
              sets: 3,
              reps: '10-12',
              rpe: 7,
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
      warnings: ['Educational fitness recommendations only. Not medical advice.'],
    });

    expect(payload).toHaveProperty('schemaVersion', '1.0');
    expect(payload.days[0]?.exercises[0]?.name).toBe('Chest-supported row');
  });

  it('rejects invalid plan payloads', () => {
    const parsed = workoutPlanSchema.safeParse({
      schemaVersion: '2.0', // invalid version
      days: [],
    });

    expect(parsed.success).toBe(false);
  });

  it('preprocesses and repairs a malformed Schema B layout', () => {
    const parsed = workoutPlanSchema.parse({
      schemaVersion: '2026-06-05-output-v3',
      source: 'generation-run:test',
      days: [
        {
          dayNumber: 1,
          focus: 'Pull Emphasis',
          exercises: [
            {
              name: 'Chest-supported row',
              movementPattern: 'pull',
              sets: 3,
              reps: '10-12',
              restSeconds: 90,
              exerciseRationale: 'Row rationale',
            },
          ],
        },
      ],
      progression: {
        baselineIntensity: 'low-moderate',
        progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
      },
      safetyNotes: 'Test safety notes',
      warnings: 'Educational fitness recommendations only. Not medical advice.',
    });

    expect(parsed.schemaVersion).toBe('1.0');
    expect(parsed.source).toBe('repaired');
    expect(parsed.days[0]?.name).toBe('Pull Emphasis');
    expect(parsed.days[0]?.exercises[0]?.id).toBe('ex_d1_1');
    expect(parsed.days[0]?.exercises[0]?.muscleGroup).toBe('pull');
    expect(parsed.days[0]?.exercises[0]?.notes).toBe('Row rationale');
    expect(parsed.safetyNotes).toEqual(['Test safety notes']);
    expect(parsed.warnings).toEqual([
      'Educational fitness recommendations only. Not medical advice.',
      'Stop immediately if pain increases during an exercise.',
      'Do not continue if dizziness, lightheadedness, or chest pressure appears.',
    ]);
  });
});
