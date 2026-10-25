import { loadEnvironment, installShutdown } from './environment';
import { ConfigurationError, loadConfig } from '../foundation/config';
import { startWorker } from '../tasks/worker';
loadEnvironment();
const report = (code: string) => console.error(JSON.stringify({ level: 'error', code }));
try {
  const worker = await startWorker(loadConfig(), { onError: report });
  console.info(JSON.stringify({ level: 'info', code: 'worker_started', worker_id: worker.id }));
  installShutdown(() => worker.close(), report);
} catch (error) {
  report('worker_start_failed_check_database_and_migrations');
  if (error instanceof ConfigurationError) console.error(error.message);
  process.exitCode = 1;
}
