import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_INTERVIEW_TYPES,
  interviewPolicy,
  missingFeedbackDimensions,
  type InterviewMemory,
  type InterviewResponseAssessment,
  type InterviewSnapshot,
  type InterviewTurn,
} from '@interviewlab/core';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { newInterviewState } from '../../code/backend/src/modules/interviews/repository';
import {
  assertPreview,
  createStreamingAgent,
} from '../../code/backend/src/modules/interviews/streaming-agent';
import { createModelAnalysis } from '../../code/backend/src/modules/interviews/model-analysis';
import {
  assertResponseAssessment,
  responseObservation,
  streamResponseAssessment,
} from '../../code/backend/src/modules/interviews/response-assessment';
import { participationQuestion } from '../../code/backend/src/modules/interviews/participation';
import {
  COMPETENCIES,
  catalogProfile,
  planningRoleContext,
} from '../../code/backend/src/modules/knowledge/catalog';

const answered: InterviewResponseAssessment = {
  response_eligibility: 'answer',
  act: 'answer',
  relevance: 'responsive',
  sufficiency: 'sufficient',
  continuation: 'not_applicable',
  communication_observed: false,
  explanation: '已完整回答本题要求的事实。',
};
const greeting: InterviewResponseAssessment = {
  response_eligibility: 'non_answer',
  act: 'greeting',
  relevance: 'nonresponsive',
  sufficiency: 'not_applicable',
  continuation: 'not_applicable',
  communication_observed: false,
  explanation: '当前仅问候，尚未介绍学习背景。',
};

function setup(type = 'technical_qa' as (typeof ACTIVE_INTERVIEW_TYPES)[number]) {
  const state = newInterviewState('synthetic-response', {
    job: 'frontend',
    career_stage: 'internship',
    interview_type: type,
    difficulty: '基础',
    duration_minutes: 10,
    interviewer_style: '标准',
    interaction_mode: 'text_fallback',
  });
  state.view.status = 'in_progress';
  state.view.target_at = new Date(Date.now() + 600000).toISOString();
  const policy = interviewPolicy(state.view.configuration);
  const snapshot: InterviewSnapshot = {
    runtime_version: 'graph-v1',
    interview_type: type,
    model: 'test',
    job_title: '前端开发',
    prompt_version: policy.version,
    rubric_version: 'test',
    preparation_plan: {
      policy,
      goals: [],
      limitations: [],
      role_context: planningRoleContext(state.view.configuration),
    },
    knowledge: {
      content_version: 'test',
      questions: [],
      sources: [],
      missing_reason: null,
      agent_release: {
        id: 'test',
        profile: catalogProfile(type),
        competencies: COMPETENCIES,
        embedding_model: 'test',
        dimensions: 1024,
      },
    },
  };
  return { state, snapshot };
}
function turn(text: string, answer: string, stage: InterviewTurn['stage']): InterviewTurn {
  return {
    id: 'current',
    text,
    answer_text: answer,
    stage,
    topic: stage === 'introduction' ? '自我介绍' : '专业基础',
    purpose: '了解当前问题',
    main_question_index: 1,
    follow_up_index: 0,
    answer_status: 'answered',
    knowledge_question_id: null,
    source_refs: [],
    evidence_refs: [],
    generation_id: 'test',
    revision: 1,
    input_mode: 'text_fallback',
    answered_at: new Date().toISOString(),
    presented_at: null,
  };
}
const focused = (): InterviewMemory => ({
  version: 1,
  focus: 'understanding',
  observations: [],
  claims: [],
  asked_intents: [],
});
const goalIndex = (input: any, goal: string) =>
  input.goal_options.findIndex((option: { goal: string }) => option.goal === goal);

function controlled(
  assessment: InterviewResponseAssessment,
  question = '最近学习新知识时，你如何检查自己是否理解？',
  action: 'f' | 'n' = 'n',
  inspect: (body: any, input: any) => void = () => {},
  goal = 'learning',
  evidence?: number | null,
  observedGoals?: string[],
) {
  const cfg = loadConfig({ LLM_API_KEY: 'test' });
  return createStreamingAgent(
    createModelAnalysis(cfg),
    cfg,
    () => {},
    async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const input = JSON.parse(body.messages[1].content);
      inspect(body, input);
      const properties = body.response_format.json_schema.schema.properties;
      const preferredGoal = goalIndex(input, goal);
      const allowed = action === 'f' ? input.follow_up_goal_indices : input.next_goal_indices;
      const output = {
        h:
          {
            answer: 'a',
            greeting: 'g',
            acknowledgement: 'k',
            decline_topic: 'd',
            dont_know: 'u',
            clarification_request: 'c',
            off_topic: 'o',
          }[assessment.act] +
          { sufficient: 's', needs_detail: 'd', not_demonstrated: 'u', not_applicable: 'n' }[
            assessment.sufficiency
          ] +
          { can_elaborate: 'e', at_limit: 'l', not_applicable: 'n' }[assessment.continuation] +
          (assessment.communication_observed ? '1' : '0'),
        v: (
          observedGoals ??
          (assessment.response_eligibility === 'answer' && input.memory?.focus
            ? [input.memory.focus]
            : [])
        ).map((observed) => goalIndex(input, observed)),
        decision: {
          a: action,
          g:
            input.current_stage === 'introduction' && !allowed.includes(preferredGoal)
              ? allowed[0]
              : Math.max(0, preferredGoal),
        },
        e:
          evidence === undefined
            ? assessment.response_eligibility === 'answer'
              ? 0
              : null
            : evidence,
        ...(properties.r ? { r: [] } : {}),
        ...(properties.s ? { s: [] } : {}),
        q: question,
        d: action === 'f' ? 'probe_gap' : 'type_priority',
        b: '',
      };
      return new Response(
        `data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(output) } }] })}\n\ndata: [DONE]\n\n`,
      );
    },
  );
}
const context = (memory: InterviewMemory | null = null, previews: string[] = []) => ({
  memory,
  retrieval: { release: 'test', chunks: [], mode: 'empty' as const, missing_reason: null },
  preview: async (value: { text: string }) => {
    if (value.text) previews.push(value.text);
  },
});

for (const type of ACTIVE_INTERVIEW_TYPES)
  test(`${type}: a greeting gently resumes introduction without any ability evidence`, async () => {
    const { state, snapshot } = setup(type);
    state.view.turns = [turn('请介绍你的学习背景。', '你好', 'introduction')];
    const agent = controlled(
      greeting,
      '你好，可以先介绍一下你的学习背景吗？',
      'f',
      (body, input) => {
        assert.equal(input.target_role.title, '前端开发');
        assert.equal(input.role_context.usage, 'role_requirements_not_candidate_evidence');
        const e = body.response_format.json_schema.schema.properties.e;
        assert.ok(e.anyOf.some((choice: { type: string }) => choice.type === 'null'));
      },
    );
    const result = await agent.advance(
      state.view,
      snapshot,
      false,
      new AbortController().signal,
      false,
      context(),
    );
    assert.equal(result.question?.stage, 'introduction');
    assert.equal(result.memory?.introduction_complete, false);
    assert.equal(result.memory?.claims.length, 0);
    assert.equal(result.memory?.observations.length, 0);
    assert.equal(result.memory?.communication_observed, false);
  });

test('an unreplied introduction cannot transition to a project, even in HR, or leak it to preview', async () => {
  for (const type of ACTIVE_INTERVIEW_TYPES) {
    const { state, snapshot } = setup(type);
    state.view.turns = [turn('请介绍你的学习背景。', '你好', 'introduction')];
    const previews: string[] = [];
    const agent = controlled(greeting, '你参与过哪个项目？');
    await assert.rejects(
      agent.advance(
        state.view,
        snapshot,
        false,
        new AbortController().signal,
        false,
        context(null, previews),
      ),
    );
    assert.deepEqual(previews, []);
  }
});

test('pure greetings cannot be relabeled as a responsive answer', () => {
  assert.throws(() => assertResponseAssessment(answered, '你好'));
  assert.throws(() =>
    assertResponseAssessment({ ...greeting, communication_observed: true }, '你好'),
  );
});

test('private stream states restore the public assessment and preserve semantic boundary checks', () => {
  const sufficient = streamResponseAssessment('asn0');
  assert.equal(sufficient.response_eligibility, 'answer');
  assert.equal(sufficient.sufficiency, 'sufficient');
  assert.equal(sufficient.communication_observed, false);
  const limit = streamResponseAssessment('uul0');
  assert.equal(limit.act, 'dont_know');
  assert.equal(responseObservation(limit), 'inconclusive');
  const social = streamResponseAssessment('gnn0');
  assert.equal(social.response_eligibility, 'non_answer');
  assert.equal(social.relevance, 'nonresponsive');
  assert.throws(() => assertResponseAssessment(streamResponseAssessment('gse0'), '你好'));
  assert.throws(() => assertResponseAssessment(streamResponseAssessment('gnn1'), '你好'));
  assert.throws(() => assertResponseAssessment(streamResponseAssessment('uun0'), '我不会'));
  assert.throws(() => streamResponseAssessment('invalid'));
});

test(
  'v3 emits a validated question before audit fields and removes duplicated current input',
  { timeout: 2000 },
  async () => {
    const { state, snapshot } = setup();
    state.view.turns = [
      { ...turn('先前的问题', '先前的回答', 'technical'), id: 'previous' },
      turn('哈希表按键查询的平均时间复杂度是多少？', 'O(1)', 'technical'),
    ];
    const cfg = loadConfig({ LLM_API_KEY: 'test' });
    let releaseTail!: () => void;
    const tailGate = new Promise<void>((resolve) => {
      releaseTail = resolve;
    });
    let showQuestion!: () => void;
    const shown = new Promise<void>((resolve) => {
      showQuestion = resolve;
    });
    let tailSent = false;
    const agent = createStreamingAgent(
      createModelAnalysis(cfg),
      cfg,
      () => {},
      async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        const input = JSON.parse(body.messages[1].content);
        const properties = body.response_format.json_schema.schema.properties;
        assert.deepEqual(Object.keys(properties), ['h', 'v', 'decision', 'e', 'q', 'd', 'b']);
        assert.deepEqual(
          input.recent_dialogue.map((entry: any) => entry.answer),
          ['先前的回答'],
        );
        assert.equal(input.current_answer, 'O(1)');
        assert.equal(input.preparation_plan.policy, undefined);
        assert.equal(input.preparation_plan.role_context, undefined);
        assert.equal(input.introduction, undefined);
        const prefix =
          JSON.stringify({
            h: 'asn0',
            v: [goalIndex(input, 'understanding')],
            decision: { a: 'n', g: goalIndex(input, 'learning') },
            e: 0,
          }).slice(0, -1) + ',';
        assert.ok(
          prefix.length < 65,
          'qualification and action should not emit long prose before q',
        );
        const frame = (content: string) =>
          new TextEncoder().encode(
            `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
          );
        return new Response(
          new ReadableStream({
            async start(controller) {
              controller.enqueue(
                frame(prefix + '"q":"最近学习新知识时，你如何检查自己是否理解？"'),
              );
              await tailGate;
              tailSent = true;
              controller.enqueue(frame(',"d":"type_priority","b":""}'));
              controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
              controller.close();
            },
          }),
        );
      },
    );
    const running = agent.advance(
      state.view,
      snapshot,
      false,
      new AbortController().signal,
      false,
      {
        ...context(focused()),
        preview: async (preview) => {
          if (!preview.text) return;
          assert.equal(tailSent, false, 'audit text must not block the first visible question');
          showQuestion();
        },
      },
    );
    try {
      await Promise.race([
        shown,
        running.then(() => {
          throw new Error('Question never previewed');
        }),
      ]);
    } finally {
      releaseTail();
    }
    const result = await running;
    assert.equal(result.memory?.response?.response_eligibility, 'answer');
    assert.equal(result.memory?.decision?.reason, 'type_priority');
  },
);

test('available material and source selections are validated before any question is previewed', async () => {
  for (const invalid of [null, 'material', 'source'] as const) {
    const { state, snapshot } = setup();
    state.view.turns = [turn('查询的平均复杂度是多少？', 'O(1)', 'technical')];
    snapshot.resume_analysis = {
      facts: [
        {
          kind: 'skill',
          text: '学习过数据结构',
          evidence: { material_id: 'resume', version: 1, field: 'text', quote: '学习过数据结构' },
        },
      ],
      clarification_points: [],
    };
    snapshot.knowledge.sources = [
      { id: 'frozen-source' },
    ] as InterviewSnapshot['knowledge']['sources'];
    const cfg = loadConfig({ LLM_API_KEY: 'test' });
    const previews: string[] = [];
    const agent = createStreamingAgent(
      createModelAnalysis(cfg),
      cfg,
      () => {},
      async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        const input = JSON.parse(body.messages[1].content);
        assert.deepEqual(
          Object.keys(body.response_format.json_schema.schema.properties).slice(0, 7),
          ['h', 'v', 'decision', 'e', 'r', 's', 'q'],
        );
        const output = {
          h: 'asn0',
          v: [goalIndex(input, 'understanding')],
          decision: { a: 'n', g: goalIndex(input, 'learning') },
          e: 0,
          r: [invalid === 'material' ? 1 : 0],
          s: [0],
          q: '最近学习新知识时，你如何检查自己是否理解？',
          d: 'type_priority',
          b: '',
        };
        return new Response(
          `data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(output) } }] })}\n\ndata: [DONE]\n\n`,
        );
      },
    );
    const running = agent.advance(
      state.view,
      snapshot,
      false,
      new AbortController().signal,
      false,
      {
        ...context(focused(), previews),
        retrieval: {
          release: 'test',
          mode: 'prefetched',
          missing_reason: null,
          chunks: [
            {
              id: 'reference',
              card_id: 'understanding',
              release: 'test',
              text: '岗位相关参考',
              goals: ['understanding'],
              types: ['technical_qa'],
              source_refs: [invalid === 'source' ? 'unfrozen-source' : 'frozen-source'],
            },
          ],
        },
      },
    );
    if (invalid) {
      await assert.rejects(running);
      assert.deepEqual(previews, []);
    } else {
      const result = await running;
      assert.ok(previews.length);
      assert.deepEqual(result.question?.source_refs, ['frozen-source']);
      assert.equal(result.retrieval?.material_refs?.length, 1);
    }
  }
});

for (const [question, answer] of [
  ['哈希表按键查询的平均时间复杂度是多少？', 'O(1)'],
  ['关系数据库常用的查询语言是什么？', 'SQL'],
  ['你是否使用过关系数据库？', '是'],
])
  test(`a short relevant answer remains sufficient: ${answer}`, async () => {
    const { state, snapshot } = setup();
    state.view.turns = [turn(question, answer, 'technical')];
    const agent = controlled(answered);
    const result = await agent.advance(
      state.view,
      snapshot,
      false,
      new AbortController().signal,
      false,
      context(focused()),
    );
    assert.equal(result.memory?.response?.response_eligibility, 'answer');
    assert.equal(result.memory?.observations[0].state, 'covered');
    assert.equal(result.memory?.claims[0].text, answer);
    assert.equal(result.memory?.communication_observed, false);
    assert.ok(
      missingFeedbackDimensions(
        result.memory!,
        Boolean(result.memory?.communication_observed),
      ).some((d) => d.key === 'communication'),
    );
  });

test('sufficient or explicitly exhausted answers cannot be drilled again', async () => {
  const { state, snapshot } = setup();
  const limit: InterviewResponseAssessment = {
    ...answered,
    act: 'dont_know',
    sufficiency: 'not_demonstrated',
    continuation: 'at_limit',
    explanation: '候选人明确表示本题还不会。',
  };
  assert.equal(responseObservation(limit), 'inconclusive');
  for (const assessment of [answered, limit]) {
    state.view.turns = [
      turn(
        '查询的平均复杂度是多少？',
        assessment === limit ? '这个我还不知道。' : 'O(1)',
        'technical',
      ),
    ];
    const agent = controlled(assessment, '你能再解释一下吗？', 'f');
    await assert.rejects(
      agent.advance(
        state.view,
        snapshot,
        false,
        new AbortController().signal,
        false,
        context(focused()),
      ),
    );
  }
  state.view.turns = [turn('查询的平均复杂度是多少？', '这个我还不知道。', 'technical')];
  const result = await controlled(limit).advance(
    state.view,
    snapshot,
    false,
    new AbortController().signal,
    false,
    context(focused()),
  );
  assert.equal(result.memory?.observations[0].state, 'inconclusive');
  assert.equal(result.memory?.observations[0].pending, null);
});

test('a participation reminder retains the current interview topic and introduction stage', () => {
  const { state } = setup('hr');
  for (const [question, stage] of [
    ['请介绍你的学习背景。', 'introduction'],
    ['你最早什么时候可以到岗？', 'behavioral'],
  ] as const) {
    state.view.turns = [turn(question, '你好', stage)];
    const result = participationQuestion(
      { level: 'reminder', reason: 'repeated_non_answers', turn_id: 'current', message: '请继续' },
      state.view,
    );
    assert.equal(result.text, question);
    assert.equal(result.stage, stage);
  }
});

test('a substantive introduction after a participation reminder resumes normal interviewing', async () => {
  const { state, snapshot } = setup();
  const current = turn('请介绍你的学习背景。', '我在学习前端开发，想找前端实习。', 'introduction');
  current.purpose = 'participation:reminder';
  state.view.turns = [current];
  const result = await controlled({ ...answered, communication_observed: true }).advance(
    state.view,
    snapshot,
    false,
    new AbortController().signal,
    false,
    context(),
  );
  assert.equal(result.memory?.introduction_complete, true);
  assert.equal(result.memory?.communication_observed, true);
  assert.notEqual(result.question?.stage, 'introduction');
});

test('a verification question carrying a tradeoffs label observes only actual verification evidence', async () => {
  const { state, snapshot } = setup();
  const current = turn(
    '把规则抽成纯函数后，你如何验证边界输入的正确性？',
    '我用空输入、错误格式和临界长度逐项检查返回值，并把失败样例保留下来。',
    'business',
  );
  current.purpose = '说明约束、备选方案和选择依据';
  current.main_question_index = 2;
  state.view.turns = [current];
  const memory = focused();
  memory.focus = 'tradeoffs';
  const agent = controlled(
    answered,
    '你选择前端岗位的主要依据是什么？',
    'n',
    (_body, input) => {
      const choice = input.goal_options.find((option: any) => option.goal === 'tradeoffs');
      const verification = input.goal_options.find((option: any) => option.goal === 'verification');
      assert.deepEqual(choice.target_dimensions, ['problem_solving']);
      assert.equal(choice.question_kind, 'decision_process');
      assert.match(choice.boundary, /仅问如何验证边界输入属于verification/);
      assert.deepEqual(verification.target_dimensions, ['professional_foundation']);
      assert.equal(
        input.competencies,
        undefined,
        'one contract replaces duplicated competency cards',
      );
      const nextGoals = input.next_goal_indices.map(
        (index: number) => input.goal_options[index].goal,
      );
      assert.ok(!nextGoals.includes('tradeoffs'), 'moving on reserves a different opportunity');
    },
    'motivation',
    undefined,
    ['verification'],
  );
  const result = await agent.advance(
    state.view,
    snapshot,
    false,
    new AbortController().signal,
    false,
    context(memory),
  );
  assert.equal(result.memory?.focus, 'motivation');
  assert.deepEqual(
    result.memory?.observations.map((observation) => [observation.goal, observation.state]),
    [['verification', 'covered']],
  );
  const missing = missingFeedbackDimensions(result.memory!, false).map(
    (dimension) => dimension.key,
  );
  assert.ok(!missing.includes('professional_foundation'));
  assert.ok(
    missing.includes('problem_solving'),
    'an intended label cannot fill an unasked dimension',
  );
});

test('goal contracts and saved purposes use the selected interview type rather than generic technical expectations', async () => {
  for (const type of ACTIVE_INTERVIEW_TYPES) {
    const { state, snapshot } = setup(type);
    state.view.turns = [
      turn(
        '请介绍与目标岗位相关的背景。',
        '我学过前端，做过课程表单页面，负责输入校验。',
        'introduction',
      ),
    ];
    let expectedPurpose = '';
    const agent = controlled(
      answered,
      '你选择当前岗位的主要依据是什么？',
      'n',
      (_body, input) => {
        for (const theme of input.policy.themes) {
          const contract = input.goal_options.find((option: any) => option.goal === theme.goal);
          assert.equal(contract.evidence_wanted, `${theme.purpose}；${theme.probe}`);
        }
        const contribution = input.goal_options.find(
          (option: any) => option.goal === 'contribution',
        );
        const learning = input.goal_options.find((option: any) => option.goal === 'learning');
        assert.match(learning.boundary, /仅问如何确认符合预期或测试步骤属于verification/);
        if (type === 'business_scenario') {
          assert.match(contribution.evidence_wanted, /本人在任务中的职责与行动/);
          assert.match(contribution.boundary, /不追问代码、配置或具体实现/);
          assert.match(learning.evidence_wanted, /得到反馈后具体调整了什么/);
        }
        if (type === 'hr') assert.match(contribution.boundary, /项目仅作行为背景，不考察技术实现/);
        expectedPurpose = input.goal_options.find(
          (option: any) => option.goal === 'motivation',
        ).evidence_wanted;
      },
      'motivation',
      undefined,
      [],
    );
    const result = await agent.advance(
      state.view,
      snapshot,
      false,
      new AbortController().signal,
      false,
      context(),
    );
    assert.equal(result.question?.purpose, expectedPurpose);
  }
});

test('sufficient answers do not fill planned goals without actual observations, and non-answers or introductions cannot invent them', async () => {
  for (const [assessment, stage, observed, rejects] of [
    [answered, 'technical', [], false],
    [greeting, 'technical', ['tradeoffs'], true],
    [{ ...answered, communication_observed: true }, 'introduction', ['motivation'], true],
  ] as const) {
    const { state, snapshot } = setup();
    state.view.turns = [
      turn(
        stage === 'introduction' ? '请介绍你与目标岗位相关的背景。' : '查询的平均复杂度是多少？',
        assessment.act === 'greeting'
          ? '你好'
          : stage === 'introduction'
            ? '我学过前端，也做过表单课程作业。'
            : 'O(1)',
        stage,
      ),
    ];
    state.view.turns[0].main_question_index = 2;
    const memory = focused();
    memory.focus = 'tradeoffs';
    const previews: string[] = [];
    const running = controlled(
      assessment,
      assessment.act === 'greeting' ? '你好，可以先介绍你的学习背景吗？' : undefined,
      'n',
      () => {},
      assessment.act === 'greeting' ? 'motivation' : 'learning',
      undefined,
      [...observed],
    ).advance(
      state.view,
      snapshot,
      false,
      new AbortController().signal,
      false,
      context(memory, previews),
    );
    if (rejects) {
      await assert.rejects(running);
      assert.deepEqual(
        previews,
        [],
        'invalid current observations must be rejected before a new question is shown',
      );
    } else {
      const result = await running;
      assert.deepEqual(result.memory?.observations, []);
      assert.ok(
        missingFeedbackDimensions(result.memory!, false).some(
          (dimension) => dimension.key === 'problem_solving',
        ),
      );
    }
  }
});

test('remaining main-question budget reserves missing dimensions instead of a second foundation goal', async () => {
  for (const type of ['technical_qa', 'business_scenario', 'mixed'] as const) {
    const { state, snapshot } = setup(type);
    const current = turn('查询的平均时间复杂度是多少？', 'O(1)', 'technical');
    current.main_question_index = 2;
    state.view.turns = [current];
    const previews: string[] = [];
    const repeatedFamily = controlled(
      answered,
      '你如何检查查询结果是否正确？',
      'n',
      (_body, input) => {
        assert.ok(goalIndex(input, 'contribution') < goalIndex(input, 'verification'));
        const nextGoals = input.next_goal_indices.map(
          (index: number) => input.goal_options[index].goal,
        );
        if (input.pacing.phase !== 'closing') {
          assert.ok(!nextGoals.includes('understanding'));
          assert.ok(!nextGoals.includes('verification'));
        } else assert.ok(nextGoals.includes('verification'));
        assert.deepEqual(input.current_question_opportunity, {
          goal: 'understanding',
          dimensions: ['professional_foundation'],
          meaning: 'scheduling_only_not_observed_evidence',
        });
        const foundation = input.required_feedback_coverage.find(
          (dimension: any) => dimension.dimension === '专业基础',
        );
        assert.deepEqual(foundation.goal_indices, [
          goalIndex(input, 'understanding'),
          goalIndex(input, 'verification'),
        ]);
      },
      'verification',
    );
    await assert.rejects(
      repeatedFamily.advance(
        state.view,
        snapshot,
        false,
        new AbortController().signal,
        false,
        context(focused(), previews),
      ),
    );
    assert.deepEqual(
      previews,
      [],
      'a repeated covered dimension must not be streamed before rejection',
    );
    const missingFamily = controlled(
      answered,
      '最近一次练习中，你实际负责哪一部分？',
      'n',
      () => {},
      'contribution',
    );
    await assert.doesNotReject(
      missingFamily.advance(
        state.view,
        snapshot,
        false,
        new AbortController().signal,
        false,
        context(focused()),
      ),
    );
    state.view.target_at = new Date(Date.now() + 30000).toISOString();
    await assert.doesNotReject(
      repeatedFamily.advance(
        state.view,
        snapshot,
        false,
        new AbortController().signal,
        false,
        context(focused()),
      ),
    );
  }
});

test('question wording about clarity is allowed, while evaluations and multiple questions are rejected', () => {
  assert.doesNotThrow(() =>
    assertPreview({ acknowledgement: '', text: '你如何验证错误提示是否清晰？' }),
  );
  assert.throws(() =>
    assertPreview({ acknowledgement: '你的思路很清晰。', text: '你如何验证错误提示？' }),
  );
  assert.throws(() =>
    assertPreview({ acknowledgement: '', text: '你为什么这样实现？你如何验证？' }),
  );
});

test('v3 receives common output and repair rules without confusing action e with evidence e', async () => {
  const { state, snapshot } = setup();
  state.view.turns = [turn('查询的平均时间复杂度是多少？', 'O(1)', 'technical')];
  let repairing = false;
  const agent = controlled(answered, undefined, 'n', (body) => {
    const system = body.messages[0].content;
    assert.ok(system.includes("仅行动a='e'受can_finish=true限制"));
    assert.ok(system.includes('最多一个问号'));
    assert.ok(system.includes('不能默认填0'));
    assert.ok(system.includes('当前问题已经答清，即使仍围绕同一项目继续聊其他方面，也属于新问题n'));
    assert.ok(system.includes('h的充分性为s时只能n/e/c，不得f'));
    assert.equal(system.includes('上次输出未通过校验'), repairing);
  });
  await agent.advance(
    state.view,
    snapshot,
    false,
    new AbortController().signal,
    false,
    context(focused()),
  );
  repairing = true;
  await agent.advance(
    state.view,
    snapshot,
    false,
    new AbortController().signal,
    true,
    context(focused()),
  );
  const missingAnchor = controlled(answered, undefined, 'n', () => {}, 'learning', null);
  await assert.rejects(
    missingAnchor.advance(
      state.view,
      snapshot,
      false,
      new AbortController().signal,
      false,
      context(focused()),
    ),
  );
});

test('i3 coverage pressure advertises only valid next goals and preserves the current follow-up branch', async () => {
  const { state, snapshot } = setup();
  const current = turn(
    '根据反馈改进提示时，你具体调整了什么？',
    '我按反馈区分输入错误和网络失败。',
    'behavioral',
  );
  current.main_question_index = 4;
  state.view.turns = [current];
  const memory = focused();
  memory.focus = 'learning';
  memory.observations = ['understanding', 'contribution'].map((goal) => ({
    goal,
    state: 'covered' as const,
    evidence_refs: [
      { turn_id: current.id, revision: current.revision, quote: current.answer_text! },
    ],
    pending: null,
  }));
  let nextGoals: string[] = [];
  const agent = controlled(
    answered,
    '你选择前端岗位的主要依据是什么？',
    'n',
    (body, input) => {
      nextGoals = input.next_goal_indices.map((index: number) => input.goal_options[index].goal);
      assert.ok(nextGoals.includes('motivation'));
      assert.ok(nextGoals.includes('tradeoffs'));
      assert.ok(!nextGoals.includes('learning'), 'next questions reserve other opportunities');
      assert.ok(!nextGoals.includes('verification'));
      const branches = body.response_format.json_schema.schema.properties.decision.anyOf;
      const next = branches.find((branch: any) => branch.properties.a.const === 'n');
      assert.deepEqual(
        next.properties.g.anyOf.map((option: { const: number }) => option.const),
        input.next_goal_indices,
      );
      const follow = branches.find((branch: any) => branch.properties.a.const === 'f');
      assert.deepEqual(
        follow.properties.g.anyOf.map((option: { const: number }) => option.const),
        [goalIndex(input, 'learning')],
      );
    },
    'motivation',
  );
  await assert.doesNotReject(
    agent.advance(
      state.view,
      snapshot,
      false,
      new AbortController().signal,
      false,
      context(memory),
    ),
  );
  for (const goal of nextGoals.filter((goal) => goal !== 'learning')) {
    const valid = controlled(
      answered,
      '面对时间有限的任务，你依据什么决定优先顺序？',
      'n',
      () => {},
      goal,
    );
    await assert.doesNotReject(
      valid.advance(
        state.view,
        snapshot,
        false,
        new AbortController().signal,
        false,
        context(memory),
      ),
    );
  }
  const follow = controlled(
    { ...answered, sufficiency: 'needs_detail', continuation: 'can_elaborate' },
    '你如何确认调整后的提示能帮助用户继续操作？',
    'f',
    () => {},
    'learning',
  );
  await assert.doesNotReject(
    follow.advance(
      state.view,
      snapshot,
      false,
      new AbortController().signal,
      false,
      context(memory),
    ),
  );
});
