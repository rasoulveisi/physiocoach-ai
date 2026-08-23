import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { WorkerBindings } from '../env';
import * as schema from './schema';

export function getDb(bindings: Partial<WorkerBindings> = process.env) {
  const connectionString = bindings.HYPERDRIVE?.connectionString || bindings.DATABASE_URL;

  if (!connectionString) {
    throw new Error('Database connection is not configured.');
  }

  const client = postgres(connectionString, { max: 1, idle_timeout: 0 });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof getDb>;
