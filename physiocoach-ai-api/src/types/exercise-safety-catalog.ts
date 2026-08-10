import { z } from 'zod';

export const severitySchema = z.enum(['mild', 'moderate', 'severe']);
export const suitabilitySchema = z.enum(['recommended', 'caution', 'avoid']);
export const reviewStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export const catalogStatusSchema = z.enum([
  'importing',
  'analyzing',
  'review_required',
  'ready',
  'active',
  'retired',
]);

export const assessmentConsiderationSchema = z.object({
  code: z.string().trim().min(1),
  severity: severitySchema,
  side: z.enum(['left', 'right', 'bilateral', 'unspecified']).default('unspecified'),
  notes: z.string().trim().max(500).optional(),
  inferred: z.boolean().default(false),
});

export const INITIAL_BODY_CONSIDERATIONS = [
  {
    code: 'neck_pain',
    displayName: 'Neck pain',
    groupCode: 'neck_posture',
    bodyRegion: 'neck',
    kind: 'pain',
  },
  {
    code: 'forward_head_posture',
    displayName: 'Forward-head posture',
    groupCode: 'neck_posture',
    bodyRegion: 'neck',
    kind: 'posture',
  },
  {
    code: 'shoulder_pain',
    displayName: 'Shoulder pain',
    groupCode: 'shoulder',
    bodyRegion: 'shoulder',
    kind: 'pain',
  },
  {
    code: 'rotator_cuff_sensitivity',
    displayName: 'Rotator-cuff sensitivity',
    groupCode: 'shoulder',
    bodyRegion: 'shoulder',
    kind: 'stability',
  },
  {
    code: 'rounded_shoulders',
    displayName: 'Rounded shoulders',
    groupCode: 'shoulder',
    bodyRegion: 'shoulder',
    kind: 'posture',
  },
  {
    code: 'elbow_pain',
    displayName: 'Elbow pain',
    groupCode: 'arm',
    bodyRegion: 'elbow',
    kind: 'pain',
  },
  {
    code: 'wrist_hand_pain',
    displayName: 'Wrist/hand pain',
    groupCode: 'arm',
    bodyRegion: 'wrist_hand',
    kind: 'pain',
  },
  {
    code: 'thoracic_discomfort',
    displayName: 'Thoracic discomfort',
    groupCode: 'spine',
    bodyRegion: 'thoracic_spine',
    kind: 'pain',
  },
  {
    code: 'lower_back_pain',
    displayName: 'Lower-back pain',
    groupCode: 'spine',
    bodyRegion: 'lumbar_spine',
    kind: 'pain',
  },
  { code: 'hip_pain', displayName: 'Hip pain', groupCode: 'hip', bodyRegion: 'hip', kind: 'pain' },
  {
    code: 'groin_adductor_sensitivity',
    displayName: 'Groin/adductor sensitivity',
    groupCode: 'hip',
    bodyRegion: 'groin_adductor',
    kind: 'pain',
  },
  {
    code: 'limited_hip_mobility',
    displayName: 'Limited hip mobility',
    groupCode: 'hip',
    bodyRegion: 'hip',
    kind: 'mobility',
  },
  {
    code: 'anterior_pelvic_tilt',
    displayName: 'Anterior pelvic tilt',
    groupCode: 'hip',
    bodyRegion: 'pelvis',
    kind: 'posture',
  },
  {
    code: 'knee_pain',
    displayName: 'Knee pain',
    groupCode: 'leg',
    bodyRegion: 'knee',
    kind: 'pain',
  },
  {
    code: 'ankle_foot_pain',
    displayName: 'Ankle/foot pain',
    groupCode: 'leg',
    bodyRegion: 'ankle_foot',
    kind: 'pain',
  },
  {
    code: 'limited_ankle_mobility',
    displayName: 'Limited ankle mobility',
    groupCode: 'leg',
    bodyRegion: 'ankle',
    kind: 'mobility',
  },
  {
    code: 'balance_limitation',
    displayName: 'Balance limitation',
    groupCode: 'functional',
    bodyRegion: 'functional',
    kind: 'stability',
  },
  {
    code: 'high_impact_intolerance',
    displayName: 'High-impact intolerance',
    groupCode: 'functional',
    bodyRegion: 'functional',
    kind: 'intolerance',
  },
] as const;
