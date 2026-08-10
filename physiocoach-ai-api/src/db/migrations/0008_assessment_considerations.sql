INSERT OR IGNORE INTO `body_considerations` (
  `id`, `code`, `display_name`, `group_code`, `body_region`, `kind`, `active`, `severity_enabled`, `created_at`, `updated_at`
) VALUES
  ('bc_neck_pain','neck_pain','Neck pain','neck_posture','neck','pain',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_forward_head_posture','forward_head_posture','Forward-head posture','neck_posture','neck','posture',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_shoulder_pain','shoulder_pain','Shoulder pain','shoulder','shoulder','pain',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_rotator_cuff_sensitivity','rotator_cuff_sensitivity','Rotator-cuff sensitivity','shoulder','shoulder','stability',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_rounded_shoulders','rounded_shoulders','Rounded shoulders','shoulder','shoulder','posture',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_elbow_pain','elbow_pain','Elbow pain','arm','elbow','pain',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_wrist_hand_pain','wrist_hand_pain','Wrist/hand pain','arm','wrist_hand','pain',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_thoracic_discomfort','thoracic_discomfort','Thoracic discomfort','spine','thoracic_spine','pain',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_lower_back_pain','lower_back_pain','Lower-back pain','spine','lumbar_spine','pain',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_hip_pain','hip_pain','Hip pain','hip','hip','pain',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_groin_adductor_sensitivity','groin_adductor_sensitivity','Groin/adductor sensitivity','hip','groin_adductor','pain',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_limited_hip_mobility','limited_hip_mobility','Limited hip mobility','hip','hip','mobility',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_anterior_pelvic_tilt','anterior_pelvic_tilt','Anterior pelvic tilt','hip','pelvis','posture',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_knee_pain','knee_pain','Knee pain','leg','knee','pain',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_ankle_foot_pain','ankle_foot_pain','Ankle/foot pain','leg','ankle_foot','pain',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_limited_ankle_mobility','limited_ankle_mobility','Limited ankle mobility','leg','ankle','mobility',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_balance_limitation','balance_limitation','Balance limitation','functional','functional','stability',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z'),
  ('bc_high_impact_intolerance','high_impact_intolerance','High-impact intolerance','functional','functional','intolerance',1,1,'2026-07-28T00:00:00.000Z','2026-07-28T00:00:00.000Z');
--> statement-breakpoint
INSERT OR IGNORE INTO `assessment_considerations` (`assessment_id`,`consideration_id`,`severity`,`side`,`notes`,`inferred`,`created_at`)
SELECT `assessment_id`,`consideration_id`,`severity`,'unspecified',NULL,1,`created_at` FROM (
  SELECT assessments.`id` AS `assessment_id`, 'bc_' || limitations.value AS `consideration_id`, 'moderate' AS `severity`, assessments.`completed_at` AS `created_at`
  FROM `assessments` JOIN json_each(assessments.`limitations_json`) AS limitations
  WHERE json_valid(assessments.`limitations_json`) AND limitations.value IN ('shoulder_pain','knee_pain','lower_back_pain','neck_pain')
  UNION ALL
  SELECT assessments.`id`, CASE posture_flags.value WHEN 'forward_head' THEN 'bc_forward_head_posture' WHEN 'tight_hips' THEN 'bc_limited_hip_mobility' WHEN 'lower_back_discomfort' THEN 'bc_lower_back_pain' ELSE 'bc_' || posture_flags.value END, 'mild', assessments.`completed_at`
  FROM `assessments` JOIN json_each(assessments.`posture_flags_json`) AS posture_flags
  WHERE json_valid(assessments.`posture_flags_json`) AND posture_flags.value IN ('rounded_shoulders','forward_head','anterior_pelvic_tilt','tight_hips','lower_back_discomfort')
);
