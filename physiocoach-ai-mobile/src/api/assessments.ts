/**
 * PhysioCoach AI — Physical & Movement Assessment API client.
 */

import { request } from './client';

export interface BodyConsiderationOption {
  code: string;
  displayName: string;
  groupCode: string;
  bodyRegion: string;
  kind: string;
  severityEnabled: boolean;
}

export interface AssessmentConsideration {
  code: string;
  severity: 'mild' | 'moderate' | 'severe';
  side: 'left' | 'right' | 'bilateral' | 'unspecified';
  notes?: string;
  inferred?: boolean;
}

export interface AssessmentInput {
  goals: Array<
    | 'muscle_gain'
    | 'fat_loss'
    | 'posture_improvement'
    | 'mobility'
    | 'strength'
    | 'aesthetics'
    | 'recomposition'
  >;
  frequencyDays: number;
  sessionMinutes?: number;
  equipment: Array<'full_gym' | 'dumbbells_only' | 'home_gym' | 'resistance_bands'>;
  considerations: AssessmentConsideration[];
  limitations?: Array<'shoulder_pain' | 'knee_pain' | 'lower_back_pain' | 'neck_pain'>;
  postureFlags?: Array<
    | 'rounded_shoulders'
    | 'forward_head'
    | 'anterior_pelvic_tilt'
    | 'tight_hips'
    | 'lower_back_discomfort'
  >;
}

export interface AssessmentRecord {
  id?: string;
  goals: string[];
  frequencyDays: number;
  sessionMinutes?: number;
  equipment: string[];
  limitations: string[];
  postureFlags: string[];
  considerations: AssessmentConsideration[];
  completedAt: string;
  inputHash?: string;
}

/** GET /considerations — list available physical assessment consideration choices. */
export async function getConsiderationOptions(): Promise<{ data: BodyConsiderationOption[] }> {
  try {
    return await request<{ data: BodyConsiderationOption[] }>('/considerations', {
      method: 'GET',
      auth: false,
    });
  } catch {
    return {
      data: [
        {
          code: 'rounded_shoulders',
          displayName: 'Rounded shoulders',
          groupCode: 'posture',
          bodyRegion: 'shoulders',
          kind: 'posture',
          severityEnabled: true,
        },
        {
          code: 'neck_pain',
          displayName: 'Neck pain or stiffness',
          groupCode: 'neck',
          bodyRegion: 'neck',
          kind: 'pain',
          severityEnabled: true,
        },
        {
          code: 'shoulder_pain',
          displayName: 'Shoulder pain',
          groupCode: 'shoulders',
          bodyRegion: 'shoulders',
          kind: 'pain',
          severityEnabled: true,
        },
        {
          code: 'lower_back_pain',
          displayName: 'Lower-back pain',
          groupCode: 'back',
          bodyRegion: 'lower_back',
          kind: 'pain',
          severityEnabled: true,
        },
        {
          code: 'knee_pain',
          displayName: 'Knee pain',
          groupCode: 'knees',
          bodyRegion: 'knees',
          kind: 'pain',
          severityEnabled: true,
        },
      ],
    };
  }
}

/** GET /assessments/latest — fetch the athlete's most recent physical assessment. */
export async function getLatestAssessment(): Promise<{ data: AssessmentRecord | null }> {
  try {
    return await request<{ data: AssessmentRecord | null }>('/assessments/latest');
  } catch {
    return { data: null };
  }
}

/** POST /assessments — save full movement & injury assessment. */
export async function submitAssessment(
  input: AssessmentInput,
): Promise<{ data: AssessmentRecord }> {
  return request<{ data: AssessmentRecord }>('/assessments', {
    method: 'POST',
    body: input,
  });
}
