import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type {
  Interview,
  InterviewMemory,
  InterviewRetrieval,
  InterviewConfig,
  InterviewQuestion,
  InterviewSnapshot,
  InterviewTurn,
} from '@interviewlab/core';
import { ServiceError } from '../../foundation/errors';
import type { interviews, interviewTurns } from './schema';
import { participationPolicy } from './participation';
import { INTERVIEW_V3 } from '@interviewlab/core';

export type Executor = Pick<PoolClient, 'query'>;
export interface InterviewState {
  owner: string;
  view: Interview;
  snapshot: InterviewSnapshot | null;
  memory?: InterviewMemory | null;
  retrievals?: Record<string, InterviewRetrieval>;
  generationKind: 'plan' | 'advance' | 'clarify' | null;
  retryQuestion: InterviewQuestion | null;
}
const iso = (date: Date | null) => date?.toISOString() ?? null;
export async function loadInterview(
  executor: Executor,
  owner: string,
  id: string,
  lock = false,
): Promise<InterviewState> {
  const result = await executor.query<typeof interviews.$inferSelect>(
    `SELECT * FROM interviews WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL${lock ? ' FOR UPDATE' : ''}`,
    [id, owner],
  );
  const row = result.rows[0];
  if (!row) throw new ServiceError('not_found', 404, '面试不存在或不可访问');
  const turns = await executor.query<typeof interviewTurns.$inferSelect>(
    'SELECT * FROM interview_turns WHERE interview_id=$1 ORDER BY main_question_index,follow_up_index',
    [id],
  );
  const started = iso(row.started_at);
  const state: InterviewState = {
    owner,
    snapshot: row.snapshot,
    memory: row.agent_memory,
    retrievals: Object.fromEntries(
      turns.rows.filter((t) => t.knowledge_context).map((t) => [t.id, t.knowledge_context!]),
    ),
    generationKind: row.generation_kind as InterviewState['generationKind'],
    retryQuestion: row.retry_question,
    view: {
      id: row.id,
      version: row.version,
      configuration: row.configuration,
      status: row.status as Interview['status'],
      created_at: row.created_at.toISOString(),
      started_at: started,
      ended_at: iso(row.ended_at),
      end_reason: row.end_reason,
      job_title: row.snapshot?.job_title ?? row.configuration.job,
      plan: row.plan,
      generation_id: row.generation_id,
      generation_status: row.generation_status as Interview['generation_status'],
      task_id: row.task_id,
      clarification: row.clarification,
      target_at: started
        ? new Date(Date.parse(started) + row.configuration.duration_minutes * 60000).toISOString()
        : null,
      deadline_at: started ? new Date(Date.parse(started) + 720000).toISOString() : null,
      parent_interview_id: row.parent_interview_id,
      parent_turn_id: row.parent_turn_id,
      parent_revision: row.parent_revision,
      retry_goal: row.retry_goal,
      turns: turns.rows.map((t) => ({
        ...t.question,
        id: t.id,
        main_question_index: t.main_question_index,
        follow_up_index: t.follow_up_index,
        generation_id: t.generation_id,
        presented_at: iso(t.presented_at),
        answer_status: t.answer_status as InterviewTurn['answer_status'],
        answer_text: t.answer_text,
        revision: t.revision,
        answered_at: iso(t.answered_at),
        input_mode: 'text_fallback',
      })),
    },
  };
  state.view.participation =
    row.snapshot?.prompt_version === INTERVIEW_V3 ? participationPolicy(state.view) : null;
  return state;
}
export async function saveInterview(executor: Executor, state: InterviewState) {
  const v = state.view;
  await executor.query(
    `INSERT INTO interviews (id,owner_id,configuration,version,status,snapshot,plan,generation_id,generation_kind,generation_status,task_id,clarification,
    parent_interview_id,parent_turn_id,parent_revision,retry_question,retry_goal,created_at,started_at,ended_at,end_reason,agent_memory)
    VALUES ($1,$2,$3::jsonb,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20,$21,$22::jsonb)
    ON CONFLICT(id) DO UPDATE SET configuration=EXCLUDED.configuration,version=EXCLUDED.version,status=EXCLUDED.status,snapshot=EXCLUDED.snapshot,plan=EXCLUDED.plan,
      generation_id=EXCLUDED.generation_id,generation_kind=EXCLUDED.generation_kind,generation_status=EXCLUDED.generation_status,task_id=EXCLUDED.task_id,clarification=EXCLUDED.clarification,
      parent_interview_id=EXCLUDED.parent_interview_id,parent_turn_id=EXCLUDED.parent_turn_id,parent_revision=EXCLUDED.parent_revision,retry_question=EXCLUDED.retry_question,
      retry_goal=EXCLUDED.retry_goal,started_at=EXCLUDED.started_at,ended_at=EXCLUDED.ended_at,end_reason=EXCLUDED.end_reason,agent_memory=EXCLUDED.agent_memory`,
    [
      v.id,
      state.owner,
      JSON.stringify(v.configuration),
      v.version,
      v.status,
      JSON.stringify(state.snapshot),
      JSON.stringify(v.plan),
      v.generation_id,
      state.generationKind,
      v.generation_status,
      v.task_id,
      v.clarification,
      v.parent_interview_id,
      v.parent_turn_id,
      v.parent_revision,
      JSON.stringify(state.retryQuestion),
      v.retry_goal,
      v.created_at,
      v.started_at,
      v.ended_at,
      v.end_reason,
      JSON.stringify(state.memory ?? null),
    ],
  );
  if (v.generation_status !== 'pending')
    await executor.query('DELETE FROM interview_generation_streams WHERE interview_id=$1', [v.id]);
  await executor.query("SELECT pg_notify('interview_generation',$1)", [v.id]);
  for (const turn of v.turns) {
    const {
      text,
      topic,
      purpose,
      knowledge_question_id,
      source_refs,
      evidence_refs,
      stage,
      acknowledgement,
    } = turn;
    await executor.query(
      `INSERT INTO interview_turns (id,interview_id,question,generation_id,main_question_index,follow_up_index,presented_at,answer_status,answer_text,revision,answered_at,knowledge_context)
      VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) ON CONFLICT(id) DO UPDATE SET
      presented_at=EXCLUDED.presented_at,answer_status=EXCLUDED.answer_status,answer_text=EXCLUDED.answer_text,revision=EXCLUDED.revision,answered_at=EXCLUDED.answered_at`,
      [
        turn.id,
        v.id,
        JSON.stringify({
          text,
          topic,
          purpose,
          knowledge_question_id,
          source_refs,
          evidence_refs,
          stage,
          acknowledgement,
        }),
        turn.generation_id,
        turn.main_question_index,
        turn.follow_up_index,
        turn.presented_at,
        turn.answer_status,
        turn.answer_text,
        turn.revision,
        turn.answered_at,
        JSON.stringify(state.retrievals?.[turn.id] ?? null),
      ],
    );
  }
}
export function newInterviewState(owner: string, configuration: InterviewConfig): InterviewState {
  return {
    owner,
    snapshot: null,
    memory: null,
    retrievals: {},
    generationKind: null,
    retryQuestion: null,
    view: {
      id: randomUUID(),
      version: 1,
      configuration,
      status: 'ready',
      created_at: new Date().toISOString(),
      started_at: null,
      ended_at: null,
      end_reason: null,
      job_title: configuration.job,
      plan: [],
      turns: [],
      generation_id: null,
      generation_status: 'idle',
      task_id: null,
      clarification: null,
      target_at: null,
      deadline_at: null,
      parent_interview_id: null,
      parent_turn_id: null,
      parent_revision: null,
      retry_goal: null,
    },
  };
}
export async function interviewEvent(
  executor: Executor,
  id: string,
  type: string,
  turnId?: string,
  content?: string,
) {
  await executor.query(
    'INSERT INTO interview_events (id,interview_id,type,turn_id,content) VALUES ($1,$2,$3,$4,$5)',
    [randomUUID(), id, type, turnId ?? null, content ?? null],
  );
}
export async function cancelInterviewTasks(executor: Executor, id: string) {
  await executor.query(
    `UPDATE tasks SET status='cancelled',execution_token=NULL,lease_until=NULL WHERE payload->>'interview_id'=$1 AND status IN ('queued','running','failed')`,
    [id],
  );
}
export async function eraseInterview(executor: Executor, owner: string, id: string) {
  await executor.query('DELETE FROM interview_generation_streams WHERE interview_id=$1', [id]);
  await executor.query("SELECT pg_notify('interview_generation',$1)", [id]);
  await executor.query('DELETE FROM interview_turns WHERE interview_id=$1', [id]);
  await executor.query('DELETE FROM interview_events WHERE interview_id=$1', [id]);
  await executor.query("DELETE FROM tasks WHERE owner_id=$1 AND payload->>'interview_id'=$2", [
    owner,
    id,
  ]);
  await executor.query(
    'UPDATE interviews SET parent_interview_id=NULL,parent_turn_id=NULL,parent_revision=NULL,version=version+1 WHERE parent_interview_id=$1',
    [id],
  );
  await executor.query('DELETE FROM interviews WHERE id=$1 AND owner_id=$2', [id, owner]);
}
