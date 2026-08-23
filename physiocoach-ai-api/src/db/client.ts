import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DEFAULT_DATABASE_URL =
  'postgresql://neondb_owner:npg_T7m0LDSedrvi@ep-quiet-thunder-ax8hxhfy-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

export function createDb(connectionStringOrBinding?: string | { connectionString: string }) {
  const connectionString =
    typeof connectionStringOrBinding === 'object' &&
    connectionStringOrBinding !== null &&
    'connectionString' in connectionStringOrBinding
      ? connectionStringOrBinding.connectionString
      : typeof connectionStringOrBinding === 'string' && connectionStringOrBinding.length > 0
        ? connectionStringOrBinding
        : process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

  const client = postgres(connectionString, {
    max: 1,
    idle_timeout: 0,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
