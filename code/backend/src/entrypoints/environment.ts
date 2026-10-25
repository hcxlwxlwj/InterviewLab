import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
/** Works from the workspace directory, repository root and compiled dist entrypoints. */
export function loadEnvironment() {
  let directory = dirname(fileURLToPath(import.meta.url));
  while (dirname(directory) !== directory) {
    const manifest = join(directory, 'package.json');
    if (
      existsSync(manifest) &&
      JSON.parse(readFileSync(manifest, 'utf8')).name === 'interviewlab'
    ) {
      config({ path: join(directory, '.env'), quiet: true });
      return;
    }
    directory = dirname(directory);
  }
  config({ quiet: true });
}
export function installShutdown(close: () => Promise<unknown>, report: (code: string) => void) {
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    void close()
      .catch(() => {
        report('shutdown_failed');
        process.exitCode = 1;
      })
      .finally(() => {
        if (process.connected) process.disconnect();
      });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  // Node IPC allows supervisors/tests on Windows to request the same graceful close.
  if (process.send)
    process.on('message', (message) => {
      if (message === 'shutdown') shutdown();
    });
}
