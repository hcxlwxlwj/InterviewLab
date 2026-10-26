/** Opt-in real model check. Sends only synthetic introductions and one follow-up answer. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { config as dotenv } from 'dotenv';
import {
  INTERVIEW_PROMPT_VERSION,
  INTERVIEW_RUBRIC_VERSION,
  interviewOpening,
} from '@interviewlab/core';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { createInterviewAgent } from '../../code/backend/src/modules/interviews/agent';
import { localInterviewKnowledge } from '../../code/backend/src/modules/interviews/knowledge';
import { newInterviewState } from '../../code/backend/src/modules/interviews/repository';

async function main() {
  dotenv({ quiet: true });
  const agent = createInterviewAgent(loadConfig(process.env));
  assert.ok(agent.available, 'Configure the real model locally first');
  const scenarios: { id: string; intro: string; answer?: string }[] = [
    {
      id: 'backend-project',
      intro:
        '我是一名大三学生，想找后端实习。我做过一个课程实验室预约系统，四个人合作，我用 Spring Boot 和 PostgreSQL 负责预约接口，主要处理同一时段重复预约的问题。项目只在本机测试，没有上线。',
    },
    {
      id: 'frontend-to-backend',
      intro:
        '我是一名大三学生，想找后端实习。目前只做过 React 搜索页，负责搜索框和结果列表，接口是同学写的。我没有做过后端项目，想从接口协作的经历开始学习后端。',
    },
  ];
  scenarios.push({
    ...scenarios[0],
    id: 'backend-current-answer',
    answer:
      '我在 PostgreSQL 里给实验室、预约日期和时间段建了联合唯一约束。预约接口先尝试插入，遇到唯一约束冲突就返回 HTTP 409，告诉用户这个时段已经被占用。这样即使两个请求同时过来，也由数据库保证只能保留一条预约。',
  });
  for (const scenario of scenarios) {
    const state = newInterviewState('synthetic-conversation-check', {
      job: 'backend',
      career_stage: 'internship',
      interview_type: 'mixed',
      difficulty: '基础',
      duration_minutes: 10,
      interviewer_style: '标准',
      interaction_mode: 'text_fallback',
    });
    const v = state.view;
    v.target_at = new Date(Date.now() + 600000).toISOString();
    v.turns = [
      {
        ...interviewOpening('后端开发'),
        id: randomUUID(),
        main_question_index: 1,
        follow_up_index: 0,
        generation_id: randomUUID(),
        presented_at: null,
        answer_status: 'answered',
        answer_text: scenario.intro,
        revision: 1,
        input_mode: 'text_fallback',
        answered_at: new Date().toISOString(),
      },
    ];
    if (scenario.answer)
      v.turns.push({
        ...v.turns[0],
        id: randomUUID(),
        stage: 'technical',
        text: '你提到负责解决同一时段重复预约的问题，能具体讲讲预约接口如何处理这种情况吗？',
        acknowledgement: '你提到了预约接口，我们继续聊这部分。',
        topic: '并发预约',
        purpose: '了解本人处理冲突的具体方式',
        follow_up_index: 1,
        answer_text: scenario.answer,
      });
    const snapshot = {
      job_title: '后端开发',
      knowledge: await localInterviewKnowledge.read(v.configuration),
      prompt_version: INTERVIEW_PROMPT_VERSION,
      rubric_version: INTERVIEW_RUBRIC_VERSION,
      model: agent.model,
    };
    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = await agent.advance(v, snapshot, false, new AbortController().signal, attempt > 0);
        break;
      } catch (error) {
        if (attempt === 1) throw error;
      }
    }
    assert.ok(result?.question);
    assert.ok(result.question.evidence_refs.length);
    console.info(
      JSON.stringify({
        scenario: scenario.id,
        model: agent.model,
        acknowledgement: result.question.acknowledgement,
        question: result.question.text,
        evidence: result.question.evidence_refs.map((ref) => ref.quote),
      }),
    );
  }
}
void main().catch(() => {
  console.error('Real conversational model check failed.');
  process.exitCode = 1;
});
