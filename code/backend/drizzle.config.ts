import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';
config({ path: '../../.env', quiet: true });
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
});
