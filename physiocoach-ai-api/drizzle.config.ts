import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: 'postgresql://neondb_owner:npg_T7m0LDSedrvi@ep-quiet-thunder-ax8hxhfy-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require',
  },
});
