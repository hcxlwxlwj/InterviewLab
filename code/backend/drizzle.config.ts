import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';
config({ path: '../../.env', quiet: true });
export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './src/database/schema.ts',
    './src/modules/accounts/auth-schema.ts',
    './src/modules/interviews/schema.ts',
    './src/modules/reports/schema.ts',
    './src/modules/resumes/schema.ts',
    './src/modules/jobs/schema.ts',
  ],
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
});
