import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DEFAULT_DATABASE_URL = process.env.DATABASE_URL || '';

export function createDb(connectionStringOrBinding?: string | { connectionString: string }) {
  const connectionString =
    typeof connectionStringOrBinding === 'object' &&
    connectionStringOrBinding !== null &&
    'connectionString' in connectionStringOrBinding
      ? connectionStringOrBinding.connectionString
      : typeof connectionStringOrBinding === 'string' && connectionStringOrBinding.length > 0
        ? connectionStringOrBinding
        : process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

  if (!connectionString) {
    throw new Error('Database connection is not configured. Set DATABASE_URL or provide connectionString.');
  }

  const client = postgres(connectionString, {
    max: 5,
    idle_timeout: 10,
    connect_timeout: 10,
    prepare: false,
    fetch_types: false,
  });

  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
