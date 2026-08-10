export function runImportScript(cliArgs?: Record<string, string | undefined>): Promise<{
  outFile: string;
  sql: string;
} | null>;

export function buildCatalogImportSql(
  seed: Record<string, unknown>,
  options?: { replace?: boolean },
): string;
