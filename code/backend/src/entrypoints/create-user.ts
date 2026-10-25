import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { loadEnvironment } from './environment';
import { loadConfig } from '../foundation/config';
import { createDatabase } from '../database/connection';
import { createInvitedUser } from '../modules/accounts/provision';

loadEnvironment();
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('Use an interactive local terminal to provision an invited account.');
  process.exitCode = 1;
} else {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  let database: ReturnType<typeof createDatabase> | undefined;
  try {
    const config = loadConfig();
    if (!config.AUTH_ENABLED) throw new Error('Enable authentication first');
    const email = await prompt.question('Email: ');
    const name = await prompt.question('Display name: ');
    const requestedRole = await prompt.question(
      'Role [student / content_maintainer / operator] (default: student): ',
    );
    const role = (['student', 'content_maintainer', 'operator'] as const).find(
      (value) => value === (requestedRole || 'student'),
    );
    if (!role) throw new Error('Invalid role');
    const password = randomBytes(24).toString('base64url');
    database = createDatabase(config);
    await createInvitedUser(database, { email, name, password, role });
    // This is the sole intentional credential output, only in the administrator's local TTY.
    console.log(
      'Account created. Save this generated password securely; it is shown once:\n' + password,
    );
  } catch {
    console.error(
      'Account creation failed. Check configuration, migrations, input and whether the email already exists.',
    );
    process.exitCode = 1;
  } finally {
    prompt.close();
    await database?.close();
  }
}
