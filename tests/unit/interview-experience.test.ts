import {
  replyAct,
  conversationPolicy,
  assertConversationQuestion,
} from '../../code/backend/src/modules/interviews/conversation';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evidenceMatches,
  type Interview,
  type InterviewSnapshot,
  type InterviewMemory,
} from '@interviewlab/core';
import {
  experiencePolicy,
  assertExperienceQuestion,
} from '../../code/backend/src/modules/interviews/experience';
import { newInterviewState } from '../../code/backend/src/modules/interviews/repository';
import { readKnowledgeSeed } from '../../code/backend/src/modules/knowledge/service';
import { createInterviewAgent } from '../../code/backend/src/modules/interviews/agent';
import { withRealtimeAgent } from '../../code/backend/src/modules/interviews/agent-v3';
import { loadConfig } from '../../code/backend/src/foundation/config';
const seedPromise = readKnowledgeSeed();
function interview(answers: string[]): Interview {
  const state = newInterviewState('controlled', {
    job: 'frontend',
    career_stage: 'internship',
    interview_type: 'technical_qa',
    difficulty: '基础',
    duration_minutes: 10,
    interviewer_style: '标准',
    interaction_mode: 'text_fallback',
  });
  state.view.status = 'in_progress';
  state.view.target_at = new Date(Date.now() + 600000).toISOString();
  state.view.turns = answers.map((answer, i) => ({
    id: `turn-${i}`,
    stage: i === 0 ? 'introduction' : 'experience',
    text: i ? '请介绍这个项目。' : '请做自我介绍。',
    topic: '经历',
    purpose: '了解真实项目',
    knowledge_question_id: null,
    source_refs: [],
    evidence_refs: [],
    main_question_index: 1,
    follow_up_index: i % 3,
    generation_id: 'generation',
    presented_at: null,
    answer_status: 'answered',
    answer_text: answer,
    revision: 1,
    input_mode: 'text_fallback',
    answered_at: new Date().toISOString(),
  }));
  return state.view;
}
test('a bare 3D game label leaves both project purpose and personal responsibilities unknown', () => {
  const v = interview(['我是XXX，我做过很多项目', '一个3D小游戏']);
  const policy = experiencePolicy(v);
  assert.deepEqual(policy.missing, ['project_description', 'personal_role']);
  assert.equal(policy.discovery_required, true);
  assert.equal(policy.hypothetical_allowed, false);
  for (const q of ['这个游戏主要怎么玩？', '你在这个游戏里具体负责哪部分？'])
    assert.doesNotThrow(() => assertExperienceQuestion(q, policy, false, true));
  assert.throws(() =>
    assertExperienceQuestion(
      '假设这个3D小游戏需要支持多人实时互动，你会如何权衡通信延迟与画面同步的精度？',
      policy,
      true,
      true,
    ),
  );
  assert.throws(() => assertExperienceQuestion('你是怎样优化渲染性能的？', policy, true, true));
});

test('a first-person clause can omit I without losing an already stated personal role', () => {
  const v = interview(['我学过HTML和CSS，做过一个个人介绍静态网页，自己负责页面结构和样式。']);
  const p = experiencePolicy(v);
  assert.ok(p.experience.personal_role);
  assert.ok(!p.missing.includes('personal_role'));
  assert.ok(evidenceMatches(p.experience.personal_role!, v.turns));
  const other = experiencePolicy(interview(['网站让用户自己负责填写资料。']));
  assert.equal(other.experience.personal_role, null);
});
test('concrete gameplay does not establish personal ownership and an ownership answer does not establish gameplay', () => {
  const purpose = experiencePolicy(
    interview(['我做了一个游戏', '玩家控制小球躲避障碍到达终点，是个单机闯关游戏。']),
  );
  assert.deepEqual(purpose.missing, ['personal_role']);
  assert.doesNotThrow(() => assertExperienceQuestion('你具体负责哪部分？', purpose, false, true));
  assert.throws(() => assertExperienceQuestion('游戏的主要玩法是什么？', purpose, false, true));
  const role = experiencePolicy(interview(['一个3D小游戏', '全部都是我一个人完成的。']));
  assert.deepEqual(role.missing, ['project_description']);
  assert.doesNotThrow(() =>
    assertExperienceQuestion('能介绍一下这个游戏的玩法吗？', role, false, true),
  );
});
test('only established actual discussion permits an extension, and an unclear current answer still needs a probe', () => {
  const v = interview([
    '游戏里玩家控制小球到达终点，我负责角色移动和碰撞检测。',
    '我用Unity实现了球体移动，碰撞时会把球放回最近的检查点。',
    '我分别测试撞墙、落地和越过终点，确认触发结果符合预期。',
  ]);
  const policy = experiencePolicy(v);
  assert.equal(policy.discovery_required, false);
  assert.equal(policy.hypothetical_allowed, true);
  assert.doesNotThrow(() =>
    assertExperienceQuestion('假设增加一个移动障碍，你会如何验证碰撞行为？', policy, true, true),
  );
  assert.throws(() =>
    assertExperienceQuestion('假设增加一个移动障碍，你会如何验证碰撞行为？', policy, false, true),
  );
  const short = experiencePolicy(
    interview([v.turns[0].answer_text!, v.turns[1].answer_text!, '就是处理一下']),
  );
  assert.equal(short.hypothetical_allowed, false);
});
test('absence of internship is not absence of projects; no-experience alone does not request a scenario', () => {
  const campus = experiencePolicy(interview(['我没有实习，做的是课程项目。']));
  assert.equal(campus.hypothetical_allowed, false);
  assert.equal(campus.discovery_required, true);
  const unavailable = experiencePolicy(interview(['我还没有做过任何项目。']));
  assert.equal(unavailable.next_step, 'alternative_experience');
  assert.equal(unavailable.user_requested_scenario, false);
  assert.throws(() =>
    assertExperienceQuestion('假设要做一个待办页面，你会先考虑什么？', unavailable, false, true),
  );
  const requested = experiencePolicy(interview(['我想先练情境题。']));
  assert.equal(requested.user_requested_scenario, true);
  assert.doesNotThrow(() =>
    assertExperienceQuestion('假设要做一个待办页面，你会先考虑什么？', requested, false, true),
  );
});
test('explicitly declining hypothetical questions is not parsed as a request for them', () => {
  for (const answer of [
    '请不要给我假设题，先聊项目。',
    '我不想练情境题。',
    '我没有做过项目，但不要问假设题。',
  ]) {
    const policy = experiencePolicy(interview([answer]));
    assert.equal(policy.hypothetical_allowed, false);
    assert.equal(policy.user_requested_scenario, false);
    assert.throws(() =>
      assertExperienceQuestion('假设做一个页面，你会怎么设计？', policy, true, true),
    );
  }
});
test('switching projects cannot reuse the previous project role and stored grounding is bounded verbatim evidence', () => {
  const v = interview(['我做了选课页面，用户可以选课。我负责表单。', '另一个项目是一个3D小游戏']);
  const p = experiencePolicy(v);
  assert.equal(p.experience.personal_role, null);
  assert.equal(p.discovery_required, true);
  const long = interview([
    '项目是选课系统，用户可以浏览课程。' + '项目背景说明，'.repeat(100) + '我负责表单和请求处理。',
  ]);
  const known = experiencePolicy(long);
  for (const ref of [known.experience.description, known.experience.personal_role]) {
    assert.ok(ref);
    assert.ok(ref.quote.length <= 240);
    assert.ok(evidenceMatches(ref, long.turns));
  }
});
function response(output: unknown) {
  const text = JSON.stringify(output);
  return new Response(
    new ReadableStream({
      start(c) {
        for (let at = 0; at < text.length; at += 5)
          c.enqueue(
            new TextEncoder().encode(
              'data: ' +
                JSON.stringify({ choices: [{ delta: { content: text.slice(at, at + 5) } }] }) +
                '\n\n',
            ),
          );
        c.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        c.close();
      },
    }),
  );
}
async function run(
  v: Interview,
  question: string,
  memory: InterviewMemory | null = null,
  expectedStep = 'project_discovery',
) {
  const seed = await seedPromise;
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
        embedding_model: 'ecnu-embedding-small',
        dimensions: 1024,
        profile: seed.profiles[0],
        competencies: seed.competencies,
      },
    },
  };
  const cfg = loadConfig({ LLM_API_KEY: 'controlled' });
  const previews: string[] = [];
  let calls = 0;
  const agent = withRealtimeAgent(
    createInterviewAgent(cfg),
    cfg,
    () => {},
    async (_url, init) => {
      calls++;
      const body = JSON.parse(init!.body as string),
        input = JSON.parse(body.messages[1].content);
      assert.equal(input.experience_context.next_step, expectedStep);
      if (expectedStep === 'topic_transition') {
        assert.ok(input.goal_options.includes('learning'));
        assert.ok(!input.goal_options.includes('motivation'));
      } else
        assert.deepEqual(input.goal_options, [
          expectedStep === 'introduction' ? 'motivation' : 'contribution',
        ]);
      assert.deepEqual(input.knowledge, []);
      return response({
        a:
          expectedStep === 'topic_transition'
            ? 'n'
            : v.turns.at(-1)!.follow_up_index < 2
              ? 'f'
              : 'n',
        g: 0,
        e: 0,
        o: 1,
        q: question,
        s: [],
      });
    },
  );
  const result = agent.advance(v, snapshot, false, new AbortController().signal, false, {
    memory,
    retrieval: {
      release: seed.id,
      mode: 'prefetched',
      missing_reason: null,
      chunks: [
        {
          id: 'technical-distraction',
          card_id: 'unrelated',
          release: seed.id,
          text: '多人网络同步与延迟',
          source_refs: [],
          goals: ['understanding'],
          types: ['technical_qa'],
        },
      ],
    },
    preview: async (p) => {
      if (p.text) previews.push(p.text);
    },
  });
  return { result, previews, calls: () => calls };
}
test('actual v3 stream rejects the screenshot hypothetical before exposing it, even when the model marks the answer covered', async () => {
  const testCase = await run(
    interview(['我是XXX，我做过很多项目', '一个3D小游戏']),
    '假设这个小游戏需要多人同步，你会怎么设计？',
  );
  await assert.rejects(testCase.result);
  assert.equal(testCase.calls(), 1);
  assert.equal(testCase.previews.length, 0);
});
test('actual v3 stream asks for one missing fact and preserves incomplete contribution state', async () => {
  const v = interview(['我是XXX，我做过很多项目', '一个3D小游戏']);
  const testCase = await run(v, '这个游戏的主要玩法是什么？');
  const result = await testCase.result;
  assert.equal(result.question?.stage, 'experience');
  assert.equal(
    result.memory?.observations.find((o) => o.goal === 'contribution')?.state,
    'needs_probe',
  );
  assert.equal(result.memory?.experience?.personal_role, null);
  assert.equal(testCase.calls(), 1);
  assert.ok(testCase.previews.length > 0);
});

test('greetings and name-only replies do not complete the introduction or establish project experience', () => {
  for (const answer of ['你好', '您好！', '好的', '你好，我叫张三。']) {
    const v = interview([answer]);
    const p = experiencePolicy(v);
    assert.equal(p.next_step, 'introduction');
    assert.equal(p.hypothetical_allowed, false);
    assert.equal(p.actual_discussion_started, false);
    assert.doesNotThrow(() =>
      assertExperienceQuestion('你好，可以先简单介绍一下你的学习背景吗？', p, false, true),
    );
    assert.throws(() =>
      assertExperienceQuestion('请具体说说你做过的一个前端项目的内容。', p, true, true),
    );
  }
});
test('the screenshot no-frontend-project reply asks about alternatives, not performance scenarios', () => {
  const p = experiencePolicy(interview(['你好', '我没有做过前端项目']));
  assert.equal(p.next_step, 'alternative_experience');
  assert.equal(p.user_requested_scenario, false);
  assert.equal(p.hypothetical_allowed, false);
  assert.doesNotThrow(() =>
    assertExperienceQuestion('你目前接触过哪些前端课程或练习？', p, false, true),
  );
  assert.throws(() =>
    assertExperienceQuestion('假设要优化前端加载性能，你会先确定哪些指标？', p, true, true),
  );
  assert.throws(() => assertExperienceQuestion('请介绍你做过的前端项目。', p, true, true));
});
test('beginner questions follow stated learning, including short answers to learning questions', () => {
  const v = interview(['你好', '我没有做过前端项目', '我学过HTML和CSS，做过简单样式练习。']);
  const p = experiencePolicy(v);
  assert.equal(p.next_step, 'learning_basics');
  assert.ok(p.learning_background && evidenceMatches(p.learning_background, v.turns));
  assert.equal(p.hypothetical_allowed, false);
  const short = interview(['我没有项目经验。', 'HTML、CSS']);
  short.turns[1].text = '你目前学过哪些内容？';
  assert.equal(experiencePolicy(short).next_step, 'learning_basics');
  const none = interview(['我没有做过前端项目', '我是零基础，完全没学过前端。']);
  assert.equal(experiencePolicy(none).next_step, 'motivation');
});

test('greeting and no-project streams never expose a premature project or optimization question', async () => {
  for (const [v, q, step] of [
    [interview(['你好']), '请具体说说你做过的一个前端项目。', 'introduction'],
    [
      interview(['你好', '我没有做过前端项目']),
      '假设要优化前端加载性能，你会先确定哪些指标？',
      'alternative_experience',
    ],
  ] as const) {
    const checked = await run(v, q, null, step);
    await assert.rejects(checked.result);
    assert.equal(checked.calls(), 1);
    assert.equal(checked.previews.length, 0);
  }
});
test('greeting recovery preserves introduction stage and no-project recovery invites learning without marking coverage', async () => {
  for (const [v, q, step, stage] of [
    [interview(['你好']), '你好，可以先介绍一下你的学习背景吗？', 'introduction', 'introduction'],
    [
      interview(['你好', '我没有做过前端项目']),
      '你目前接触过哪些课程或练习？',
      'alternative_experience',
      'experience',
    ],
  ] as const) {
    const checked = await run(v, q, null, step);
    const result = await checked.result;
    assert.equal(result.question?.stage, stage);
    assert.equal(result.memory?.observations[0].state, 'needs_probe');
    assert.equal(result.retrieval?.chunks.length, 0);
  }
});

test('zero-basics acknowledgement is not recorded as a learned topic or repeatedly sent back to experience discovery', () => {
  const v = interview([
    '你好',
    '我没做过前端项目',
    '我是零基础，完全没学过前端。',
    '我喜欢做清晰的界面，所以想了解这个岗位。',
  ]);
  v.turns[2].text = '你接触过哪些课程或练习？';
  v.turns[3].text = '为什么想选择这个方向？';
  v.turns[3].stage = 'behavioral';
  v.turns[3].topic = '岗位动机';
  const p = experiencePolicy(v);
  assert.equal(p.learning_background, null);
  assert.equal(p.next_step, 'motivation');
  assert.equal(p.hypothetical_allowed, false);
  assert.equal(p.actual_discussion_started, true);
});

test('confirming that some coursework exists does not establish its subject', () => {
  const v = interview(['你好', '我没做过前端项目', '有']);
  v.turns[2].text = '有没有相关课程或练习？';
  const p = experiencePolicy(v);
  assert.equal(p.next_step, 'alternative_experience');
  assert.equal(p.learning_background, null);
  assert.equal(p.hypothetical_allowed, false);
  assert.doesNotThrow(() => assertExperienceQuestion('具体接触过哪些课程或练习？', p, false, true));
});

test('refusal, unknown knowledge and greetings have different dialogue meanings', () => {
  assert.equal(replyAct('不方便'), 'decline_topic');
  assert.equal(replyAct('不知道'), 'dont_know');
  assert.equal(replyAct('我不会CSS'), 'dont_know');
  assert.equal(replyAct('你好'), 'greeting');
  assert.equal(replyAct('我学过HTML，但不知道CSS布局。'), 'answer');
});
test('a declined learning-background question is a boundary, not learned content', () => {
  const v = interview(['你好', '不方便']);
  v.turns[1].text = '方便先聊聊你的学习背景吗？';
  v.turns[1].stage = 'introduction';
  const p = experiencePolicy(v);
  assert.equal(p.next_step, 'topic_transition');
  assert.equal(p.learning_background, null);
  assert.equal(p.conversation.boundaries[0].topic, 'personal_background');
  assert.equal(p.conversation.boundaries[0].scope, 'topic');
  assert.ok(evidenceMatches(p.conversation.boundaries[0].evidence_ref, v.turns));
  assert.doesNotThrow(() =>
    assertExperienceQuestion('好，学习背景这部分跳过。你最近接触过哪些前端技术？', p, false, true),
  );
  for (const q of [
    '如果方便，想了解你应聘前端的原因。',
    '那方便介绍一下学习背景吗？',
    '你毕业于哪个学校？',
  ])
    assert.throws(() => assertExperienceQuestion(q, p, true, true));
});
test('topic boundaries survive later answers, while an explicit reopening is accepted', () => {
  const v = interview(['你好', '不方便', '我学过HTML和CSS。']);
  v.turns[1].text = '方便聊你的学习背景吗？';
  v.turns[1].stage = 'introduction';
  v.turns[2].text = '你最近接触过哪些前端技术？';
  const p = experiencePolicy(v);
  assert.equal(p.conversation.last_act, 'answer');
  assert.equal(p.next_step, 'learning_basics');
  assert.equal(p.conversation.boundaries.length, 1);
  assert.throws(() => assertExperienceQuestion('你是哪个学校毕业的？', p, true, true));
  v.turns[2].answer_text = '现在可以聊学习背景了，我是计算机专业学生。';
  assert.equal(conversationPolicy(v).boundaries.length, 0);
});
test('declining one technical question does not ban the entire technical interview', () => {
  const v = interview(['我学过JavaScript。', '这题不方便回答。']);
  v.turns[1].text = '解释一下闭包是什么？';
  v.turns[1].stage = 'technical';
  const p = experiencePolicy(v);
  assert.equal(p.conversation.boundaries[0].scope, 'question');
  assert.doesNotThrow(() =>
    assertConversationQuestion('JavaScript中let和const有什么区别？', p.conversation, true),
  );
  assert.throws(() => assertConversationQuestion('解释一下闭包是什么？', p.conversation, true));
  const unknown = interview(['我学过JavaScript。', '不知道']);
  unknown.turns[1].text = '解释一下闭包是什么？';
  unknown.turns[1].stage = 'technical';
  assert.equal(conversationPolicy(unknown).boundaries.length, 0);
});
test('a project refusal permits a genuine topic change rather than repeatedly filling project slots', () => {
  const v = interview(['我做过一个游戏项目', '这个项目涉及保密，不方便说。']);
  v.turns[1].text = '你在这个项目中负责什么？';
  const p = experiencePolicy(v);
  assert.equal(p.next_step, 'topic_transition');
  assert.equal(p.discovery_required, false);
  assert.doesNotThrow(() =>
    assertExperienceQuestion('好，这部分跳过。你接触过哪些前端技术？', p, false, true),
  );
  assert.throws(() => assertExperienceQuestion('那你在项目里具体负责哪部分？', p, true, true));
});
test('v3 accepts a direct transition, records the boundary and does not score a refusal as a missing skill', async () => {
  const v = interview(['你好', '不方便']);
  v.turns[1].text = '方便先聊聊你的学习背景吗？';
  v.turns[1].stage = 'introduction';
  const checked = await run(
    v,
    '好，这部分跳过。你最近接触过哪些前端技术？',
    null,
    'topic_transition',
  );
  const result = await checked.result;
  assert.equal(checked.calls(), 1);
  assert.equal(result.action, 'next');
  assert.equal(result.memory?.conversation?.boundaries[0].topic, 'personal_background');
  assert.equal(result.memory?.observations[0].state, 'inconclusive');
  assert.equal(result.memory?.observations[0].pending, null);
  assert.deepEqual(result.memory?.claims, []);
  const invalid = await run(v, '如果方便，能介绍一下学习背景吗？', null, 'topic_transition');
  await assert.rejects(invalid.result);
  assert.equal(invalid.previews.length, 0);
});

test('a knowledge denial with a subject is not a learned subject or a privacy boundary', () => {
  const v = interview(['我没做过前端项目。', '我不会HTML和CSS']);
  v.turns[1].text = '你学过哪些前端内容？';
  const p = experiencePolicy(v);
  assert.equal(p.learning_background, null);
  assert.equal(p.conversation.last_act, 'dont_know');
  assert.deepEqual(p.conversation.boundaries, []);
});
