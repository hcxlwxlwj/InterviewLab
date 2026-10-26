import { z } from 'zod';

const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional(),
);
const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().min(1).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  PUBLIC_ORIGIN: z.string().url().default('http://127.0.0.1:3000'),
  AUTH_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  BETTER_AUTH_SECRET: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(32).optional(),
  ),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: optionalUrl,
  KNOWLEDGE_DATABASE_URL: optionalUrl,
  KNOWLEDGE_PREVIEW: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  EMBEDDING_MODEL: z.literal('ecnu-embedding-small').default('ecnu-embedding-small'),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(10),
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(3000),
  BODY_LIMIT_BYTES: z.coerce.number().int().min(1024).max(10485760).default(1048576),
  WORKER_POLL_MS: z.coerce.number().int().min(100).max(60000).default(1000),
  WORKER_HEARTBEAT_MS: z.coerce.number().int().min(100).max(30000).default(5000),
  WORKER_STALE_MS: z.coerce.number().int().min(1000).max(300000).default(30000),
  LLM_BASE_URL: optionalUrl.default('https://chat.ecnu.edu.cn/open/api/v1'),
  LLM_API_KEY: z
    .string()
    .optional()
    .transform((value) => value?.trim()),
  LLM_MODEL: z.string().min(1).max(200).default('ecnu-plus'),
  LLM_OUTPUT_MODE: z.enum(['json_object', 'json_schema']).default('json_object'),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(100).max(45000).default(25000),
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
  if (config.KNOWLEDGE_PREVIEW && config.NODE_ENV === 'production')
    throw new ConfigurationError('Knowledge preview is unavailable in production');
  if (config.KNOWLEDGE_DATABASE_URL && !/^postgres(ql)?:\/\//.test(config.KNOWLEDGE_DATABASE_URL))
    throw new ConfigurationError('Knowledge database requires PostgreSQL');
  if (config.LLM_BASE_URL) {
    const endpoint = new URL(config.LLM_BASE_URL);
    if (
      !['https:', 'http:'].includes(endpoint.protocol) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    )
      throw new ConfigurationError(
        'Invalid configuration: LLM_BASE_URL must be an HTTP API base URL without credentials, query or fragment',
      );
  }
  const origin = new URL(config.PUBLIC_ORIGIN);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== config.PUBLIC_ORIGIN) {
    throw new ConfigurationError(
      'Invalid configuration: PUBLIC_ORIGIN must be an HTTP origin without a path',
    );
  }
  if (config.AUTH_ENABLED && (!config.DATABASE_URL || !config.BETTER_AUTH_SECRET)) {
    throw new ConfigurationError(
      'Invalid configuration: authentication requires DATABASE_URL and BETTER_AUTH_SECRET',
    );
  }
  if (config.AUTH_ENABLED && config.NODE_ENV === 'production' && origin.protocol !== 'https:') {
    throw new ConfigurationError('Invalid configuration: production authentication requires HTTPS');
  }
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
