import { mkdir, writeFile } from 'node:fs/promises';
import { loadEnvironment } from './environment';
import { loadConfig } from '../foundation/config';
import { buildApp } from '../server/app';
loadEnvironment();
// Contract export never needs a database, worker or user credentials.
const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });
const app = await buildApp({ config, logger: false });
try {
  await mkdir('dist', { recursive: true });
  await writeFile('dist/openapi.json', JSON.stringify(app.swagger(), null, 2) + '\n');
  console.info('Exported dist/openapi.json');
} finally {
  await app.close();
}
