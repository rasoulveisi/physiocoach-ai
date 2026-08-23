import { describe, expect, it } from 'vitest';
import {
  aiAuditLogs,
  assessments,
  authRefreshTokenHistory,
  exerciseLogs,
  profiles,
  users,
  masterExercises,
  masterMuscles,
  masterEquipment,
  exerciseMuscles,
  exerciseEquipment,
  exerciseMedia,
  exerciseCatalogVersions,
  exerciseConsiderationRatings,
  exerciseSafetyProfiles,
  assessmentConsiderations,
  bodyConsiderations,
  userSettings,
  workoutPlans,
  workoutSessions,
} from '../src/db/schema';

describe('database schema', () => {
  it('exports all active tables', () => {
    expect(users).toBeDefined();
    expect(aiAuditLogs).toBeDefined();
    expect(authRefreshTokenHistory).toBeDefined();
    expect(userSettings).toBeDefined();
    expect(profiles).toBeDefined();
    expect(masterMuscles).toBeDefined();
    expect(masterEquipment).toBeDefined();
    expect(masterExercises).toBeDefined();
    expect(exerciseMuscles).toBeDefined();
    expect(exerciseEquipment).toBeDefined();
    expect(exerciseMedia).toBeDefined();
    expect(assessments).toBeDefined();
    expect(workoutPlans).toBeDefined();
    expect(workoutSessions).toBeDefined();
    expect(exerciseLogs).toBeDefined();
    expect(exerciseCatalogVersions).toBeDefined();
    expect(bodyConsiderations).toBeDefined();
    expect(assessmentConsiderations).toBeDefined();
    expect(exerciseSafetyProfiles).toBeDefined();
    expect(exerciseConsiderationRatings).toBeDefined();
  });

  it('defines workout session tracker columns', () => {
    expect(workoutSessions.dayIndex.name).toBe('day_index');
    expect(workoutSessions.status.name).toBe('status');
    expect(exerciseLogs.targetReps.name).toBe('target_reps');
    expect(exerciseLogs.masterExerciseId?.name).toBe('master_exercise_id');
    expect(exerciseLogs.completed.name).toBe('completed');
  });
});
