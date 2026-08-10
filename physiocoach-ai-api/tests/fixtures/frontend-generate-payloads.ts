import type { GeneratePlanInput } from '../../src/services/workout-generator';

export type FrontendGeneratePayloadFixture = {
  name: string;
  source: string;
  payload: GeneratePlanInput;
};

export const frontendGeneratePayloads: FrontendGeneratePayloadFixture[] = [
  {
    name: 'onboarding-default-posture-improvement',
    source:
      'Exact { profile, assessment } shape from OnboardingApiService.generatePlan using OnboardingStore initialState defaults.',
    payload: {
      profile: {
        age: 30,
        sex: 'prefer_not_to_say',
        heightCm: 175,
        weightKg: 75,
        lifestyle: 'desk_job',
        experienceLevel: 'beginner',
      },
      assessment: {
        goals: ['posture_improvement'],
        frequencyDays: 3,
        equipment: ['full_gym'],
        limitations: [],
        postureFlags: ['rounded_shoulders'],
      },
    },
  },
  {
    name: 'onboarding-shoulder-pain-dumbbells',
    source:
      'Exact { profile, assessment } shape from OnboardingApiService.generatePlan using frontend option values selected in onboarding.page.ts.',
    payload: {
      profile: {
        age: 42,
        sex: 'female',
        heightCm: 168,
        weightKg: 69,
        bodyFatEstimate: 28,
        lifestyle: 'desk_job',
        experienceLevel: 'beginner',
      },
      assessment: {
        goals: ['mobility', 'posture_improvement'],
        frequencyDays: 2,
        equipment: ['dumbbells_only', 'resistance_bands'],
        limitations: ['shoulder_pain', 'neck_pain'],
        postureFlags: ['rounded_shoulders', 'forward_head'],
      },
    },
  },
  {
    name: 'onboarding-intermediate-recomposition-home-gym',
    source:
      'Exact { profile, assessment } shape from OnboardingApiService.generatePlan using frontend option values selected in onboarding.page.ts.',
    payload: {
      profile: {
        age: 35,
        sex: 'male',
        heightCm: 181,
        weightKg: 86,
        lifestyle: 'active',
        experienceLevel: 'intermediate',
      },
      assessment: {
        goals: ['recomposition', 'strength'],
        frequencyDays: 4,
        equipment: ['home_gym'],
        limitations: ['lower_back_pain'],
        postureFlags: ['anterior_pelvic_tilt', 'tight_hips', 'lower_back_discomfort'],
      },
    },
  },
  {
    name: 'reported-identical-days-posture-fat-loss-muscle-gain',
    source:
      'Exact { profile, assessment } shape from the reported localhost Generate API request; headers and bearer token intentionally omitted.',
    payload: {
      profile: {
        age: 30,
        sex: 'prefer_not_to_say',
        heightCm: 173,
        weightKg: 75,
        bodyFatEstimate: 30,
        lifestyle: 'desk_job',
        experienceLevel: 'intermediate',
      },
      assessment: {
        goals: ['posture_improvement', 'fat_loss', 'muscle_gain'],
        frequencyDays: 3,
        equipment: ['full_gym'],
        limitations: [],
        postureFlags: ['rounded_shoulders'],
      },
    },
  },
];
