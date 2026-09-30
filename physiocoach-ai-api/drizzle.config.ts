import fs from 'node:fs';
import { defineConfig } from 'drizzle-kit';

if (fs.existsSync('.dev.vars')) {
  process.loadEnvFile('.dev.vars');
} else if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});

