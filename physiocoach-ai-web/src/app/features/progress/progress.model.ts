export interface ProgressSummary {
  workoutsCompletedThisWeek: number;
  streakDays: number;
  personalRecords: number;
  totalVolumeThisWeek: number;
  plateauDetected: boolean;
  complianceScore: number;
  warnings: string[];
}

export interface BodyMeasurement {
  id: string;
  measuredAt: string;
  bodyWeightKg: number;
  bodyFatEstimate?: number | null;
  neckCm?: number | null;
  shouldersCm?: number | null;
  chestCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
  upperArmLeftCm?: number | null;
  upperArmRightCm?: number | null;
  forearmLeftCm?: number | null;
  forearmRightCm?: number | null;
  thighLeftCm?: number | null;
  thighRightCm?: number | null;
  calfLeftCm?: number | null;
  calfRightCm?: number | null;
  notes?: string | null;
}
