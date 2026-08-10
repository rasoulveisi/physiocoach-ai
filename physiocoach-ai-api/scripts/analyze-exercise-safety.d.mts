export interface ExerciseSafetyAnalysisSummary {
  datasetSha256: string;
  analyzed: number;
  total: number;
  complete: boolean;
}

export function parseCliArgs(argv: string[]): Record<string, string>;

export function runExerciseSafetyAnalysis(cliArgs?: Record<string, string>): Promise<{
  artifact: unknown;
  state: unknown;
  summary: ExerciseSafetyAnalysisSummary;
} | null>;
