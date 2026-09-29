import { describe, expect, it } from 'vitest';
import {
  calculateExerciseDuration,
  calculateWorkoutDayDuration,
  calculateWorkoutDayDurationMinutes,
  parseRepCount,
} from '../src/services/workout-duration';

describe('workout-duration service', () => {
  describe('parseRepCount', () => {
    it('parses timed second holds', () => {
      expect(parseRepCount('30s')).toEqual({ isTimed: true, seconds: 30, avgReps: 1 });
      expect(parseRepCount('45 sec')).toEqual({ isTimed: true, seconds: 45, avgReps: 1 });
      expect(parseRepCount('40 seconds')).toEqual({ isTimed: true, seconds: 40, avgReps: 1 });
    });

    it('parses timed minute holds', () => {
      expect(parseRepCount('1 min')).toEqual({ isTimed: true, seconds: 60, avgReps: 1 });
      expect(parseRepCount('1.5 minutes')).toEqual({ isTimed: true, seconds: 90, avgReps: 1 });
    });

    it('parses rep ranges', () => {
      expect(parseRepCount('5-8')).toEqual({ isTimed: false, avgReps: 7 });
      expect(parseRepCount('8-12')).toEqual({ isTimed: false, avgReps: 10 });
      expect(parseRepCount('15-20')).toEqual({ isTimed: false, avgReps: 18 });
    });

    it('parses single numbers', () => {
      expect(parseRepCount(12)).toEqual({ isTimed: false, avgReps: 12 });
      expect(parseRepCount('10 reps')).toEqual({ isTimed: false, avgReps: 10 });
    });

    it('falls back gracefully on empty/invalid reps', () => {
      expect(parseRepCount('')).toEqual({ isTimed: false, avgReps: 10 });
      expect(parseRepCount(undefined)).toEqual({ isTimed: false, avgReps: 10 });
    });
  });

  describe('calculateExerciseDuration', () => {
    it('calculates duration for heavy compound lift with long rest', () => {
      const details = calculateExerciseDuration({
        name: 'barbell high bar squat',
        movementPattern: 'squat',
        sets: 4,
        reps: '5-8',
        restSeconds: 120,
      });

      // 4 sets * 28s work = 112s
      // 3 rest periods * 120s = 360s
      // 120s barbell setup/warmup
      // Total: 112 + 360 + 120 = 592s (~9.9 min)
      expect(details.sets).toBe(4);
      expect(details.restSeconds).toBe(360);
      expect(details.setupSeconds).toBe(120);
      expect(details.totalSeconds).toBeGreaterThan(500);
      expect(details.totalSeconds).toBeLessThan(700);
    });

    it('factors unilateral multiplier for single-leg movements', () => {
      const bilateral = calculateExerciseDuration({
        name: 'barbell squat',
        movementPattern: 'squat',
        sets: 3,
        reps: '10',
        restSeconds: 60,
      });

      const unilateral = calculateExerciseDuration({
        name: 'barbell split squat',
        movementPattern: 'lunge',
        sets: 3,
        reps: '10',
        restSeconds: 60,
      });

      // Unilateral work time should be significantly higher due to both limbs
      expect(unilateral.workSeconds).toBeGreaterThan(bilateral.workSeconds);
    });

    it('calculates duration for timed core holds correctly', () => {
      const plank = calculateExerciseDuration({
        name: 'plank hold',
        movementPattern: 'core',
        sets: 3,
        reps: '30s',
        restSeconds: 45,
      });

      // 3 sets * 30s = 90s work
      // 2 * 45s = 90s rest
      // 30s mat setup
      // Total: 210s (3.5 min)
      expect(plank.workSeconds).toBe(90);
      expect(plank.restSeconds).toBe(90);
      expect(plank.setupSeconds).toBe(30);
      expect(plank.totalSeconds).toBe(210);
    });
  });

  describe('calculateWorkoutDayDuration', () => {
    it('returns accurate ~50-60 min duration for a complete 6-exercise workout', () => {
      const day = {
        dayNumber: 1,
        exercises: [
          { name: 'barbell bench press', movementPattern: 'push', sets: 4, reps: '5-8', restSeconds: 120 },
          { name: 'incline dumbbell press', movementPattern: 'push', sets: 3, reps: '8-10', restSeconds: 90 },
          { name: 'cable lat pulldown', movementPattern: 'pull', sets: 4, reps: '8-12', restSeconds: 75 },
          { name: 'chest-supported row', movementPattern: 'pull', sets: 3, reps: '10-12', restSeconds: 75 },
          { name: 'cable triceps extension', movementPattern: 'push', sets: 3, reps: '12-15', restSeconds: 60 },
          { name: 'dumbbell lateral raise', movementPattern: 'push', sets: 3, reps: '12-15', restSeconds: 60 },
        ],
      };

      const duration = calculateWorkoutDayDuration(day);
      expect(duration.exerciseCount).toBe(6);
      expect(duration.totalSets).toBe(20);
      expect(duration.totalMinutes).toBeGreaterThanOrEqual(45);
      expect(duration.totalMinutes).toBeLessThanOrEqual(65);

      const minutes = calculateWorkoutDayDurationMinutes(day);
      expect(minutes).toBe(duration.totalMinutes);
    });

    it('detects short ab-only day as under 30 minutes', () => {
      const shortAbDay = {
        dayNumber: 3,
        exercises: [
          { name: 'farmers walk', movementPattern: 'carry', sets: 4, reps: '40s', restSeconds: 60 },
          { name: 'assisted hanging knee raise', movementPattern: 'core', sets: 3, reps: '12-15', restSeconds: 60 },
          { name: 'lever seated leg raise crunch', movementPattern: 'core', sets: 3, reps: '15-20', restSeconds: 60 },
          { name: '3/4 sit-up', movementPattern: 'core', sets: 3, reps: '15-20', restSeconds: 60 },
          { name: 'balance board', movementPattern: 'mobility', sets: 3, reps: '30s', restSeconds: 60 },
        ],
      };

      const duration = calculateWorkoutDayDuration(shortAbDay);
      expect(duration.totalMinutes).toBeLessThanOrEqual(30);
    });
  });
});
