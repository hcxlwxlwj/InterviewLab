/** 报告 Agent 组件回归：验证规划隔离、证据记忆、知识过滤及真实图中的脱敏工具轨迹。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  InterviewSnapshot,
  InterviewTurn,
  InterviewRetrieval,
  InterviewEvaluation,
} from '@interviewlab/core';
import {
  planEvaluation,
  planSummary,
  planAdvice,
} from '../../code/backend/src/modules/reports/agent/core/planner';
import {
  evaluationAnswerEvidence,
  summaryEvidenceMemory,
} from '../../code/backend/src/modules/reports/agent/core/memory';
import { professionalEvaluationReferences } from '../../code/backend/src/modules/reports/agent/knowledge/references';
import { createReportAgent } from '../../code/backend/src/modules/reports/agent/core/agent';
import type { ReportModelCall } from '../../code/backend/src/modules/reports/agent/core/guardrails';

const snapshot: InterviewSnapshot = {
  job_title: '后端开发',
  model: 'synthetic-model',
  prompt_version: 'test',
  rubric_version: 'test',
  knowledge: {
    content_version: 'frozen',
    questions: [],
    sources: [
      {
        id: 'source',
        title: '合成专业资料',
        url: 'https://example.test/reference',
        publisher: '合成',
        kind: 'official_documentation',
        usage: 'reference_only',
        verification: 'page_read',
        acquired_at: '2026-11-28',
        reviewed_at: '2026-11-28',
        notes: '',
      },
    ],
    missing_reason: null,
  },
  personal_material: {
    id: 'private',
    kind: 'resume',
    version: 3,
    title: '合成简历',
    text: 'PRIVATE-RESUME-MARKER',
    confirmed: true,
    created_at: '2026-11-28',
  },
};
const signal = () => new AbortController().signal;
const turn = (index = 1, follow = 0): InterviewTurn => ({
  id: `t${index}-${follow}`,
  text: '请说明负责的工作。',
  topic: '职责',
  purpose: '了解本人行动',
  knowledge_question_id: null,
  source_refs: [],
  evidence_refs: [],
  main_question_index: index,
  follow_up_index: follow,
  generation_id: 'synthetic',
  presented_at: null,
  answer_status: 'answered',
  answer_text: '我负责接口。验证了冲突处理。',
  revision: 2,
  input_mode: 'text_fallback',
  answered_at: null,
  stage: 'experience',
});

test('report planning isolates scoring material and keeps only earlier answered turns in the current topic', () => {
  const current = turn(2, 2),
    earlier = turn(2, 0),
    follow = turn(2, 1);
  const context = {
    main_question: '主问题',
    earlier_answers: [],
    earlier_turns: [
      follow,
      turn(1),
      current,
      { ...turn(2, 3), answer_status: 'skipped' as const },
      earlier,
    ],
  };
  const planned = planEvaluation([current, snapshot, signal(), false, context]);
  assert.deepEqual(
    planned.context?.earlier_turns?.map((t) => t.id),
    [earlier.id, follow.id],
  );
  assert.equal(planned.snapshot.personal_material, undefined);
  assert.equal(planned.snapshot.resume_analysis, undefined);
  assert.equal(planSummary([[], snapshot, signal(), false]).snapshot.personal_material, undefined);
  assert.equal(
    planAdvice([[], snapshot, signal(), false]).snapshot.personal_material?.text,
    'PRIVATE-RESUME-MARKER',
  );
  assert.equal(snapshot.personal_material?.version, 3);
});

test('report working memory preserves exact answer versions and links checked findings to their source', () => {
  const current = turn(),
    prior = { ...turn(1, 1), answer_text: '合成'.repeat(190) };
  const memory = evaluationAnswerEvidence([current, prior], prior.id);
  assert.ok(memory.currentIds.size > 1);
  for (const [id, ref] of memory.catalog) {
    const original = [current, prior].find((t) => t.id === ref.turn_id)!;
    assert.equal(ref.revision, original.revision);
    assert.ok(original.answer_text!.includes(ref.quote));
    assert.ok(ref.quote.length <= 180);
    assert.equal(memory.currentIds.has(id), ref.turn_id === prior.id);
  }
  const ref = memory.catalog.get('g0-0')!;
  const evaluation: InterviewEvaluation = {
    turn_id: current.id,
    revision: 2,
    strengths: [{ text: '描述本人行动', evidence_refs: [ref] }],
    gaps: [],
    reference_points: [],
    retry_goal: '补充验证过程',
    dimensions: [],
    limitations: [],
  };
  const summary = summaryEvidenceMemory([evaluation]);
  assert.deepEqual(summary.catalog.get(summary.indexed[0].strengths[0].evidence_ids[0]), ref);
});

test('report knowledge rejects stale releases, unknown sources and nonprofessional chunks', () => {
  const chunk: InterviewRetrieval['chunks'][number] = {
    id: 'valid',
    card_id: 'card',
    release: 'frozen',
    kind: 'evaluation_reference',
    text: '合成专业参考',
    source_refs: ['source'],
    goals: [],
    types: [],
  };
  const retrieval: InterviewRetrieval = {
    release: 'frozen',
    mode: 'prefetched',
    missing_reason: null,
    chunks: [
      chunk,
      { ...chunk, id: 'unknown', source_refs: ['unknown'] },
      { ...chunk, id: 'empty', source_refs: [] },
      { ...chunk, id: 'method', kind: 'interview_method' },
    ],
  };
  assert.deepEqual(
    professionalEvaluationReferences(snapshot, retrieval).map((c) => c.id),
    ['valid'],
  );
  assert.deepEqual(
    professionalEvaluationReferences(snapshot, { ...retrieval, release: 'stale' }),
    [],
  );
  assert.equal(
    professionalEvaluationReferences(snapshot, { ...retrieval, chunks: Array(8).fill(chunk) })
      .length,
    5,
  );
});

test('report LangGraph invokes the registered tool with sanitized scoring input and no private trace payload', async () => {
  const logs: object[] = [];
  const call: ReportModelCall = async (kind, schema, input) => {
    assert.equal(kind, 'evaluate');
    assert.ok(!JSON.stringify(input).includes('PRIVATE-RESUME-MARKER'));
    return schema.parse({
      scores: Array.from({ length: 6 }, () => [0, '无评分证据', null]),
      strengths: [],
      gaps: [],
      retry_goal: '补充验证过程',
      reference_points: [],
    });
  };
  const agent = createReportAgent(call, (entry) => logs.push(entry));
  const result = await agent.evaluate(turn(), snapshot, signal(), false);
  assert.equal(result.turn_id, turn().id);
  const toolTrace = logs.find((entry) => 'tool' in entry) as Record<string, unknown>;
  assert.equal(toolTrace.tool, 'evaluate_answer');
  assert.equal(toolTrace.status, 'ok');
  assert.deepEqual(Object.keys(toolTrace).sort(), ['duration_ms', 'status', 'tool']);
  assert.ok(logs.some((entry) => 'node' in entry && entry.node === 'validate'));
  assert.ok(!JSON.stringify(logs).includes(turn().answer_text!));
  assert.ok(!JSON.stringify(logs).includes('PRIVATE-RESUME-MARKER'));
});

test('report tool failures remain failures and cancelled work never invokes the model', async () => {
  const logs: object[] = [],
    failure = new Error('synthetic model failure');
  let calls = 0;
  const call: ReportModelCall = async () => {
    calls++;
    throw failure;
  };
  const agent = createReportAgent(call, (entry) => logs.push(entry));
  await assert.rejects(agent.suggest([], snapshot, signal(), false), (error) => error === failure);
  assert.ok(
    logs.some(
      (entry) =>
        'tool' in entry &&
        entry.tool === 'suggest_practice' &&
        'status' in entry &&
        entry.status === 'error',
    ),
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(agent.evaluate(turn(), snapshot, controller.signal, false));
  assert.equal(calls, 1);
});
