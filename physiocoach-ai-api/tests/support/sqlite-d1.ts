import { execFileSync } from 'node:child_process';

/** Minimal D1-compatible adapter that runs Drizzle's generated SQL against real SQLite. */
export function createSqliteD1(databasePath: string): D1Database {
  class Statement {
    constructor(
      readonly sql: string,
      readonly parameters: unknown[] = [],
    ) {}

    bind(...parameters: unknown[]) {
      return new Statement(this.sql, parameters);
    }

    rendered() {
      let index = 0;
      return this.sql.replaceAll('?', () => sqlLiteral(this.parameters[index++]));
    }

    async raw() {
      const rows = queryJson(databasePath, this.rendered());
      return rows.map((row) => Object.values(row));
    }

    async all() {
      return { success: true, results: queryJson(databasePath, this.rendered()), meta: {} };
    }

    async run() {
      const rows = queryJson(databasePath, `${this.rendered()}; SELECT changes() AS changes;`);
      return { success: true, results: [], meta: { changes: Number(rows.at(-1)?.changes ?? 0) } };
    }
  }

  return {
    prepare(sql: string) {
      return new Statement(sql) as unknown as D1PreparedStatement;
    },
    async batch(statements: D1PreparedStatement[]) {
      const rendered = statements.map((statement) => statement as unknown as Statement);
      const body = rendered
        .map(
          (statement, index) =>
            `${statement.rendered()}; INSERT INTO _d1_batch_changes VALUES (${index}, changes());`,
        )
        .join('\n');
      const rows = queryJson(
        databasePath,
        `BEGIN; CREATE TEMP TABLE _d1_batch_changes (idx INTEGER, changes INTEGER); ${body} SELECT idx, changes FROM _d1_batch_changes ORDER BY idx; DROP TABLE _d1_batch_changes; COMMIT;`,
      );
      return rows.map((row) => ({
        success: true,
        results: [],
        meta: { changes: Number(row.changes ?? 0) },
      })) as unknown as D1Result[];
    },
  } as unknown as D1Database;
}

function queryJson(databasePath: string, sql: string): Array<Record<string, unknown>> {
  const output = execFileSync('sqlite3', ['-json', databasePath, sql], { encoding: 'utf8' }).trim();
  return output ? (JSON.parse(output) as Array<Record<string, unknown>>) : [];
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) return `'${value.toISOString().replaceAll("'", "''")}'`;
  return `'${String(value).replaceAll("'", "''")}'`;
}
