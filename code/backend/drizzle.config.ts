import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';
config({ path: '../../.env', quiet: true });
export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './src/database/schema.ts',
    './src/modules/accounts/auth-schema.ts',
    './src/modules/interviews/db-schema.ts',
    './src/modules/reports/db-schema.ts',
    './src/modules/resumes/db-schema.ts',
    './src/modules/jobs/db-schema.ts',
  ],
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
});
