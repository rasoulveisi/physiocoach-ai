export interface ExerciseDatasetImportSummary {
  accounted: number;
  imported: number;
  rejected: number;
  media: 0;
  duplicateNameGroups: number;
  catalogVersionId: string;
}

export function isGitCommitSha(value: string): boolean;

export function runExerciseDatasetImport(cliArgs?: Record<string, string | undefined>): Promise<{
  summary: ExerciseDatasetImportSummary;
  imported: unknown;
} | null>;
