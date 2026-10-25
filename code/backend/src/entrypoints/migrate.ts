import { loadEnvironment } from './environment';
import { loadConfig } from '../foundation/config';
import { createDatabase } from '../database/connection';
import { migrateDatabase } from '../database/migrate';
loadEnvironment();
const config = loadConfig();
const database = createDatabase(config);
try {
  await migrateDatabase(database);
  console.info('Foundation migrations applied');
} finally {
  await database.close();
}
