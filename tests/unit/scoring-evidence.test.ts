import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FEEDBACK_DIMENSIONS,
  EVIDENCE_SCORING_VERSION,
  questionScores,
  type InterviewTurn,
  type InterviewSnapshot,
  type InterviewResponseAssessment,
  type InterviewEvaluation,
  type ScoringQuestionScope,
  type AssessedResponse,
} from '@interviewlab/core';
import {
  createReportAnalysis,
  assertEvaluation,
  assertSummary,
  reuseSingleQuestionSummary,
} from '../../code/backend/src/modules/reports/analysis';
import { aggregateReport, emptyReport } from '../../code/backend/src/modules/reports/aggregate';
import { createReportAgent } from '../../code/backend/src/modules/reports/agent';
import { createModelAnalysis } from '../../code/backend/src/modules/interviews/model-analysis';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { newInterviewState } from '../../code/backend/src/modules/interviews/repository';

const snapshot: InterviewSnapshot = {
  prompt_version: 'interview-policy-v3',
  scoring_evidence_version: 'candidate-answer-v1',
  model: 'test',
  job_title: '后端开发',
  rubric_version: 'test',
  knowledge: { content_version: 'frozen', questions: [], sources: [], missing_reason: null },
};
const response = (
  overrides: Partial<InterviewResponseAssessment> = {},
): InterviewResponseAssessment => ({
  response_eligibility: 'answer',
  act: 'answer',
  relevance: 'responsive',
  sufficiency: 'sufficient',
  continuation: 'can_elaborate',
  explanation: '直接回应当前问题所要求的内容。',
  ...overrides,
});
const greeting = response({
  response_eligibility: 'non_answer',
  act: 'greeting',
  relevance: 'nonresponsive',
  sufficiency: 'not_applicable',
  continuation: 'not_applicable',
  explanation: '只作问候，没有回答自我介绍或专业问题。',
});
const turn = (answer: string, index = 1, follow = 0): InterviewTurn => ({
  id: `t${index}-${follow}`,
  text: '哈希表平均查询时间复杂度是多少？',
  stage: 'technical',
  topic: '岗位专业理解',
  purpose: '了解复杂度',
  answer_text: answer,
  answer_status: 'answered',
  revision: 1,
  main_question_index: index,
  follow_up_index: follow,
  knowledge_question_id: null,
  source_refs: [],
  evidence_refs: [],
  generation_id: 'test',
  presented_at: null,
  answered_at: null,
  input_mode: 'text_fallback',
});
function wire(
  responses: InterviewResponseAssessment[],
  dimension = -1,
  score: number | null = null,
  evidence = 'g0-0',
) {
  const kinds = [
    'closed_fact',
    'experience_detail',
    'decision_process',
    'explanation',
    'motivation',
    'reflection',
  ] as const;
  const scope: ScoringQuestionScope = {
    kind: dimension < 0 ? 'protocol' : kinds[dimension],
    dimensions: dimension < 0 ? [] : [FEEDBACK_DIMENSIONS[dimension].key],
    expectation:
      dimension === 0
        ? '准确给出所问复杂度，不要求展开未问到的推导。'
        : '仅评价当前问题明确要求的内容。',
  };
  return {
    responses: responses.map((r) => ({
      ...r,
      question_scope: scope,
      knowledge_evidence: (dimension === 0 && r.act !== 'dont_know'
        ? 'demonstrated'
        : 'not_present') as AssessedResponse['knowledge_evidence'],
    })),
    scores: FEEDBACK_DIMENSIONS.map((_, i) =>
      i === dimension ? [score, '本题回答提供相应依据', evidence] : null,
    ),
    strengths: [],
    gaps: [],
    retry_goal: '围绕当前问题给出实际回答',
    reference_points: [],
  };
}
const evaluate = (t: InterviewTurn, output: unknown, earlier: InterviewTurn[] = []) =>
  createReportAnalysis(async (_kind, schema) => schema.parse(output)).evaluate(
    t,
    snapshot,
    new AbortController().signal,
    false,
    { main_question: earlier[0]?.text ?? t.text, earlier_answers: [], earlier_turns: earlier },
  );

test('a greeting creates an audited non-answer evaluation with no numeric score, strengths or invented gaps', async () => {
  const t = { ...turn('你好'), stage: 'introduction' as const, text: '请简要做个自我介绍。' };
  const value = await evaluate(t, wire([greeting]));
  assert.equal(value.question_scoring_version, EVIDENCE_SCORING_VERSION);
  assert.equal(value.response_assessment?.act, 'greeting');
  assert.equal(value.feedback_assessments?.length, 0);
  assert.equal(value.feedback_observations?.length, 6);
  assert.deepEqual(value.strengths, []);
  assert.deepEqual(value.gaps, []);
  const state = newInterviewState('synthetic', {
    job: 'backend',
    career_stage: 'internship',
    interview_type: 'technical_qa',
    duration_minutes: 10,
    difficulty: '基础',
    interviewer_style: '标准',
    interaction_mode: 'text_fallback',
  });
  state.view.turns = [t];
  state.view.status = 'completed';
  const report = aggregateReport(
    state,
    { ...emptyReport(state, 'report'), status: 'ready', summary_status: 'not_applicable' },
    [
      {
        turn_id: t.id,
        task_id: null,
        result: value,
        task_status: 'succeeded',
        attempts: 1,
        max_attempts: 1,
        error_code: null,
      },
    ],
  );
  assert.equal(report.overall_score, 0);
  assert.equal(report.status, 'ready');
  assert.equal(report.feedback_assessments?.length, 6);
  assert.ok(report.feedback_assessments?.every((a) => a.score === 0 && !a.evidence_refs.length));
  await assert.rejects(evaluate(t, wire([greeting], 3, 78)));
  await assert.rejects(
    evaluate(t, { ...wire([greeting]), strengths: [['问候礼貌所以沟通优秀', 'g0-0']] }),
  );
});

test('compact v3 evidence works through json_object and json_schema in one provider call', async () => {
  for (const mode of ['json_object', 'json_schema'] as const) {
    const t = { ...turn('你好'), stage: 'introduction' as const, text: '请简要做个自我介绍。' };
    const output = wire([greeting]);
    output.responses[0].question_scope = {
      kind: 'explanation',
      dimensions: ['communication'],
      expectation: '简要介绍背景和求职方向',
    };
    output.retry_goal = '';
    let calls = 0;
    const agent = createModelAnalysis(
      loadConfig({ LLM_API_KEY: 'synthetic', LLM_OUTPUT_MODE: mode }),
      async (_url, init) => {
        calls++;
        const request = JSON.parse(init!.body as string);
        assert.equal(request.response_format.type, mode);
        const task = JSON.parse(request.messages[1].content);
        assert.equal('dimension_states' in task.schema.properties, false);
        assert.ok(
          task.schema.properties.scores.prefixItems[3].anyOf.some(
            (option: { type?: string }) => option.type === 'null',
          ),
        );
        for (const i of [0, 1, 2, 4, 5])
          assert.equal(task.schema.properties.scores.prefixItems[i].type, 'null');
        assert.deepEqual(output.scores, [null, null, null, null, null, null]);
        assert.ok(JSON.stringify(output).length < 750);
        return new Response(
          JSON.stringify({
            choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }],
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      },
    );
    const value = await agent.evaluate(t, snapshot, new AbortController().signal, false);
    assert.equal(calls, 1);
    assert.deepEqual(value.feedback_assessments, []);
    assert.equal(
      value.feedback_observations?.find((o) => o.dimension === 'communication')?.status,
      'insufficient_evidence',
    );
    assert.equal(
      value.feedback_observations?.find((o) => o.dimension === 'professional_foundation')?.status,
      'not_observed',
    );
    assert.equal(value.retry_goal, '围绕当前问题给出实际回答');
  }
});

test('a short correct technical answer remains eligible; an explicit unknown only assesses the asked knowledge', async () => {
  const short = turn('O(1)');
  const valid = await evaluate(short, wire([response()], 0, 90));
  assert.equal(valid.feedback_assessments?.[0].score, 90);
  assert.equal(valid.feedback_assessments?.[0].evidence_refs[0].quote, 'O(1)');
  const unknown = turn('不知道');
  const admission = response({
    act: 'dont_know',
    sufficiency: 'not_demonstrated',
    continuation: 'at_limit',
    explanation: '明确表示尚不能回答此知识问题。',
  });
  const result = await evaluate(unknown, wire([admission], 0, 0));
  assert.deepEqual(
    result.feedback_assessments?.map((a) => [a.dimension, a.score]),
    [['professional_foundation', 0]],
  );
  await assert.rejects(evaluate(unknown, wire([admission], 0, 80)));
  await assert.rejects(evaluate(unknown, wire([admission], 3, 0)));
});

test('administrative answers are responsive but cannot become ability scores or strengths', async () => {
  const t = { ...turn('两周后可以到岗'), stage: 'closing' as const, text: '你什么时候可以到岗？' };
  const output = wire([response()]);
  output.responses[0].question_scope.kind = 'administrative';
  const valid = await evaluate(t, output);
  assert.equal(valid.response_assessment?.response_eligibility, 'answer');
  assert.deepEqual(valid.feedback_assessments, []);
  await assert.rejects(evaluate(t, { ...output, strengths: [['到岗快所以岗位匹配度高', 'g0-0']] }));
  const outOfScope = wire([response()], 0, 90);
  outOfScope.responses[0].question_scope = {
    kind: 'closed_fact',
    dimensions: ['professional_foundation', 'problem_solving'],
    expectation: '仅问所需事实',
  };
  await assert.rejects(evaluate(turn('O(1)'), outOfScope));
});

test('self-introduction and claimed familiarity cannot substitute for demonstrated professional knowledge', async () => {
  const t = {
    ...turn(
      '我是人工智能专业在读硕士，想应聘前端岗位。我精通HTML、CSS和JavaScript。怎么还这么慢？',
    ),
    text: '请简要介绍你的学习背景和求职方向。',
    stage: 'introduction' as const,
    input_mode: 'voice' as const,
  };
  await assert.rejects(evaluate(t, wire([response()], 0, 60)));
  for (const dimension of [1, 2, 4, 5])
    await assert.rejects(evaluate(t, wire([response()], dimension, 65)));
  const claim = {
    ...wire([response({ sufficiency: 'needs_detail' })], 0, 60),
    responses: wire([response({ sufficiency: 'needs_detail' })], 0, 60).responses.map((r) => ({
      ...r,
      knowledge_evidence: 'claim_only' as const,
    })),
  };
  await assert.rejects(
    evaluate({ ...turn('我精通这些知识'), text: '请解释浏览器如何处理事件循环。' }, claim),
  );
  const output = wire([response()], 3, 80);
  output.responses[0].knowledge_evidence = 'claim_only';
  const analysis = createReportAnalysis(async (_kind, schema, input) => {
    const payload = input as {
      answer_units: { input_mode: string; stage: string }[];
      target_role: { role_context?: unknown };
      dimension_order: { key: string; anchors?: string[]; applicable?: boolean }[];
      observation_points: unknown[];
      professional_references: unknown[];
      instructions: string;
    };
    assert.equal(payload.answer_units[0].input_mode, 'voice');
    assert.equal(payload.answer_units[0].stage, 'introduction');
    assert.equal(payload.target_role.role_context, undefined);
    assert.deepEqual(payload.observation_points, []);
    assert.deepEqual(payload.professional_references, []);
    for (const dimension of payload.dimension_order)
      if (dimension.key === 'communication') assert.equal(dimension.anchors?.length, 1);
      else {
        assert.equal(dimension.anchors, undefined);
        assert.equal(dimension.applicable, false);
      }
    assert.match(payload.instructions, /不能把后续专业或项目问题的要求当作介绍缺口/);
    assert.match(payload.instructions, /元对话不作能力优缺点或扣分依据/);
    return schema.parse(output);
  });
  const valid = await analysis.evaluate(t, snapshot, new AbortController().signal, false);
  assert.deepEqual(
    valid.feedback_assessments?.map((a) => a.dimension),
    ['communication'],
  );
  assert.deepEqual(valid.gaps, []);
  assert.equal(
    valid.feedback_assessments?.[0].evidence_refs[0].quote,
    '我是人工智能专业在读硕士，想应聘前端岗位。',
  );
});

test('a specific experience follow-up can assess project reasoning without expanding the introduction scope', async () => {
  const intro: InterviewTurn = {
    ...turn('我学计算机，课程项目做过报名表单，希望应聘前端实习。'),
    text: '请简要介绍学习背景与求职方向。',
    stage: 'introduction',
  };
  const follow: InterviewTurn = {
    ...turn('我给请求加递增版本号，只接受最新响应，避免旧请求覆盖当前结果。', 1, 1),
    text: '你负责的表单怎样处理异步校验返回乱序？',
    stage: 'experience',
  };
  const output = wire([response(), response()], 1, 85, 'g1-0');
  output.responses[0].question_scope = {
    kind: 'explanation',
    dimensions: ['communication'],
    expectation: '简明介绍学习背景与方向。',
  };
  output.responses[1].question_scope.dimensions = ['project_reflection', 'problem_solving'];
  const valid = await evaluate(follow, output, [intro]);
  assert.deepEqual(
    valid.feedback_assessments?.map((a) => a.dimension),
    ['project_reflection'],
  );
  const outOfScope = structuredClone(valid);
  outOfScope.response_assessments![0].question_scope.dimensions.push('project_reflection');
  assert.throws(() => assertEvaluation(outOfScope, follow, snapshot, [intro, follow]));
});

test('concrete mechanisms and reasoning can support professional, logical and communication observations together', async () => {
  const t = {
    ...turn('每次请求递增版本号，只接受最新响应，因为旧请求可能晚返回而覆盖新结果。'),
    text: '你如何处理异步校验乱序，为什么这样处理？',
  };
  const output = wire([response()], 0, 85);
  output.responses[0].question_scope = {
    kind: 'explanation',
    dimensions: ['professional_foundation', 'problem_solving', 'communication'],
    expectation: '解释具体方法与因果关系。',
  };
  output.scores[2] = [85, '解释了问题与处理方法的因果关系', 'g0-0'];
  output.scores[3] = [85, '清楚说明了机制和理由', 'g0-0'];
  const analysis = createReportAnalysis(async (_kind, schema, input) => {
    const payload = input as { instructions: string; dimension_order: { anchors?: string[] }[] };
    assert.ok(payload.dimension_order.every((d) => d.anchors?.length));
    assert.match(payload.instructions, /具体机制、方法、因果解释或取舍就是知识展示/);
    assert.match(payload.instructions, /不必题目直接问表达或逻辑能力/);
    return schema.parse(output);
  });
  const value = await analysis.evaluate(t, snapshot, new AbortController().signal, false);
  assert.deepEqual(
    value.feedback_assessments?.map((a) => a.dimension),
    ['professional_foundation', 'problem_solving', 'communication'],
  );
});

test('evidence-contract failures log a static reason without candidate text', async () => {
  const privateAnswer = '仅供测试的私密内容：我精通事件循环';
  const t = { ...turn(privateAnswer), text: '请解释事件循环如何处理微任务。' };
  const output = wire([response()], 0, 80);
  output.responses[0].question_scope.kind = 'explanation';
  output.responses[0].knowledge_evidence = 'claim_only';
  const logs: object[] = [];
  const analysis = createReportAnalysis(
    async (_kind, schema) => schema.parse(output),
    (entry) => logs.push(entry),
  );
  await assert.rejects(analysis.evaluate(t, snapshot, new AbortController().signal, false));
  assert.deepEqual(logs, [
    {
      task: 'evaluate',
      code: 'model_evidence_validation',
      reason: '专业评分需要实际知识展示，自我介绍或熟练度自我声明不能替代',
    },
  ]);
  assert.ok(!JSON.stringify(logs).includes(privateAnswer));
});

test('each numeric score must stay inside the scope of the same response that supplies its evidence', async () => {
  const t = {
    ...turn('每次请求递增版本号，只接受最新响应，避免旧结果覆盖；规则抽为纯函数。'),
    text: '你负责的表单校验遇到哪些交互和逻辑难点，怎样处理？',
    stage: 'experience' as const,
  };
  const output = wire([response()], 0, 85);
  output.responses[0].question_scope = {
    kind: 'experience_detail',
    dimensions: ['professional_foundation', 'problem_solving'],
    expectation: '说明本人处理的项目难点与机制。',
  };
  output.scores[1] = [80, '具体说明本人处理的项目难点', 'g0-0'];
  output.scores[3] = [80, '表达清楚', 'g0-0'];
  const analysis = createReportAnalysis(async (_kind, schema, input) => {
    const payload = input as { score_scope_rule: string };
    assert.match(payload.score_scope_rule, /同一response.question_scope.dimensions内/);
    assert.match(payload.score_scope_rule, /每维分别需要实际依据/);
    return schema.parse(output);
  });
  await assert.rejects(
    analysis.evaluate(t, snapshot, new AbortController().signal, false),
    /评分不得扩大到实际问句没有要求的维度/,
  );
  output.responses[0].question_scope.dimensions.push('project_reflection', 'communication');
  const valid = await analysis.evaluate(t, snapshot, new AbortController().signal, false);
  assert.deepEqual(
    valid.feedback_assessments?.map((a) => a.dimension),
    ['professional_foundation', 'project_reflection', 'communication'],
  );
});

test('resume, interviewer question, foreign turns and obsolete revisions cannot be answer evidence', async () => {
  const t = turn('O(1)');
  const valid = await evaluate(t, wire([response()], 0, 90));
  for (const ref of [
    { turn_id: t.id, revision: 1, quote: t.text },
    { turn_id: t.id, revision: 1, quote: '简历中的熟悉算法与数据库' },
    { turn_id: 'other-answer', revision: 1, quote: 'O(1)' },
    { turn_id: t.id, revision: 2, quote: 'O(1)' },
  ]) {
    const mutated = structuredClone(valid);
    mutated.feedback_assessments![0].evidence_refs = [ref];
    mutated.feedback_observations![0].evidence_refs = [ref];
    assert.throws(() => assertEvaluation(mutated, t, snapshot));
  }
  await assert.rejects(evaluate(t, wire([response()], 0, 90, 'g9-0')));
  await assert.rejects(
    evaluate(t, {
      ...wire([response()], 0, 90),
      dimension_states: FEEDBACK_DIMENSIONS.map(() => 'not_observed'),
    }),
  );
});

test('a later greeting cannot supply evidence but does not erase an earlier genuine answer in the same group', async () => {
  const earlier = turn('O(1)');
  const last = turn('你好', 1, 1);
  const value = await evaluate(last, wire([response(), greeting], 0, 90, 'g0-0'), [earlier]);
  assert.equal(value.response_assessment?.response_eligibility, 'non_answer');
  assert.equal(questionScores([earlier, last], [value])[0].score, 90);
  await assert.rejects(evaluate(last, wire([response(), greeting], 0, 90, 'g1-0'), [earlier]));
});

test('six non-HR dimensions aggregate from distinct actual questions, with no dilution by unexamined dimensions', async () => {
  const state = newInterviewState('synthetic', {
    job: 'backend',
    career_stage: 'internship',
    interview_type: 'technical_qa',
    duration_minutes: 20,
    difficulty: '基础',
    interviewer_style: '标准',
    interaction_mode: 'text_fallback',
  });
  state.view.status = 'completed';
  const values: InterviewEvaluation[] = [];
  for (let i = 0; i < 6; i++) {
    const t = turn(`第${i + 1}题提供的具体回答`, i + 1);
    state.view.turns.push(t);
    values.push(await evaluate(t, wire([response()], i, 80)));
  }
  const tasks = values.map((result) => ({
    turn_id: result.turn_id,
    task_id: null,
    result,
    task_status: 'succeeded',
    attempts: 1,
    max_attempts: 1,
    error_code: null,
  }));
  const report = aggregateReport(state, emptyReport(state, 'report'), tasks);
  assert.equal(report.feedback_assessments?.length, 6);
  assert.equal(report.overall_score, 80);
  const partial = aggregateReport(
    { ...state, view: { ...state.view, turns: state.view.turns.slice(0, 1) } },
    emptyReport(state, 'partial'),
    tasks.slice(0, 1),
  );
  assert.equal(partial.feedback_assessments?.[0].score, 80);
  assert.equal(partial.overall_score, 20);
  assert.equal(partial.feedback_assessments?.length, 6);
  assert.equal(partial.feedback_assessments?.filter((a) => a.score === 0).length, 5);
  for (const interview_type of ['technical_qa', 'business_scenario', 'mixed'] as const) {
    const typed = aggregateReport(
      {
        ...state,
        view: {
          ...state.view,
          configuration: { ...state.view.configuration, interview_type },
          turns: state.view.turns.slice(0, 1),
        },
      },
      emptyReport(state, 'typed'),
      tasks.slice(0, 1),
    );
    assert.equal(typed.feedback_assessments?.length, 6);
    assert.equal(typed.overall_score, 20);
    assert.equal(typed.analysis_metadata?.scoring_rubric_version, 'whole-interview-six-v1');
  }
  const unfinished = aggregateReport(
    state,
    emptyReport(state, 'pending'),
    tasks.map((task, i) => (i === 0 ? task : { ...task, result: null, task_status: 'running' })),
  );
  assert.equal(unfinished.overall_score, null);
  assert.equal(unfinished.feedback_assessments?.length, 1);
});

test('frozen professional context is separate from answer evidence and cannot expose a resume', async () => {
  const t = turn('O(1)');
  const s = {
    ...snapshot,
    personal_material: {
      id: 'private',
      kind: 'resume' as const,
      title: 'private',
      text: 'RESUME_PRIVATE_MARKER',
      version: 1,
      confirmed: true,
      created_at: 'test',
    },
    knowledge: {
      ...snapshot.knowledge,
      sources: [{ id: 'official' }] as InterviewSnapshot['knowledge']['sources'],
    },
  };
  const analysis = createReportAnalysis(async (_kind, schema, input) => {
    const value = input as {
      evidence_catalog: Record<string, string>;
      professional_references: unknown[];
      answer_units: unknown[];
    };
    assert.deepEqual(Object.values(value.evidence_catalog), ['O(1)']);
    assert.equal(value.professional_references.length, 1);
    assert.equal(value.answer_units.length, 1);
    assert.equal(JSON.stringify(input).includes('RESUME_PRIVATE_MARKER'), false);
    return schema.parse(wire([response()], 0, 90));
  });
  await analysis.evaluate(t, s, new AbortController().signal, false, {
    main_question: t.text,
    earlier_answers: [],
    retrieval: {
      release: 'frozen',
      mode: 'prefetched',
      missing_reason: null,
      chunks: [
        {
          id: 'foundation',
          card_id: 'foundation',
          release: 'frozen',
          kind: 'professional',
          evidence_level: 'source_summary',
          text: '适用的复杂度参考',
          source_refs: ['official'],
          goals: ['understanding'],
          types: ['technical_qa'],
        },
      ],
    },
  });
});

test('role-fit evaluation receives frozen public requirements without private preparation facts', async () => {
  const role = {
    job_id: 'backend',
    job_title: '后端开发',
    job_version: 2,
    description: '服务端开发',
    responsibilities: ['验证接口可靠性'],
    requirements: ['能解释并验证接口行为'],
    topics: ['接口设计'],
    source_refs: ['public-role'],
    usage: 'role_requirements_not_candidate_evidence' as const,
    unrecognized_private_field: 'PRIVATE_EXTRA_MARKER',
  };
  const s: InterviewSnapshot = {
    ...snapshot,
    personal_material: {
      id: 'private',
      kind: 'resume',
      title: 'private',
      text: 'PRIVATE_RESUME_MARKER',
      version: 1,
      confirmed: true,
      created_at: 'test',
    },
    preparation_plan: {
      role_context: role,
      goals: [
        {
          goal: 'verification',
          focus: 'PRIVATE_FOCUS_MARKER',
          material_refs: [
            {
              material_id: 'private',
              version: 1,
              field: 'projects',
              quote: 'PRIVATE_MATERIAL_MARKER',
            },
          ],
        },
      ],
      limitations: ['PRIVATE_LIMIT_MARKER'],
    },
  };
  const agent = createReportAgent(async (_kind, schema, input) => {
    const payload = input as { target_role: { role_context: unknown } };
    const { unrecognized_private_field: _private, ...publicRole } = role;
    assert.deepEqual(payload.target_role.role_context, publicRole);
    assert.equal(JSON.stringify(input).includes('PRIVATE_'), false);
    return schema.parse(wire([response()], 4, 85));
  });
  const t = {
    ...turn('我先列出关键接口契约，再用集成测试验证重试与失败边界。'),
    text: '你会怎样验证这个岗位负责的接口行为？',
    stage: 'business' as const,
  };
  const value = await agent.evaluate(t, s, new AbortController().signal, false);
  assert.equal(value.feedback_assessments?.[0].dimension, 'motivation');
  assert.equal(value.feedback_assessments?.[0].score, 85);
});

test('a v3 single-question practice keeps its actual question score without requiring six whole-interview dimensions', async () => {
  const state = newInterviewState('practice-test', {
    job: 'backend',
    career_stage: 'internship',
    interview_type: 'technical_qa',
    duration_minutes: 10,
    difficulty: '基础',
    interviewer_style: '标准',
    interaction_mode: 'text_fallback',
  });
  const t = turn('O(1)');
  const evaluation = await evaluate(t, wire([response()], 0, 90));
  state.view.status = 'completed';
  state.view.turns = [t];
  state.view.parent_interview_id = 'original-interview';
  state.view.parent_turn_id = 'original-question';
  const report = aggregateReport(state, emptyReport(state, 'practice-report'), [
    {
      turn_id: t.id,
      task_id: null,
      result: evaluation,
      task_status: 'succeeded',
      attempts: 1,
      max_attempts: 1,
      error_code: null,
    },
  ]);
  assert.equal(report.question_scores?.[0].score, 90);
  assert.equal(report.overall_score, 90);
  assert.equal(report.feedback_assessments?.length, 1);
});

test('one-topic summary copies checked cumulative results without inventing findings, action plans or six scores', async () => {
  const earlier = turn('O(1)');
  const last = turn('平均为O(1)', 1, 1);
  const first = await evaluate(earlier, wire([response()], 0, 90));
  const final = await evaluate(last, wire([response(), response()], 0, 95, 'g1-0'), [earlier]);
  const summary = reuseSingleQuestionSummary([first, final], snapshot, [earlier, last])!;
  assert.equal(summary.overview.text, final.feedback_assessments![0].text);
  assert.deepEqual(summary.overview.evidence_refs, final.feedback_assessments![0].evidence_refs);
  assert.deepEqual(summary.feedback_template.assessments, final.feedback_assessments);
  assert.equal(summary.feedback_template.assessments[0].score, 95);
  assert.deepEqual(summary.strengths, []);
  assert.deepEqual(summary.improvements, []);
  assert.deepEqual(summary.feedback_template.action_plan, []);
  assert.equal(summary.feedback_template.next_expectation, final.retry_goal);
  assert.match(summary.limitations[0], /仅完成一个已评分主问题/);
  const state = newInterviewState('single-topic', {
    job: 'backend',
    career_stage: 'internship',
    interview_type: 'technical_qa',
    duration_minutes: 10,
    difficulty: '基础',
    interviewer_style: '标准',
    interaction_mode: 'text_fallback',
  });
  state.view.turns = [earlier, last];
  const report = aggregateReport(
    state,
    { ...emptyReport(state, 'single-topic-report'), summary, summary_status: 'ready' },
    [first, final].map((result) => ({
      turn_id: result.turn_id,
      task_id: null,
      result,
      task_status: 'succeeded',
      attempts: 1,
      max_attempts: 1,
      error_code: null,
    })),
  );
  assert.equal(report.summary?.feedback_template.assessments.length, 6);
  assert.equal(
    report.summary?.feedback_template.assessments.find(
      (a) => a.dimension === final.feedback_assessments![0].dimension,
    )?.score,
    95,
  );
  assert.doesNotThrow(() =>
    assertSummary(summary, [first, final], { turns: [earlier, last], snapshot }),
  );
  assert.throws(() =>
    assertSummary(
      { ...summary, overview: { ...summary.overview, text: '由同一引用推断候选人精通所有算法' } },
      [first, final],
      { turns: [earlier, last], snapshot },
    ),
  );
});

test('single-topic reuse preserves existing strengths and retry ownership, and never replaces cross-topic synthesis', async () => {
  const t = { ...turn('O(1)'), text: '请解释哈希查询的原理与复杂度。' };
  const output = {
    ...wire([response({ sufficiency: 'needs_detail' })], 0, 60),
    strengths: [['准确给出了所问复杂度', 'g0-0']],
    gaps: [['尚未解释题目要求的查询原理', 'g0-0']],
  };
  output.responses[0].question_scope.kind = 'explanation';
  const value = await evaluate(t, output);
  const summary = reuseSingleQuestionSummary([value], snapshot, [t])!;
  assert.deepEqual(summary.overview, value.strengths[0]);
  assert.deepEqual(summary.strengths, value.strengths);
  assert.deepEqual(
    summary.improvements,
    value.gaps.map((g) => ({ ...g, turn_id: value.turn_id, retry_goal: value.retry_goal })),
  );
  const other = turn('新的主题有真实回答', 2);
  const second = await evaluate(other, wire([response()], 1, 80));
  assert.equal(reuseSingleQuestionSummary([value, second], snapshot, [t, other]), null);
  const hello = { ...turn('你好'), stage: 'introduction' as const };
  const greetingValue = await evaluate(hello, wire([greeting]));
  assert.equal(reuseSingleQuestionSummary([greetingValue], snapshot, [hello]), null);
});
