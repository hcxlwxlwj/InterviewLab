import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { config as dotenv } from 'dotenv';
import { loadConfig } from '../../../code/backend/src/foundation/config';
import { createDatabase, type Database } from '../../../code/backend/src/database/connection';
import { migrateDatabase } from '../../../code/backend/src/database/migrate';
import { createInvitedUser } from '../../../code/backend/src/modules/accounts/provision';
import { buildApp } from '../../../code/backend/src/server/app';
import { enqueueTask } from '../../../code/backend/src/tasks/service';

dotenv({ quiet: true });
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !/^interviewlab_test[a-z0-9_]*$/.test(new URL(testUrl).pathname.slice(1)))
  throw new Error(
    'Authentication tests require a dedicated interviewlab_test* database; no tests were skipped',
  );
const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: testUrl,
  AUTH_ENABLED: 'true',
  BETTER_AUTH_SECRET: randomBytes(32).toString('base64url'),
  LOG_LEVEL: 'silent',
});
let database: Database;
let app: Awaited<ReturnType<typeof buildApp>>;
const password = randomBytes(24).toString('base64url');
const email = `${randomUUID()}@example.test`;
let user: Awaited<ReturnType<typeof createInvitedUser>>;
const origin = config.PUBLIC_ORIGIN;
const registeredIds: string[] = [];
before(async () => {
  database = createDatabase(config);
  await migrateDatabase(database);
  user = await createInvitedUser(database, { email, password, name: 'Synthetic student' });
  app = await buildApp({
    config,
    database,
    logger: false,
    modules: [
      {
        name: 'knowledge',
        async register(instance, access) {
          instance.get('/test-private', async (request) => access.requireIdentity(request));
          instance.post('/test-maintainer', async (request) => {
            const principal = await access.requireIdentity(request);
            access.requireRole(principal, 'content_maintainer');
            return { ok: true };
          });
        },
      },
    ],
  });
});
beforeEach(async () => {
  await database.pool.query('TRUNCATE auth_sessions, auth_rate_limits');
});
after(async () => {
  await app?.close();
  if (database) {
    if (user) {
      await database.pool.query('DELETE FROM tasks WHERE owner_id=$1', [user.id]);
      await database.pool.query('DELETE FROM audit_events WHERE resource_id=$1', [user.id]);
      await database.pool.query('DELETE FROM auth_users WHERE id=$1', [user.id]);
    }
    for (const id of registeredIds)
      await database.pool.query('DELETE FROM auth_users WHERE id=$1', [id]);
    await database.pool.query('TRUNCATE auth_rate_limits');
    await database.close();
  }
});
async function login() {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/sign-in/email',
    headers: { origin },
    payload: { email, password },
  });
  assert.equal(response.statusCode, 200, response.body);
  const cookies = response.headers['set-cookie'];
  assert.ok(cookies);
  const values = Array.isArray(cookies) ? cookies : [cookies];
  const cookie = values.map((value) => value.split(';')[0]).join('; ');
  return { response, values, cookie };
}

test('invited account login sets an HttpOnly cookie; session exposes no credentials and cannot trust owner headers', async () => {
  assert.equal((await app.inject('/api/v1/auth/session')).json(), null);
  const { response, values, cookie } = await login();
  assert.deepEqual(response.json(), { success: true });
  assert.ok(
    values.some(
      (value) => /HttpOnly/i.test(value) && /SameSite=Lax/i.test(value) && /Path=\//i.test(value),
    ),
  );
  const current = await app.inject({ url: '/api/v1/auth/session', headers: { cookie } });
  assert.equal(current.json().user.id, user.id);
  assert.deepEqual(current.json().roles, ['student']);
  assert.ok(!/token|password|secret/i.test(current.body));
  assert.equal(current.headers['cache-control'], 'no-store');
  const principal = (
    await app.inject({
      url: '/api/v1/test-private',
      headers: { cookie, 'x-owner-id': 'attacker', 'x-role': 'operator' },
    })
  ).json();
  assert.deepEqual(principal, { owner_id: user.id, roles: ['student'] });
  assert.equal(
    (await app.inject({ url: '/api/v1/test-private', headers: { 'x-owner-id': user.id } }))
      .statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/v1/test-maintainer',
        headers: { cookie, origin },
        payload: {},
      })
    ).statusCode,
    403,
  );
  await database.pool.query("UPDATE auth_users SET role='content_maintainer' WHERE id=$1", [
    user.id,
  ]);
  try {
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/test-maintainer',
          headers: { cookie, origin },
          payload: {},
        })
      ).statusCode,
      200,
    );
  } finally {
    await database.pool.query("UPDATE auth_users SET role='student' WHERE id=$1", [user.id]);
  }
  const stored = await database.pool.query('SELECT password FROM auth_accounts WHERE user_id=$1', [
    user.id,
  ]);
  assert.notEqual(stored.rows[0].password, password);
  assert.equal((await app.inject('/api/v1/capabilities')).json().authentication, true);
});

test('logout, expiry and revocation invalidate the server session; cookie authentication respects task ownership', async () => {
  const { cookie } = await login();
  const task = await database.transaction((tx) =>
    enqueueTask(tx, { owner_id: user.id, type: 'test.auth', key: randomUUID(), input: {} }),
  );
  assert.equal(
    (await app.inject({ url: `/api/v1/tasks/${task.id}`, headers: { cookie } })).statusCode,
    200,
  );
  const other = await database.transaction((tx) =>
    enqueueTask(tx, { owner_id: 'someone-else', type: 'test.auth', key: randomUUID(), input: {} }),
  );
  assert.equal(
    (await app.inject({ url: `/api/v1/tasks/${other.id}`, headers: { cookie } })).statusCode,
    404,
  );
  await database.pool.query('DELETE FROM tasks WHERE id=$1', [other.id]);
  const out = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/sign-out',
    headers: { cookie, origin },
    payload: {},
  });
  assert.equal(out.statusCode, 200, out.body);
  assert.ok(out.headers['set-cookie']);
  assert.equal(
    (await app.inject({ url: '/api/v1/auth/session', headers: { cookie } })).json(),
    null,
  );
  const second = await login();
  await database.pool.query(
    "UPDATE auth_sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",
    [user.id],
  );
  assert.equal(
    (await app.inject({ url: '/api/v1/test-private', headers: { cookie: second.cookie } }))
      .statusCode,
    401,
  );
  const third = await login();
  await database.pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [user.id]);
  assert.equal(
    (await app.inject({ url: '/api/v1/test-private', headers: { cookie: third.cookie } }))
      .statusCode,
    401,
  );
});

test('origin policy rejects missing and foreign origins before authentication; role injection stays closed', async () => {
  for (const headers of [{}, { origin: 'https://attacker.test', host: 'attacker.test' }]) {
    const rejected = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in/email',
      headers,
      payload: { email, password },
    });
    assert.equal(rejected.statusCode, 403);
    assert.equal(rejected.json().code, 'forbidden');
  }
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/sign-up/email',
        headers: { origin },
        payload: {
          email: 'new@example.test',
          password,
          name: 'No privileged registration',
          role: 'operator',
        },
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/sign-in/email',
        headers: { origin },
        payload: { email, password, role: 'operator' },
      })
    ).statusCode,
    400,
  );
  const bad = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/sign-in/email',
    headers: { origin },
    payload: { email, password: 'incorrect' },
  });
  assert.equal(bad.statusCode, 401, bad.body);
  assert.deepEqual(Object.keys(bad.json()).sort(), ['code', 'message', 'request_id', 'retryable']);
  assert.ok(!bad.body.includes(email));
});

test('login rate limits persist across application instances and do not trust client IP headers', async () => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in/email',
      headers: { origin, 'x-forwarded-for': `192.0.2.${attempt + 1}` },
      payload: { email, password: 'incorrect' },
    });
    assert.equal(response.statusCode, 401, response.body);
  }
  const restarted = await buildApp({ config, database, logger: false });
  try {
    const limited = await restarted.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in/email',
      headers: { origin },
      payload: { email, password },
    });
    assert.equal(limited.statusCode, 429, limited.body);
    assert.equal(limited.json().code, 'rate_limited');
  } finally {
    await restarted.close();
  }
});

test('duplicate invitations are case insensitive and cannot leave an unlinked account', async () => {
  await assert.rejects(
    createInvitedUser(database, { email: email.toUpperCase(), password, name: 'Duplicate' }),
  );
  assert.equal(
    (await database.pool.query('SELECT count(*) FROM auth_accounts WHERE user_id=$1', [user.id]))
      .rows[0].count,
    '1',
  );
});

test('HTTPS authentication uses Secure host-only cookies', async () => {
  const secureOrigin = 'https://interview.example.test';
  const secure = await buildApp({
    config: { ...config, NODE_ENV: 'production', PUBLIC_ORIGIN: secureOrigin },
    database,
    logger: false,
  });
  try {
    const response = await secure.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in/email',
      headers: { origin: secureOrigin },
      payload: { email, password },
    });
    assert.equal(response.statusCode, 200, response.body);
    const cookies = response.headers['set-cookie'];
    assert.ok(cookies);
    const values = Array.isArray(cookies) ? cookies : [cookies];
    assert.ok(values.some((value) => /; Secure/i.test(value) && /HttpOnly/i.test(value)));
    assert.ok(values.every((value) => !/Domain=/i.test(value)));
  } finally {
    await secure.close();
  }
});

test('authentication dependency failure returns a safe 503 and clears the capability flag', async () => {
  const { cookie } = await login();
  const offline = await buildApp({
    config: {
      ...config,
      DATABASE_URL: 'postgresql://unused@127.0.0.1:1/unavailable',
      DATABASE_CONNECT_TIMEOUT_MS: 100,
    },
    logger: false,
  });
  try {
    const current = await offline.inject({ url: '/api/v1/auth/session', headers: { cookie } });
    assert.equal(current.statusCode, 503, current.body);
    assert.equal(current.json().code, 'dependency_unavailable');
    assert.ok(!/unused|ECONNREFUSED|postgresql/.test(current.body));
    assert.equal((await offline.inject('/api/v1/capabilities')).json().authentication, false);
    const signupUnavailable = await offline.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-up/email',
      headers: { origin },
      payload: { name: 'Offline', email: `${randomUUID()}@example.test`, password },
    });
    assert.equal(signupUnavailable.statusCode, 503, signupUnavailable.body);
    assert.ok(!/unused|ECONNREFUSED|postgresql/.test(signupUnavailable.body));
  } finally {
    await offline.close();
  }
});

async function signup(signupEmail = `${randomUUID()}@example.test`, remoteAddress = '127.0.0.1') {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/sign-up/email',
    remoteAddress,
    headers: { origin },
    payload: { name: '  Registered student  ', email: signupEmail, password },
  });
}
function responseCookie(response: Awaited<ReturnType<typeof signup>>) {
  const headers = response.headers['set-cookie'];
  assert.ok(headers);
  return (Array.isArray(headers) ? headers : [headers])
    .map((item) => item.split(';')[0])
    .join('; ');
}
async function registeredSession(response: Awaited<ReturnType<typeof signup>>) {
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json(), { success: true });
  const cookie = responseCookie(response);
  const session = (await app.inject({ url: '/api/v1/auth/session', headers: { cookie } })).json();
  registeredIds.push(session.user.id);
  return { cookie, session };
}

test('registration normalizes identity, hashes credentials and signs in with a safe student session', async () => {
  const signupEmail = `${randomUUID()}@EXAMPLE.TEST`;
  const response = await signup(signupEmail);
  const { cookie, session } = await registeredSession(response);
  assert.equal(session.user.email, signupEmail.toLowerCase());
  assert.equal(session.user.name, 'Registered student');
  assert.deepEqual(session.roles, ['student']);
  const stored = (
    await database.pool.query(
      'SELECT a.password,u.email_verified FROM auth_accounts a JOIN auth_users u ON u.id=a.user_id WHERE u.id=$1',
      [session.user.id],
    )
  ).rows[0];
  assert.notEqual(stored.password, password);
  assert.ok(stored.password.length > password.length);
  const signIn = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/sign-in/email',
    headers: { origin },
    payload: { email: signupEmail.toLowerCase(), password },
  });
  assert.equal(signIn.statusCode, 200, signIn.body);
  assert.equal(stored.email_verified, false);
  const repeated = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/sign-up/email',
    headers: { origin },
    payload: {
      email: signupEmail.toLowerCase(),
      name: 'Overwrite attempt',
      password: password + '-changed',
    },
  });
  assert.equal(repeated.statusCode, 409, repeated.body);
  assert.equal(repeated.json().code, 'email_already_exists');
  assert.equal(
    (
      await database.pool.query('SELECT password FROM auth_accounts WHERE user_id=$1', [
        session.user.id,
      ])
    ).rows[0].password,
    stored.password,
  );
  assert.ok(!/token|password|secret/i.test(response.body));
  assert.equal(
    (await app.inject({ url: '/api/v1/test-private', headers: { cookie } })).statusCode,
    200,
  );
});

test('registration validates all fields and rejects privileged or provider-only fields and foreign origins', async () => {
  const valid = { name: 'Student', email: `${randomUUID()}@example.test`, password };
  for (const fields of [
    { name: ' ' },
    { name: 'n'.repeat(101) },
    { email: 'invalid' },
    { email: 'e'.repeat(245) + '@example.test' },
    { password: 'short' },
    { password: 'p'.repeat(129) },
    { role: 'operator' },
    { owner_id: 'other' },
    { callbackURL: 'https://attacker.test' },
  ]) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-up/email',
      headers: { origin },
      payload: { ...valid, ...fields },
    });
    assert.equal(response.statusCode, 400, response.body);
  }
  for (const headers of [{}, { origin: 'https://attacker.test' }])
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/auth/sign-up/email',
          headers,
          payload: valid,
        })
      ).statusCode,
      403,
    );
  assert.equal(
    (await database.pool.query('SELECT count(*) FROM auth_users WHERE email=$1', [valid.email]))
      .rows[0].count,
    '0',
  );
});

test('concurrent registration leaves exactly one linked account and does not overwrite its password', async () => {
  const signupEmail = `${randomUUID()}@example.test`;
  const responses = await Promise.all([
    signup(signupEmail, '192.0.2.30'),
    signup(signupEmail, '192.0.2.31'),
  ]);
  assert.deepEqual(responses.map((r) => r.statusCode).sort(), [200, 409]);
  const { session } = await registeredSession(responses.find((r) => r.statusCode === 200)!);
  assert.equal(
    (
      await database.pool.query('SELECT count(*) FROM auth_accounts WHERE user_id=$1', [
        session.user.id,
      ])
    ).rows[0].count,
    '1',
  );
  assert.equal(
    (await database.pool.query('SELECT count(*) FROM auth_users WHERE email=$1', [signupEmail]))
      .rows[0].count,
    '1',
  );
});

test('registration rate limit persists after restarting and ignores forged forwarding headers', async () => {
  for (let index = 0; index < 5; index++) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-up/email',
      headers: { origin, 'x-forwarded-for': `192.0.2.${index}` },
      payload: { name: 'Duplicate', email, password },
    });
    assert.equal(response.statusCode, 409, response.body);
  }
  const restarted = await buildApp({ config, database, logger: false });
  try {
    const response = await restarted.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-up/email',
      headers: { origin },
      payload: { name: 'Duplicate', email, password },
    });
    assert.equal(response.statusCode, 429, response.body);
  } finally {
    await restarted.close();
  }
});

test('two registered cookie accounts isolate real interviews and a privileged role cannot access another account', async () => {
  const first = await registeredSession(await signup());
  const second = await registeredSession(await signup());
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/interviews',
    headers: { cookie: first.cookie, origin, 'idempotency-key': randomUUID() },
    payload: {
      job: 'frontend',
      career_stage: 'internship',
      interview_type: 'technical_qa',
      difficulty: '基础',
      duration_minutes: 5,
      interviewer_style: '标准',
      interaction_mode: 'text_fallback',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const interview = created.json();
  try {
    await database.pool.query("UPDATE auth_users SET role='operator' WHERE id=$1", [
      second.session.user.id,
    ]);
    const own = (
      await app.inject({ url: '/api/v1/interviews', headers: { cookie: first.cookie } })
    ).json();
    const other = (
      await app.inject({ url: '/api/v1/interviews', headers: { cookie: second.cookie } })
    ).json();
    assert.ok(own.items.some((item: { id: string }) => item.id === interview.id));
    assert.equal(other.items.length, 0);
    for (const suffix of ['', '/report', `/events?generation_id=${randomUUID()}`]) {
      assert.equal(
        (
          await app.inject({
            url: `/api/v1/interviews/${interview.id}${suffix}`,
            headers: { cookie: second.cookie },
          })
        ).statusCode,
        404,
      );
      assert.equal(
        (await app.inject({ url: `/api/v1/interviews/${interview.id}${suffix}` })).statusCode,
        401,
      );
    }
    assert.equal(
      (
        await app.inject({
          method: 'DELETE',
          url: `/api/v1/interviews/${interview.id}`,
          headers: { cookie: second.cookie, origin, 'idempotency-key': randomUUID() },
          payload: { version: interview.version },
        })
      ).statusCode,
      404,
    );
  } finally {
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/interviews/${interview.id}`,
      headers: { cookie: first.cookie, origin, 'idempotency-key': randomUUID() },
      payload: { version: interview.version },
    });
    assert.equal(removed.statusCode, 204, removed.body);
  }
});
