import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
};

const sourceMetadataColumns = {
  source: text('source').notNull(),
  sourceId: text('source_id').notNull(),
  licenseName: text('license_name'),
  licenseUrl: text('license_url'),
  licenseAuthor: text('license_author'),
  attributionText: text('attribution_text'),
};

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    ...timestamps,
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

// Password-based credentials for email/password users.
export const authCredentials = sqliteTable(
  'auth_credentials',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    passwordHash: text('password_hash').notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('auth_credentials_user_id_unique').on(table.userId)],
);

// Linked third-party OAuth providers (e.g. Google).
export const authOauthAccounts = sqliteTable(
  'auth_oauth_accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    email: text('email'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('auth_oauth_accounts_provider_user_unique').on(
      table.provider,
      table.providerUserId,
    ),
  ],
);

// Refresh-token sessions (rotating, with reuse detection).
export const authSessions = sqliteTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    userAgent: text('user_agent'),
    ipHash: text('ip_hash'),
    previousRefreshTokenHash: text('previous_refresh_token_hash'),
    previousRefreshRotatedAt: text('previous_refresh_rotated_at'),
    absoluteExpiresAt: text('absolute_expires_at').notNull(),
    idleExpiresAt: text('idle_expires_at').notNull(),
    createdAt: text('created_at').notNull(),
    revokedAt: text('revoked_at'),
  },
  (table) => [
    index('auth_sessions_user_idx').on(table.userId),
    index('auth_sessions_refresh_hash_idx').on(table.refreshTokenHash),
    index('auth_sessions_previous_refresh_hash_idx').on(table.previousRefreshTokenHash),
  ],
);

export const authRefreshTokenHistory = sqliteTable(
  'auth_refresh_token_history',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => authSessions.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('auth_refresh_token_history_session_idx').on(table.sessionId),
    uniqueIndex('auth_refresh_token_history_token_hash_unique').on(table.tokenHash),
  ],
);

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  age: integer('age').notNull(),
  sex: text('sex').notNull(),
  heightCm: real('height_cm').notNull(),
  weightKg: real('weight_kg').notNull(),
  bodyFatEstimate: real('body_fat_estimate'),
  lifestyle: text('lifestyle').notNull(),
  experienceLevel: text('experience_level').notNull(),
  ...timestamps,
});

export const assessments = sqliteTable('assessments', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  goalsJson: text('goals_json').notNull(),
  frequencyDays: integer('frequency_days').notNull(),
  equipmentJson: text('equipment_json').notNull(),
  limitationsJson: text('limitations_json').notNull(),
  postureFlagsJson: text('posture_flags_json').notNull(),
  completedAt: text('completed_at').notNull(),
  inputHash: text('input_hash').notNull(),
});

export const workoutPlans = sqliteTable('workout_plans', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  assessmentId: text('assessment_id')
    .notNull()
    .references(() => assessments.id),
  status: text('status').notNull(),
  planJson: text('plan_json').notNull(),
  safetyWarningsJson: text('safety_warnings_json').notNull(),
  aiMetadataJson: text('ai_metadata_json').notNull(),
  version: integer('version').notNull(),
  inputHash: text('input_hash').notNull(),
  createdAt: text('created_at').notNull(),
});

export const workoutSessions = sqliteTable(
  'workout_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    workoutPlanId: text('workout_plan_id')
      .notNull()
      .references(() => workoutPlans.id),
    dayIndex: integer('day_index').notNull(),
    status: text('status').notNull(),
    scheduledDate: text('scheduled_date').notNull(),
    idempotencyKey: text('idempotency_key'),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    notes: text('notes'),
  },
  (table) => [
    index('workout_sessions_user_day_idx').on(
      table.userId,
      table.workoutPlanId,
      table.dayIndex,
      table.scheduledDate,
    ),
    uniqueIndex('workout_sessions_idempotency_key_unique').on(table.idempotencyKey),
  ],
);

export const exerciseLogs = sqliteTable('exercise_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  workoutSessionId: text('workout_session_id')
    .notNull()
    .references(() => workoutSessions.id),
  exerciseName: text('exercise_name').notNull(),
  masterExerciseId: text('master_exercise_id'),
  movementPattern: text('movement_pattern').notNull(),
  muscleGroupsJson: text('muscle_groups_json').notNull(),
  setIndex: integer('set_index').notNull(),
  targetReps: text('target_reps'),
  reps: integer('reps').notNull(),
  weight: real('weight').notNull(),
  rpe: real('rpe'),
  completed: integer('completed').notNull().default(0),
  notes: text('notes'),
  exerciseType: text('exercise_type').notNull().default('working'),
  previousPerformanceJson: text('previous_performance_json'),
});

export const userSettings = sqliteTable(
  'user_settings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    theme: text('theme').notNull(),
    unitSystem: text('unit_system').notNull(),
    defaultWorkoutView: text('default_workout_view').notNull(),
    remindersEnabled: integer('reminders_enabled').notNull().default(0),
    restTimerSeconds: integer('rest_timer_seconds').notNull().default(90),
    autoStartRestTimer: integer('auto_start_rest_timer').notNull().default(1),
    restTimerSoundEnabled: integer('rest_timer_sound_enabled').notNull().default(1),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('user_settings_user_id_unique').on(table.userId)],
);





export const masterMuscles = sqliteTable('master_muscles', {
  id: text('id').primaryKey(),
  canonicalId: text('canonical_id').notNull(),
  name: text('name').notNull(),
  nameLocalized: text('name_localized'),
  ...sourceMetadataColumns,
  ...timestamps,
});

export const masterEquipment = sqliteTable('master_equipment', {
  id: text('id').primaryKey(),
  canonicalId: text('canonical_id').notNull(),
  name: text('name').notNull(),
  nameLocalized: text('name_localized'),
  ...sourceMetadataColumns,
  ...timestamps,
});

export const exerciseCatalogVersions = sqliteTable('exercise_catalog_versions', {
  id: text('id').primaryKey(),
  source: text('source').notNull(),
  sourceRepository: text('source_repository').notNull(),
  sourceCommitSha: text('source_commit_sha').notNull(),
  datasetSha256: text('dataset_sha256').notNull(),
  sourceRecordCount: integer('source_record_count').notNull(),
  importedRecordCount: integer('imported_record_count').notNull().default(0),
  rejectedRecordCount: integer('rejected_record_count').notNull().default(0),
  status: text('status').notNull(),
  analysisVersion: text('analysis_version').notNull(),
  reviewRevision: integer('review_revision').notNull().default(0),
  createdAt: text('created_at').notNull(),
  activatedAt: text('activated_at'),
});

export const exerciseDuplicateReviewGroups = sqliteTable(
  'exercise_duplicate_review_groups',
  {
    catalogVersionId: text('catalog_version_id')
      .notNull()
      .references(() => exerciseCatalogVersions.id),
    normalizedName: text('normalized_name').notNull(),
    sourceIdsJson: text('source_ids_json').notNull(),
    status: text('status').notNull().default('pending'),
    reason: text('reason'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: text('reviewed_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.catalogVersionId, table.normalizedName] })],
);

export const masterExercises = sqliteTable('master_exercises', {
  id: text('id').primaryKey(),
  canonicalId: text('canonical_id').notNull(),
  name: text('name').notNull(),
  nameLocalized: text('name_localized'),
  movementPattern: text('movement_pattern').notNull(),
  recommendedLevel: text('recommended_level'),
  goalTagsJson: text('goal_tags_json'),
  excludedLimitationsJson: text('excluded_limitations_json'),
  instructions: text('instructions'),
  catalogVersionId: text('catalog_version_id').references(() => exerciseCatalogVersions.id),
  bodyPart: text('body_part'),
  target: text('target'),
  primaryMuscle: text('primary_muscle'),
  secondaryMusclesJson: text('secondary_muscles_json'),
  instructionsJson: text('instructions_json'),
  attributesJson: text('attributes_json'),
  ...sourceMetadataColumns,
  ...timestamps,
});

export const exerciseMuscles = sqliteTable(
  'exercise_muscles',
  {
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => masterExercises.id),
    muscleId: text('muscle_id')
      .notNull()
      .references(() => masterMuscles.id),
    isPrimary: integer('is_primary').notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.exerciseId, table.muscleId] })],
);

export const exerciseEquipment = sqliteTable(
  'exercise_equipment',
  {
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => masterExercises.id),
    equipmentId: text('equipment_id')
      .notNull()
      .references(() => masterEquipment.id),
  },
  (table) => [primaryKey({ columns: [table.exerciseId, table.equipmentId] })],
);

export const exerciseMedia = sqliteTable('exercise_media', {
  id: text('id').primaryKey(),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => masterExercises.id),
  storageUrl: text('storage_url').notNull(),
  mediaType: text('media_type').notNull(),
  widthPx: integer('width_px'),
  heightPx: integer('height_px'),
  altText: text('alt_text'),
  storageProvider: text('storage_provider'),
  objectKey: text('object_key'),
  contentHash: text('content_hash'),
  ownershipStatus: text('ownership_status'),
  reviewStatus: text('review_status'),
  version: integer('version'),
  ...sourceMetadataColumns,
  ...timestamps,
});

export const bodyConsiderations = sqliteTable(
  'body_considerations',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    displayName: text('display_name').notNull(),
    groupCode: text('group_code').notNull(),
    bodyRegion: text('body_region').notNull(),
    kind: text('kind').notNull(),
    active: integer('active').notNull().default(1),
    severityEnabled: integer('severity_enabled').notNull().default(1),
    ...timestamps,
  },
  (table) => [uniqueIndex('body_considerations_code_unique').on(table.code)],
);

export const assessmentConsiderations = sqliteTable(
  'assessment_considerations',
  {
    assessmentId: text('assessment_id')
      .notNull()
      .references(() => assessments.id),
    considerationId: text('consideration_id')
      .notNull()
      .references(() => bodyConsiderations.id),
    severity: text('severity').notNull(),
    side: text('side').notNull().default('unspecified'),
    notes: text('notes'),
    inferred: integer('inferred').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.assessmentId, table.considerationId] })],
);

export const exerciseSafetyProfiles = sqliteTable(
  'exercise_safety_profiles',
  {
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => masterExercises.id),
    analysisVersion: text('analysis_version').notNull(),
    reviewStatus: text('review_status').notNull(),
    globalRating: text('global_rating').notNull(),
    coverageComplete: integer('coverage_complete').notNull().default(0),
    confidence: real('confidence'),
    summaryReason: text('summary_reason'),
    analysisSource: text('analysis_source').notNull(),
    manualOverride: integer('manual_override').notNull().default(0),
    reviewedBy: text('reviewed_by'),
    reviewedAt: text('reviewed_at'),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.exerciseId, table.analysisVersion] })],
);

export const exerciseConsiderationRatings = sqliteTable(
  'exercise_consideration_ratings',
  {
    id: text('id').primaryKey(),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => masterExercises.id),
    considerationId: text('consideration_id')
      .notNull()
      .references(() => bodyConsiderations.id),
    severity: text('severity').notNull(),
    rating: text('rating').notNull(),
    reason: text('reason').notNull(),
    requiredModification: text('required_modification'),
    confidence: real('confidence'),
    analysisSource: text('analysis_source').notNull(),
    ruleCodesJson: text('rule_codes_json'),
    analysisVersion: text('analysis_version').notNull(),
    manualOverride: integer('manual_override').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('exercise_consideration_ratings_exercise_consideration_severity_version_unique').on(
      table.exerciseId,
      table.considerationId,
      table.severity,
      table.analysisVersion,
    ),
  ],
);

export const exerciseAnalysisRuns = sqliteTable('exercise_analysis_runs', {
  id: text('id').primaryKey(),
  catalogVersionId: text('catalog_version_id')
    .notNull()
    .references(() => exerciseCatalogVersions.id),
  analysisVersion: text('analysis_version').notNull(),
  status: text('status').notNull(),
  processedCount: integer('processed_count').notNull().default(0),
  approvedCount: integer('approved_count').notNull().default(0),
  rejectedCount: integer('rejected_count').notNull().default(0),
  reviewRequiredCount: integer('review_required_count').notNull().default(0),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  lastError: text('last_error'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const exerciseAnalysisEvidence = sqliteTable('exercise_analysis_evidence', {
  id: text('id').primaryKey(),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => masterExercises.id),
  analysisRunId: text('analysis_run_id').references(() => exerciseAnalysisRuns.id),
  analysisVersion: text('analysis_version').notNull(),
  evidenceJson: text('evidence_json').notNull(),
  createdAt: text('created_at').notNull(),
});

export const exerciseAliases = sqliteTable('exercise_aliases', {
  id: text('id').primaryKey(),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => masterExercises.id),
  alias: text('alias').notNull(),
  locale: text('locale'),
  ...sourceMetadataColumns,
  ...timestamps,
});

export const aiAuditLogs = sqliteTable(
  'ai_audit_logs',
  {
    id: text('id').primaryKey(),
    traceId: text('trace_id').notNull(),
    userId: text('user_id'),
    task: text('task').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    prompt: text('prompt').notNull(),
    completion: text('completion'),
    status: text('status').notNull(),
    errorMessage: text('error_message'),
    schemaIssuesJson: text('schema_issues_json'),
    inputHash: text('input_hash'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    totalTokens: integer('total_tokens'),
    latencyMs: integer('latency_ms').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('ai_audit_logs_created_at_idx').on(table.createdAt),
    index('ai_audit_logs_trace_id_idx').on(table.traceId),
    index('ai_audit_logs_user_id_idx').on(table.userId),
  ],
);

