import { describe, expect, it } from 'vitest';
import {
  calculateProgressiveOverload,
  type ProgressiveOverloadInput,
} from '../../physiocoach-ai-web/src/services/progressive-overload';

describe('Progressive Overload & Deload Engine', () => {
  it('recommends +2.5 kg progressive overload when previous RPE <= 8 (>=2 RIR)', () => {
    const input: ProgressiveOverloadInput = {
      exerciseName: 'Barbell Back Squat',
      currentWeightKg: 80,
      currentReps: 8,
      targetReps: 8,
      previousPerformance: {
        weight: 80,
        reps: 8,
        rpe: 7.5,
        date: '2026-08-25',
      },
      recentPainScore: 0,
      unitSystem: 'metric',
    };

    const result = calculateProgressiveOverload(input);

    expect(result.type).toBe('overload');
    expect(result.recommendedWeightKg).toBe(82.5);
    expect(result.deltaWeightKg).toBe(2.5);
    expect(result.chipLabel).toContain('+2.5 kg overload');
    expect(result.badgeVariant).toBe('lime');
    expect(result.isApplicable).toBe(true);
  });

  it('recommends +5 lbs progressive overload in imperial mode when previous RPE <= 8', () => {
    const input: ProgressiveOverloadInput = {
      exerciseName: 'Barbell Bench Press',
      currentWeightKg: 80, // ~176 lbs
      currentReps: 10,
      targetReps: 10,
      previousPerformance: {
        weight: 80,
        reps: 10,
        rpe: 8.0,
      },
      recentPainScore: 0,
      unitSystem: 'imperial',
    };

    const result = calculateProgressiveOverload(input);

    expect(result.type).toBe('overload');
    expect(result.chipLabel).toContain('+5 lbs overload');
    expect(result.badgeVariant).toBe('lime');
    expect(result.isApplicable).toBe(true);
  });

  it('recommends -10% conservative deload when athlete logs joint discomfort (painScore >= 4)', () => {
    const input: ProgressiveOverloadInput = {
      exerciseName: 'Romanian Deadlift',
      currentWeightKg: 100,
      currentReps: 8,
      targetReps: 8,
      previousPerformance: {
        weight: 100,
        reps: 8,
        rpe: 7.0,
      },
      recentPainScore: 5,
      unitSystem: 'metric',
    };

    const result = calculateProgressiveOverload(input);

    expect(result.type).toBe('deload');
    expect(result.recommendedWeightKg).toBe(90); // 100 * 0.9 = 90
    expect(result.deltaWeightKg).toBe(-10);
    expect(result.chipLabel).toContain('Deload Target: -10% load for joint recovery');
    expect(result.badgeVariant).toBe('amber');
    expect(result.buttonLabel).toBe('Apply Deload');
    expect(result.isApplicable).toBe(true);
  });

  it('recommends volume consolidation when previous RPE was 9-10 (high effort limit)', () => {
    const input: ProgressiveOverloadInput = {
      exerciseName: 'Overhead Press',
      currentWeightKg: 50,
      currentReps: 5,
      targetReps: 5,
      previousPerformance: {
        weight: 50,
        reps: 4, // failed rep target
        rpe: 9.5,
      },
      recentPainScore: 0,
      unitSystem: 'metric',
    };

    const result = calculateProgressiveOverload(input);

    expect(result.type).toBe('maintain');
    expect(result.recommendedWeightKg).toBe(50);
    expect(result.chipLabel).toContain('Consolidate Volume');
    expect(result.badgeVariant).toBe('cyan');
  });

  it('recommends +1 rep overload for bodyweight exercises', () => {
    const input: ProgressiveOverloadInput = {
      exerciseName: 'Pull-Up',
      currentWeightKg: 0,
      currentReps: 8,
      targetReps: 8,
      previousPerformance: {
        weight: 0,
        reps: 8,
        rpe: 7.0,
      },
      recentPainScore: 0,
      unitSystem: 'metric',
    };

    const result = calculateProgressiveOverload(input);

    expect(result.type).toBe('overload');
    expect(result.recommendedReps).toBe(9);
    expect(result.deltaReps).toBe(1);
    expect(result.chipLabel).toContain('+1 rep overload');
    expect(result.badgeVariant).toBe('lime');
  });
});
