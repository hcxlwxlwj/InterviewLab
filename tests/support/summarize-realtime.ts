import { config as dotenv } from 'dotenv';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
async function main() {
  dotenv({ quiet: true });
  const files = (await readdir('tests/artifacts'))
    .filter((f) => /^realtime-\d+-32.json$/.test(f))
    .sort();
  const file = files.at(-1);
  if (!file) throw new Error('No 32-round result');
  const result = JSON.parse(await readFile('tests/artifacts/' + file, 'utf8'));
  const source = process.env.INTERVIEW_DEV_DATABASE_URL!;
  const url = new URL(source);
  url.pathname = '/interviewlab_test_realtime';
  const pool = new Pool({ connectionString: url.toString() });
  try {
    const ids = [...new Set(result.metrics.map((x: { interview_id: string }) => x.interview_id))];
    const rows = await pool.query(
      "SELECT knowledge_context->>'mode' AS mode,count(*)::int AS turns,count(*) FILTER(WHERE jsonb_array_length(knowledge_context->'chunks')>0)::int AS nonempty FROM interview_turns WHERE interview_id=ANY($1::uuid[]) AND jsonb_typeof(knowledge_context)='object' GROUP BY 1",
      [ids],
    );
    const reports = await pool.query(
      'SELECT count(*)::int AS count FROM interview_reports WHERE interview_id=ANY($1::uuid[])',
      [ids],
    );
    const out = {
      file,
      summary: result.summary,
      retrieval: rows.rows,
      reports: reports.rows[0].count,
      repair_attempts: result.logs.filter((x: { code?: string }) => x.code && x.code !== 'ok')
        .length,
    };
    console.log(JSON.stringify(out));
    await writeFile('tests/artifacts/realtime-summary.json', JSON.stringify(out, null, 2));
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error('Unable to summarize validation');
  process.exitCode = 1;
});
