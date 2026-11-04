/** Test tools never fall back to a development or application database. */
export function testDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  try {
    const url = new URL(env.TEST_DATABASE_URL ?? '');
    if (
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
      /^interviewlab_test[a-z0-9_]*$/.test(decodeURIComponent(url.pathname.slice(1)))
    )
      return url.toString();
  } catch {
    // Do not include connection strings or parser errors in test output.
  }
  throw new Error(
    'TEST_DATABASE_URL must point to a dedicated interviewlab_test* PostgreSQL database',
  );
}
