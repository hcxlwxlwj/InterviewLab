import test from 'node:test';
import assert from 'node:assert/strict';
import {
  jsonFields,
  readChatStream,
} from '../../code/backend/src/modules/interviews/stream-parser';
import { applyMemory, initialMemory } from '../../code/backend/src/modules/interviews/memory';
import { withRealtimeAgent } from '../../code/backend/src/modules/interviews/agent-v3';
import { createInterviewAgent } from '../../code/backend/src/modules/interviews/agent';
import { newInterviewState } from '../../code/backend/src/modules/interviews/repository';
import { loadConfig } from '../../code/backend/src/foundation/config';
import {
  readKnowledgeSeed,
  createKnowledgeService,
} from '../../code/backend/src/modules/knowledge/service';
import type { InterviewSnapshot, InterviewTurn, InterviewMemoryDelta } from '@interviewlab/core';
const seedPromise = readKnowledgeSeed();
function stream(value: unknown, truncate = false) {
  const raw = JSON.stringify(value);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < raw.length; i += 7)
          controller.enqueue(
            new TextEncoder().encode(
              'data: ' +
                JSON.stringify({ choices: [{ delta: { content: raw.slice(i, i + 7) } }] }) +
                '\n\n',
            ),
          );
        if (!truncate) controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}
test('incremental JSON handles escaped delimiters, Unicode and nested data at every split', () => {
  const raw = JSON.stringify({
    action: 'next',
    refs: [{ quote: '逗号，括号}和引号"\\' }],
    acknowledgement: '继续聊聊。',
    text: '你提到的实现，是如何验证的？',
  });
  for (let i = 1; i <= raw.length; i++) {
    const part = jsonFields(raw.slice(0, i));
    if (part.partial?.key === 'text')
      assert.ok('你提到的实现，是如何验证的？'.startsWith(part.partial.value));
  }
  assert.equal(jsonFields(raw).fields.text, '你提到的实现，是如何验证的？');
  assert.throws(() => jsonFields('x'.repeat(65537)));
});
test('truncated provider streams are rejected rather than treated as completed questions', async () => {
  await assert.rejects(
    readChatStream(
      stream({ text: '半条问题' }, true),
      async () => {},
      new AbortController().signal,
    ),
  );
});
test('draft content is explicit; seed has 8 goals, 20 sourced cards and 16 authored questions', async () => {
  const seed = await seedPromise;
  assert.equal(seed.review_state, 'draft');
  assert.equal(seed.competencies.length, 8);
  assert.equal(seed.cards.length, 20);
  assert.equal(seed.questions.length, 16);
  assert.throws(() => loadConfig({ NODE_ENV: 'production', KNOWLEDGE_PREVIEW: 'true' }));
  const kb = createKnowledgeService(loadConfig({}));
  assert.equal(
    (await kb.profiles({ job: 'backend', career_stage: 'campus' })).version,
    'legacy-v2',
  );
  await kb.close();
});
const scenarios = [
  ['technical_qa', '原理'],
  ['business_scenario', '用户目标'],
  ['hr', '协作'],
  ['mixed', '验证'],
] as const;
for (let n = 0; n < 30; n++)
  test(`v3 multi-turn evidence and memory case ${n + 1}`, async () => {
    const seed = await seedPromise;
    const [type, label] = scenarios[n % 4];
    const profile = seed.profiles.find((x) => x.type === type)!;
    const goal = profile.goals[0];
    const state = newInterviewState('test', {
      job: 'frontend',
      career_stage: 'internship',
      interview_type: type,
      difficulty: '基础',
      duration_minutes: 5,
      interviewer_style: '标准',
      interaction_mode: 'text_fallback',
    });
    const snapshot: InterviewSnapshot = {
      job_title: '前端',
      model: 'ecnu-plus',
      prompt_version: 'interview-conversation-v3',
      rubric_version: 'uncalibrated',
      knowledge: {
        content_version: seed.id,
        questions: [],
        sources: [],
        missing_reason: null,
        agent_release: {
          id: seed.id,
          profile,
          competencies: seed.competencies,
          embedding_model: 'ecnu-embedding-small',
          dimensions: 1024,
        },
      },
    };
    state.view.status = 'in_progress';
    state.view.target_at = new Date(Date.now() + 300000).toISOString();
    let memory = initialMemory();
    const answer =
      n % 3 === 0
        ? '我没有实习，做的是课程选课项目，用户可以浏览课程并提交选课。我负责表单和接口交互。'
        : n % 3 === 1
          ? '我负责选课页面的表单，用户可以选择课程。我已经重复测量十次并说明了网络条件。'
          : '在课程选课项目中，我负责界面和交互，用户可以提交选课。我把小组目标列出来，先完成核心任务。';
    for (let round = 0; round < 2; round++) {
      const turn: InterviewTurn = {
        id: `turn-${round}`,
        stage: 'experience',
        text: `问题${round}`,
        topic: label,
        purpose: '验证',
        knowledge_question_id: null,
        source_refs: [],
        evidence_refs: [],
        main_question_index: round + 1,
        follow_up_index: 0,
        generation_id: 'test-generation',
        presented_at: null,
        answer_status: 'answered',
        answer_text: answer,
        revision: 1,
        input_mode: 'text_fallback',
        answered_at: new Date().toISOString(),
      };
      state.view.turns.push(turn);
      const evidence = { turn_id: turn.id, revision: 1, quote: answer };
      const delta: InterviewMemoryDelta = {
        focus: goal,
        intent: `${label}-具体行动-${round}`,
        observations: [
          {
            goal,
            state: round ? 'covered' : 'needs_probe',
            evidence_refs: [evidence],
            pending: round ? null : '了解当时的判断依据',
          },
        ],
        claims: [{ text: answer, evidence_refs: [evidence] }],
      };
      const output = {
        a: 'f',
        g: 0,
        e: 0,
        q: `在第${round + 1}次尝试中，你如何验证自己的判断？`,
        s: [],
        o: round ? 1 : 0,
      };
      const cfg = loadConfig({ LLM_API_KEY: 'test' });
      let calls = 0;
      const agent = withRealtimeAgent(
        createInterviewAgent(cfg),
        cfg,
        () => {},
        async (_url, init) => {
          calls++;
          const body = JSON.parse(init!.body as string);
          assert.equal(body.stream, true);
          assert.deepEqual(body.thinking, { type: 'disabled' });
          return stream(output);
        },
      );
      const previews: object[] = [];
      const result = await agent.advance(
        state.view,
        snapshot,
        false,
        new AbortController().signal,
        false,
        {
          memory,
          retrieval: { release: seed.id, chunks: [], missing_reason: null, mode: 'empty' },
          preview: async (x) => {
            previews.push(x);
          },
        },
      );
      assert.equal(calls, 1);
      assert.ok(previews.length);
      assert.equal(result.memory?.version, round + 1);
      memory = result.memory!;
      assert.throws(() =>
        applyMemory(
          memory,
          { ...delta, intent: memory.asked_intents.at(-1)! },
          snapshot,
          state.view.turns,
        ),
      );
      const corrupt = {
        ...delta,
        intent: `new-${round}`,
        claims: [{ text: '模型编造的事实', evidence_refs: [evidence] }],
      };
      assert.throws(() => applyMemory(memory, corrupt, snapshot, state.view.turns));
    }
    assert.equal(memory.observations.find((x) => x.goal === goal)?.state, 'covered');
    assert.equal(memory.asked_intents.length, 2);
  });
