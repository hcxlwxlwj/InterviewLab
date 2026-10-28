import { loadEnvironment, installShutdown } from './environment';
import { ConfigurationError, loadConfig } from '../foundation/config';
import { startWorker } from '../tasks/worker';
import { createDatabase } from '../database/connection';
import { createInterviewRuntime } from '../modules/interview-runtime';
loadEnvironment();
const report = (code: string) => console.error(JSON.stringify({ level: 'error', code }));
try {
  const config = loadConfig();
  const database = createDatabase(config);
  const runtime = createInterviewRuntime(database, config, {
    log: (entry) => console.info(JSON.stringify({ level: 'info', ...entry })),
  });
  const worker = await startWorker(config, {
    database,
    handlers: runtime.handlers,
    maintain: runtime.maintain,
    isCancelled: runtime.isCancelled,
    onError: report,
  }).catch(async (error) => {
    try {
      await runtime.close();
    } finally {
      await database.close();
    }
    throw error;
  });
  console.info(JSON.stringify({ level: 'info', code: 'worker_started', worker_id: worker.id }));
  installShutdown(async () => {
    try {
      await worker.close();
    } finally {
      await runtime.close();
      await database.close();
    }
  }, report);
} catch (error) {
  report('worker_start_failed_check_database_and_migrations');
  if (error instanceof ConfigurationError) console.error(error.message);
  process.exitCode = 1;
}
