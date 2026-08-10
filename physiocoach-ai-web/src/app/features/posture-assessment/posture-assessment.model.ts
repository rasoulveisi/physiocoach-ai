export interface LatestAssessment {
  goals: string[];
  frequencyDays: number;
  equipment: string[];
  limitations: string[];
  postureFlags: string[];
  considerations: AssessmentConsideration[];
  completedAt: string;
  inputHash: string;
}

export interface AssessmentConsideration {
  code: string;
  severity: 'mild' | 'moderate' | 'severe';
  side: 'left' | 'right' | 'bilateral' | 'unspecified';
  notes?: string;
  inferred: boolean;
}

export interface Recommendation {
  risk: string;
  recommendation: string;
}
