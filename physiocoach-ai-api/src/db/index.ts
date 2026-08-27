import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { WorkerBindings } from '../env';
import * as schema from './schema';

export function getDb(bindings: Partial<WorkerBindings> = process.env) {
  const connectionString =
    bindings?.HYPERDRIVE?.connectionString ||
    bindings?.DATABASE_URL ||
    (bindings === process.env ? process.env.DATABASE_URL : undefined);

  if (!connectionString) {
    throw new Error('Database connection is not configured.');
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

export type Database = ReturnType<typeof getDb>;

