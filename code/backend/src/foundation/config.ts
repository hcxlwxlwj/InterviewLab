import { z } from 'zod';

const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional(),
);
const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().min(1).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: optionalUrl,
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(10),
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(3000),
  BODY_LIMIT_BYTES: z.coerce.number().int().min(1024).max(10485760).default(1048576),
  WORKER_POLL_MS: z.coerce.number().int().min(100).max(60000).default(1000),
  WORKER_HEARTBEAT_MS: z.coerce.number().int().min(100).max(30000).default(5000),
  WORKER_STALE_MS: z.coerce.number().int().min(1000).max(300000).default(30000),
});
export type BackendConfig = z.infer<typeof environmentSchema>;
export class ConfigurationError extends Error {}

export function loadConfig(env: Record<string, unknown> = process.env): BackendConfig {
  const parsed = environmentSchema.safeParse(env);
  // Never include environment values or Zod input objects in configuration errors.
  if (!parsed.success)
    throw new ConfigurationError(
      'Invalid configuration: ' +
        parsed.error.issues.map((issue) => issue.path.join('.') + ' ' + issue.message).join('; '),
    );
  const config = parsed.data;
  if (config.DATABASE_URL && !/^postgres(ql)?:\/\//.test(config.DATABASE_URL)) {
    throw new ConfigurationError('Invalid configuration: DATABASE_URL must use PostgreSQL');
  }
  if (config.WORKER_STALE_MS <= config.WORKER_HEARTBEAT_MS * 2) {
    throw new ConfigurationError(
      'Invalid configuration: WORKER_STALE_MS must exceed two heartbeat intervals',
    );
  }
  return config;
}
