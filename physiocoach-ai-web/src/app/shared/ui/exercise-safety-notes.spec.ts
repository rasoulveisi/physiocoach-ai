import { describe, expect, it } from 'vitest';

import { resolveExerciseSafetyNotes, type ExerciseSafetyNotes } from './exercise-safety-notes';

describe('resolveExerciseSafetyNotes', () => {
  it('maps canonical and aliased exercise names', () => {
    expect(resolveExerciseSafetyNotes('Goblet squat')).toEqual<ExerciseSafetyNotes>({
      tips: ['Keep torso upright and knees tracking over toes.', 'Move with control through full range of motion.'],
    });
    expect(resolveExerciseSafetyNotes('DB RDL')).toEqual<ExerciseSafetyNotes>({
      tips: ['Hinge at hips, not lower back.', 'Use a neutral spine through the whole rep.'],
    });
  });

  it('returns a fallback note for unknown exercise names', () => {
    expect(resolveExerciseSafetyNotes('Unknown move')).toEqual<ExerciseSafetyNotes>({
      tips: ['Use a weight you can control from start to finish.'],
    });
  });

  it('normalizes spacing and case before lookup', () => {
    expect(resolveExerciseSafetyNotes('  GOblet   squat  ')).toEqual<ExerciseSafetyNotes>({
      tips: ['Keep torso upright and knees tracking over toes.', 'Move with control through full range of motion.'],
    });
  });
});
