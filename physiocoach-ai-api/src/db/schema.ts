import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

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

export const users = pgTable(
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
export const authCredentials = pgTable(
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
export const authOauthAccounts = pgTable(
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
export const authSessions = pgTable(
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

export const authRefreshTokenHistory = pgTable(
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

export const profiles = pgTable('profiles', {
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

export const assessments = pgTable('assessments', {
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

export const workoutPlans = pgTable('workout_plans', {
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

export const workoutSessions = pgTable(
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

export const exerciseLogs = pgTable('exercise_logs', {
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
  completed: boolean('completed').notNull().default(false),
  notes: text('notes'),
  exerciseType: text('exercise_type').notNull().default('working'),
  previousPerformanceJson: text('previous_performance_json'),
});

export const userSettings = pgTable(
  'user_settings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    theme: text('theme').notNull(),
    unitSystem: text('unit_system').notNull(),
    defaultWorkoutView: text('default_workout_view').notNull(),
    remindersEnabled: boolean('reminders_enabled').notNull().default(false),
    restTimerSeconds: integer('rest_timer_seconds').notNull().default(90),
    autoStartRestTimer: boolean('auto_start_rest_timer').notNull().default(true),
    restTimerSoundEnabled: boolean('rest_timer_sound_enabled').notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('user_settings_user_id_unique').on(table.userId)],
);

export const masterMuscles = pgTable('master_muscles', {
  id: text('id').primaryKey(),
  canonicalId: text('canonical_id').notNull(),
  name: text('name').notNull(),
  nameLocalized: text('name_localized'),
  ...sourceMetadataColumns,
  ...timestamps,
});

export const masterEquipment = pgTable('master_equipment', {
  id: text('id').primaryKey(),
  canonicalId: text('canonical_id').notNull(),
  name: text('name').notNull(),
  nameLocalized: text('name_localized'),
  ...sourceMetadataColumns,
  ...timestamps,
});

export const exerciseCatalogVersions = pgTable('exercise_catalog_versions', {
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

export const masterExercises = pgTable('master_exercises', {
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

export const exerciseMuscles = pgTable(
  'exercise_muscles',
  {
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => masterExercises.id),
    muscleId: text('muscle_id')
      .notNull()
      .references(() => masterMuscles.id),
    isPrimary: boolean('is_primary').notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.exerciseId, table.muscleId] })],
);

export const exerciseEquipment = pgTable(
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

export const exerciseMedia = pgTable('exercise_media', {
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

export const bodyConsiderations = pgTable(
  'body_considerations',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    displayName: text('display_name').notNull(),
    groupCode: text('group_code').notNull(),
    bodyRegion: text('body_region').notNull(),
    kind: text('kind').notNull(),
    active: boolean('active').notNull().default(true),
    severityEnabled: boolean('severity_enabled').notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex('body_considerations_code_unique').on(table.code)],
);

export const assessmentConsiderations = pgTable(
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
    inferred: boolean('inferred').notNull().default(false),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.assessmentId, table.considerationId] })],
);

export const exerciseSafetyProfiles = pgTable(
  'exercise_safety_profiles',
  {
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => masterExercises.id),
    analysisVersion: text('analysis_version').notNull(),
    reviewStatus: text('review_status').notNull(),
    globalRating: text('global_rating').notNull(),
    coverageComplete: boolean('coverage_complete').notNull().default(false),
    confidence: real('confidence'),
    summaryReason: text('summary_reason'),
    analysisSource: text('analysis_source').notNull(),
    manualOverride: boolean('manual_override').notNull().default(false),
    reviewedBy: text('reviewed_by'),
    reviewedAt: text('reviewed_at'),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.exerciseId, table.analysisVersion] })],
);

export const exerciseConsiderationRatings = pgTable(
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
    manualOverride: boolean('manual_override').notNull().default(false),
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

export const aiAuditLogs = pgTable(
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

export const coachProfiles = pgTable(
  'coach_profiles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clinicName: text('clinic_name'),
    specialty: text('specialty'),
    licenseNumber: text('license_number'),
    ...timestamps,
  },
  (table) => [uniqueIndex('coach_profiles_user_id_unique').on(table.userId)],
);

export const coachClients = pgTable(
  'coach_clients',
  {
    id: text('id').primaryKey(),
    coachId: text('coach_id').notNull(),
    clientUserId: text('client_user_id'),
    clientEmail: text('client_email').notNull(),
    clientName: text('client_name').notNull(),
    injuryDiagnosis: text('injury_diagnosis').notNull(),
    dischargeDate: text('discharge_date'),
    status: text('status').notNull().default('active'),
    complianceScore: real('compliance_score').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index('coach_clients_coach_id_idx').on(table.coachId),
    index('coach_clients_client_user_id_idx').on(table.clientUserId),
  ],
);

export const coachAssignedPlans = pgTable(
  'coach_assigned_plans',
  {
    id: text('id').primaryKey(),
    coachId: text('coach_id').notNull(),
    clientUserId: text('client_user_id'),
    workoutPlanId: text('workout_plan_id').notNull(),
    clinicalNotes: text('clinical_notes'),
    assignedAt: text('assigned_at').notNull(),
    status: text('status').notNull().default('active'),
  },
  (table) => [
    index('coach_assigned_plans_coach_idx').on(table.coachId),
    index('coach_assigned_plans_client_idx').on(table.clientUserId),
  ],
);

export const coachSeatLicenses = pgTable(
  'coach_seat_licenses',
  {
    id: text('id').primaryKey(),
    coachId: text('coach_id').notNull(),
    tier: text('tier').notNull(),
    totalSeats: integer('total_seats').notNull(),
    usedSeats: integer('used_seats').notNull().default(0),
    inviteCode: text('invite_code'),
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),
    status: text('status').notNull().default('active'),
    ...timestamps,
  },
  (table) => [
    index('coach_seat_licenses_coach_id_idx').on(table.coachId),
  ],
);

export const coachClientInvites = pgTable(
  'coach_client_invites',
  {
    id: text('id').primaryKey(),
    licenseId: text('license_id').references(() => coachSeatLicenses.id),
    coachId: text('coach_id').notNull(),
    clientEmail: text('client_email').notNull(),
    clientName: text('client_name').notNull(),
    inviteToken: text('invite_token').notNull(),
    status: text('status').notNull().default('pending'),
    redeemedAt: text('redeemed_at'),
    redeemedUserId: text('redeemed_user_id'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('coach_client_invites_invite_token_unique').on(table.inviteToken),
    index('coach_client_invites_coach_id_idx').on(table.coachId),
    index('coach_client_invites_license_id_idx').on(table.licenseId),
  ],
);

export const coachMessages = pgTable(
  'coach_messages',
  {
    id: text('id').primaryKey(),
    coachId: text('coach_id').notNull(),
    clientId: text('client_id').notNull(),
    senderRole: text('sender_role').notNull(),
    senderName: text('sender_name').notNull(),
    message: text('message').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    isPainAlert: boolean('is_pain_alert').notNull().default(false),
    painScore: integer('pain_score'),
    jointRegion: text('joint_region'),
    relatedSessionId: text('related_session_id'),
    ...timestamps,
  },
  (table) => [
    index('coach_messages_coach_id_idx').on(table.coachId),
    index('coach_messages_client_id_idx').on(table.clientId),
    index('coach_messages_created_at_idx').on(table.createdAt),
  ],
);

export const coachPainAlerts = pgTable(
  'coach_pain_alerts',
  {
    id: text('id').primaryKey(),
    coachId: text('coach_id').notNull(),
    clientId: text('client_id').notNull(),
    clientName: text('client_name').notNull(),
    painScore: integer('pain_score').notNull(),
    jointRegion: text('joint_region').notNull(),
    exerciseName: text('exercise_name'),
    sessionDate: text('session_date').notNull(),
    status: text('status').notNull().default('active'),
    clinicalNote: text('clinical_note'),
    resolvedAt: text('resolved_at'),
    ...timestamps,
  },
  (table) => [
    index('coach_pain_alerts_coach_id_idx').on(table.coachId),
    index('coach_pain_alerts_client_id_idx').on(table.clientId),
    index('coach_pain_alerts_status_idx').on(table.status),
  ],
);

export const workoutPlanRatings = pgTable(
  'workout_plan_ratings',
  {
    id: text('id').primaryKey(),
    workoutPlanId: text('workout_plan_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    review: text('review'),
    ...timestamps,
  },
  (table) => [
    index('workout_plan_ratings_plan_idx').on(table.workoutPlanId),
    index('workout_plan_ratings_user_idx').on(table.userId),
    uniqueIndex('workout_plan_ratings_plan_user_unique').on(
      table.workoutPlanId,
      table.userId,
    ),
  ],
);


