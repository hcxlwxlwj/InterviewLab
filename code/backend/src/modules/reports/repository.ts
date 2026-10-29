import type { InterviewComparison, InterviewEvaluation, InterviewReport } from '@interviewlab/core';
import type { Executor } from '../interviews/repository';
import type { interviewReports, reportEvaluations, interviewComparisons } from './schema';
import { ServiceError } from '../../foundation/errors';

export type ReportRow = typeof interviewReports.$inferSelect;
export type ComparisonRow = typeof interviewComparisons.$inferSelect;
export async function reportByInterview(
  db: Executor,
  owner: string,
  id: string,
  lock = false,
): Promise<ReportRow | null> {
  const r = await db.query<ReportRow>(
    `SELECT * FROM interview_reports WHERE owner_id=$1 AND interview_id=$2${lock ? ' FOR UPDATE' : ''}`,
    [owner, id],
  );
  return r.rows[0] ?? null;
}
export async function insertReport(
  db: Executor,
  id: string,
  owner: string,
  interviewId: string,
  digest: string,
  result: InterviewReport,
) {
  await db.query(
    'INSERT INTO interview_reports (id,owner_id,interview_id,input_digest,status,result) VALUES ($1,$2,$3,$4,$5,$6::jsonb)',
    [id, owner, interviewId, digest, result.status, JSON.stringify(result)],
  );
}
export async function updateReport(
  db: Executor,
  id: string,
  version: number,
  result: InterviewReport,
) {
  await db.query('UPDATE interview_reports SET version=$2,status=$3,result=$4::jsonb WHERE id=$1', [
    id,
    version,
    result.status,
    JSON.stringify(result),
  ]);
}
export async function evaluationRows(db: Executor, reportId: string) {
  return (
    await db.query<
      typeof reportEvaluations.$inferSelect & {
        task_status: string;
        attempts: number;
        max_attempts: number;
        error_code: string | null;
      }
    >(
      'SELECT e.*,t.status AS task_status,t.attempts,t.max_attempts,t.error_code FROM report_evaluations e LEFT JOIN tasks t ON t.id=e.task_id WHERE e.report_id=$1 ORDER BY e.turn_id',
      [reportId],
    )
  ).rows;
}
export async function putEvaluationTask(
  db: Executor,
  id: string,
  reportId: string,
  turnId: string,
  taskId: string,
) {
  await db.query(
    'INSERT INTO report_evaluations (id,report_id,turn_id,task_id) VALUES ($1,$2,$3,$4) ON CONFLICT(report_id,turn_id) DO UPDATE SET task_id=EXCLUDED.task_id',
    [id, reportId, turnId, taskId],
  );
}
export async function putEvaluationResult(
  db: Executor,
  reportId: string,
  turnId: string,
  taskId: string,
  value: InterviewEvaluation,
) {
  await db.query(
    'UPDATE report_evaluations SET result=$4::jsonb WHERE report_id=$1 AND turn_id=$2 AND task_id=$3',
    [reportId, turnId, taskId, JSON.stringify(value)],
  );
}
export async function setSummaryTask(
  db: Executor,
  reportId: string,
  taskId: string | null,
  digest: string | null,
) {
  await db.query(
    'UPDATE interview_reports SET summary_task_id=$2,summary_input_digest=$3 WHERE id=$1',
    [reportId, taskId, digest],
  );
}
export async function summaryTask(db: Executor, taskId: string) {
  return (
    await db.query<{
      task_status: string;
      attempts: number;
      max_attempts: number;
      error_code: string | null;
    }>('SELECT status AS task_status,attempts,max_attempts,error_code FROM tasks WHERE id=$1', [
      taskId,
    ])
  ).rows[0];
}
export async function pendingReports(db: Executor) {
  return (
    await db.query<ReportRow>(
      "SELECT * FROM interview_reports WHERE status IN ('pending','generating') ORDER BY created_at LIMIT 100",
    )
  ).rows;
}
export async function comparisonById(
  db: Executor,
  owner: string,
  id: string,
  lock = false,
): Promise<ComparisonRow> {
  const row = (
    await db.query<ComparisonRow>(
      `SELECT * FROM interview_comparisons WHERE owner_id=$1 AND id=$2${lock ? ' FOR UPDATE' : ''}`,
      [owner, id],
    )
  ).rows[0];
  if (!row) throw new ServiceError('not_found', 404, '比较不存在或不可访问');
  return row;
}
export async function comparisonByDigest(db: Executor, owner: string, digest: string) {
  return (
    await db.query<ComparisonRow>(
      'SELECT * FROM interview_comparisons WHERE owner_id=$1 AND input_digest=$2',
      [owner, digest],
    )
  ).rows[0];
}
export async function insertComparison(
  db: Executor,
  owner: string,
  digest: string,
  value: InterviewComparison,
  taskId: string,
) {
  await db.query(
    `INSERT INTO interview_comparisons (id,owner_id,original_interview_id,retry_interview_id,input_digest,input,task_id)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
    [
      value.id,
      owner,
      value.original_interview_id,
      value.retry_interview_id,
      digest,
      JSON.stringify(value),
      taskId,
    ],
  );
}
export async function updateComparison(
  db: Executor,
  id: string,
  version: number,
  taskId: string | null,
  status: string,
  result?: InterviewComparison,
) {
  await db.query(
    'UPDATE interview_comparisons SET version=$2,task_id=$3,status=$4,result=$5::jsonb WHERE id=$1',
    [id, version, taskId, status, result ? JSON.stringify(result) : null],
  );
}
export async function pendingComparisons(db: Executor) {
  return (
    await db.query<
      ComparisonRow & {
        task_status: string;
        attempts: number;
        max_attempts: number;
        error_code: string | null;
      }
    >(`SELECT c.*,t.status AS task_status,t.attempts,t.max_attempts,t.error_code
    FROM interview_comparisons c LEFT JOIN tasks t ON t.id=c.task_id WHERE c.status IN ('pending','generating') LIMIT 100`)
  ).rows;
}
export async function eraseReports(db: Executor, owner: string, interviewId: string) {
  const comparisons = await db.query<{ id: string; task_id: string }>(
    'SELECT id,task_id FROM interview_comparisons WHERE owner_id=$1 AND (original_interview_id=$2 OR retry_interview_id=$2)',
    [owner, interviewId],
  );
  await db.query(
    'DELETE FROM interview_comparisons WHERE owner_id=$1 AND (original_interview_id=$2 OR retry_interview_id=$2)',
    [owner, interviewId],
  );
  await db.query('DELETE FROM tasks WHERE owner_id=$1 AND id=ANY($2::uuid[])', [
    owner,
    comparisons.rows.map((r) => r.task_id),
  ]);
  await db.query(
    'DELETE FROM tasks WHERE owner_id=$1 AND id IN (SELECT summary_task_id FROM interview_reports WHERE owner_id=$1 AND interview_id=$2)',
    [owner, interviewId],
  );
  await db.query('DELETE FROM interview_reports WHERE owner_id=$1 AND interview_id=$2', [
    owner,
    interviewId,
  ]);
}
