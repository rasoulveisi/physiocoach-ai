export interface AdminSummary {
  requestedAt: string;
  userId: string;
  canAccessInternalOps: boolean;
  features: string[];
  dataQuality: {
    plateauDetectionEnabled: boolean;
    trustSignalsTracked: boolean;
    postureAnalysisAvailable: boolean;
  };
}

export interface AdminHealth {
  ok: boolean;
  route: string;
  requestedAt: string;
}
