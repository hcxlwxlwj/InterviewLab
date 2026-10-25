import { loadEnvironment, installShutdown } from './environment';
import { ConfigurationError, loadConfig } from '../foundation/config';
import { buildApp } from '../server/app';
loadEnvironment();
try {
  const config = loadConfig();
  const app = await buildApp({ config });
  installShutdown(
    () => app.close(),
    (code) => app.log.error({ code }, 'Shutdown failed'),
  );
  try {
    await app.listen({ host: config.API_HOST, port: config.API_PORT });
  } catch (error) {
    await app.close();
    throw error;
  }
} catch (error) {
  // Sanitized startup failure: never serialize config, connection strings or private errors.
  console.error(
    JSON.stringify({
      level: 'error',
      code: 'api_start_failed',
      message:
        error instanceof ConfigurationError
          ? error.message
          : 'Check configuration, port and dependency availability',
    }),
  );
  process.exitCode = 1;
}
