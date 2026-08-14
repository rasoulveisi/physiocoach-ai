import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  exerciseAliases,
  exerciseAnalysisEvidence,
  exerciseAnalysisRuns,
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
  it('exports all MVP tables', () => {
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
    expect(exerciseAliases).toBeDefined();
    expect(assessments).toBeDefined();
    expect(workoutPlans).toBeDefined();
    expect(workoutSessions).toBeDefined();
    expect(exerciseLogs).toBeDefined();
    expect(exerciseCatalogVersions).toBeDefined();
    expect(bodyConsiderations).toBeDefined();
    expect(assessmentConsiderations).toBeDefined();
    expect(exerciseSafetyProfiles).toBeDefined();
    expect(exerciseConsiderationRatings).toBeDefined();
    expect(exerciseAnalysisRuns).toBeDefined();
    expect(exerciseAnalysisEvidence).toBeDefined();
  });

  it('defines workout session tracker columns', () => {
    expect(workoutSessions.dayIndex.name).toBe('day_index');
    expect(workoutSessions.status.name).toBe('status');
    expect(exerciseLogs.targetReps.name).toBe('target_reps');
    expect(exerciseLogs.masterExerciseId?.name).toBe('master_exercise_id');
    expect(exerciseLogs.completed.name).toBe('completed');
  });

  it('includes expected migration indexes for session idempotency and settings', () => {
    const migrationsDir = join(process.cwd(), 'src/db/migrations');
    const migrationSql = readdirSync(migrationsDir)
      .filter((entry) => entry.endsWith('.sql'))
      .sort()
      .map((entry) => readFileSync(join(migrationsDir, entry), 'utf8'))
      .join('\n');

    expect(migrationSql).toContain('CREATE INDEX `workout_sessions_user_day_idx`');
    expect(migrationSql).toContain(
      '`workout_sessions` (`user_id`,`workout_plan_id`,`day_index`,`scheduled_date`)',
    );
    expect(migrationSql).toContain('CREATE UNIQUE INDEX `workout_sessions_idempotency_key_unique`');
    expect(migrationSql).toContain('`workout_sessions` (`idempotency_key`)');
    expect(migrationSql).toContain('CREATE UNIQUE INDEX `user_settings_user_id_unique`');
    expect(migrationSql).toContain('`user_settings` (`user_id`)');
    expect(migrationSql).toContain('CREATE TABLE `auth_refresh_token_history`');
    expect(migrationSql).toContain('CREATE INDEX `auth_refresh_token_history_session_idx`');
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX `auth_refresh_token_history_token_hash_unique`',
    );
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX `exercise_consideration_ratings_exercise_consideration_severity_version_unique`',
    );
    expect(migrationSql).toContain(
      '`exercise_consideration_ratings` (`exercise_id`,`consideration_id`,`severity`,`analysis_version`)',
    );
  });

  it('clears legacy user-owned rows before the self-hosted auth clean-cut user migration', () => {
    const migrationSql = readFileSync(
      join(process.cwd(), 'src/db/migrations/0006_self_hosted_auth.sql'),
      'utf8',
    );
    const deleteProfilesIndex = migrationSql.indexOf('DELETE FROM `profiles`;');
    const createEmailIndex = migrationSql.indexOf('CREATE UNIQUE INDEX `users_email_unique`');
    const dropLegacyAuthUserId = migrationSql.indexOf(
      'ALTER TABLE `users` DROP COLUMN `legacy_auth_user_id`',
    );

    expect(deleteProfilesIndex).toBeGreaterThanOrEqual(0);
    expect(createEmailIndex).toBeGreaterThan(deleteProfilesIndex);
    expect(dropLegacyAuthUserId).toBeGreaterThan(deleteProfilesIndex);
    expect(migrationSql).toContain('DELETE FROM `assessments`;');
    expect(migrationSql).toContain('DELETE FROM `workout_plans`;');
    expect(migrationSql).toContain('DELETE FROM `workout_sessions`;');
    expect(migrationSql).toContain('DELETE FROM `exercise_logs`;');
    expect(migrationSql).toContain('DELETE FROM `body_measurements`;');
    expect(migrationSql).toContain('DELETE FROM `user_settings`;');
    expect(migrationSql).toContain('DELETE FROM `users`;');
    expect(migrationSql).not.toContain('DELETE FROM `master_exercises`;');
    expect(migrationSql).not.toContain('DELETE FROM `master_muscles`;');
    expect(migrationSql).not.toContain('DELETE FROM `master_equipment`;');
  });

  it('seeds safety considerations and backfills legacy assessments without deleting catalog rows', () => {
    const migrationSql = readFileSync(
      join(process.cwd(), 'src/db/migrations/0008_assessment_considerations.sql'),
      'utf8',
    );

    expect(migrationSql).toContain("'high_impact_intolerance'");
    expect(migrationSql).toContain('INSERT OR IGNORE INTO `assessment_considerations`');
    expect(migrationSql).toContain('`limitations_json`');
    expect(migrationSql).toContain('`posture_flags_json`');
    expect(migrationSql).not.toContain('DELETE FROM `master_exercises`;');
  });
});
