/** Synthetic dialogue QA only: no database, saved resume, microphone or public index writes. */
import { config as dotenv } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import {
  ACTIVE_INTERVIEW_TYPES,
  FEEDBACK_DIMENSIONS,
  FEEDBACK_INTERVIEW_GOALS,
  questionScores,
  aggregateQuestionAssessments,
  aggregateFeedbackObservations,
  interviewPolicy,
  interviewOpening,
  nextQuestionPosition,
  type InterviewMemory,
  type InterviewSnapshot,
  type InterviewTurn,
  type InterviewEvaluation,
} from '@interviewlab/core';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { createAllRoleKnowledge } from '../../code/backend/src/modules/knowledge/all-roles';
import { createWorkflowModels } from '../../code/backend/src/modules/interviews/workflow-models';
import { createInterviewAgent } from '../../code/backend/src/modules/interviews/agent';
import { newInterviewState } from '../../code/backend/src/modules/interviews/repository';
import { ServiceError } from '../../code/backend/src/foundation/errors';
import { assertPolicyQuestion } from '../../code/backend/src/modules/interviews/question-policy';
import {
  jsonFields,
  readChatStream,
} from '../../code/backend/src/modules/interviews/stream-parser';

const answers: Record<string, string> = {
  introduction:
    '我想应聘前端实习，学过JavaScript和React。课程项目是校园活动报名页面，本人负责表单校验和报名结果展示，需求访谈由同学负责。我希望把学过的知识用在真实用户任务上。',
  understanding:
    '表单中的必填和格式检查在前端做，提交结果以接口返回为准。我理解客户端检查不能替代服务端校验。',
  contribution:
    '我负责姓名和学号的必填与格式校验，校验失败时给字段显示错误提示并阻止提交；报名成功后显示确认结果。我没有参与后端接口，也没有负责访谈。',
  verification:
    '我用空输入、错误格式和重复点击做测试，检查错误提示以及提交后页面展示，测试结果记在表格里。',
  tradeoffs:
    '时间只有一周，我先保证报名和结果确认能完成，动效放在后面，因为同学首先需要知道自己是否报名成功。',
  business:
    '目标是让同学完成报名并确认结果。我根据已有访谈结论把报名状态放到明显位置，不用收入作为课程项目目标。',
  collaboration: '我和负责接口的同学先约定返回字段，发现不一致时用一条实际请求核对，再更新约定。',
  learning:
    '第一次提示只写失败，同学不知道怎么办；我按反馈区分输入错误和网络失败，后来请同学重新操作，检查能否继续报名。',
  motivation:
    '我喜欢把实际需求变成可以使用的页面，做过React练习，也看过岗位要求，想继续学习交互和可靠性。',
  availability: '我可以两周后到岗，每周四天，连续实习三个月，地点希望在上海。',
  expectations: '期望每天两百元左右，也关注指导和实际参与机会，可以结合岗位职责沟通。',
};

async function main() {
  const selectedType = process.argv.find((arg) => arg.startsWith('--type='))?.slice(7);
  if (selectedType && !ACTIVE_INTERVIEW_TYPES.some((type) => type === selectedType))
    throw new Error('Unsupported interview type');
  const rounds = Number(process.argv.find((arg) => arg.startsWith('--rounds='))?.slice(9) ?? 3);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 42)
    throw new Error('Rounds must be an integer from 1 to 42');
  const evaluateAll = process.argv.includes('--evaluate-all');
  const interactive = process.argv.includes('--interactive');
  dotenv({ quiet: true });
  const cfg = loadConfig({
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_OUTPUT_MODE: 'json_schema',
    NODE_ENV: 'test',
  });
  if (!cfg.LLM_API_KEY) throw new Error('Real model configuration required');
  const log = (entry: object) => {
    if (process.argv.includes('--debug')) console.log(JSON.stringify(entry));
  };
  const providerOutputs: object[] = [];
  const captures: Promise<void>[] = [];
  const syntheticFetch: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    // Only fixed or interactively supplied synthetic answers; never enable in production logging.
    if (process.argv.includes('--debug') && JSON.parse(String(init?.body ?? '{}')).stream) {
      let received = '';
      const record = (complete: boolean) => {
        try {
          const parsed = jsonFields(received);
          const output = parsed.fields;
          const visible = {
            complete,
            h: output.h,
            a: (output.decision as { a?: string } | undefined)?.a ?? output.a,
            g: (output.decision as { g?: number } | undefined)?.g ?? output.g,
            e: output.e,
            v: output.v,
            response_eligibility: (output.response as { response_eligibility?: string } | undefined)
              ?.response_eligibility,
            b: output.b ?? (parsed.partial?.key === 'b' ? parsed.partial.value : undefined),
            q: output.q ?? (parsed.partial?.key === 'q' ? parsed.partial.value : undefined),
          };
          providerOutputs.push(visible);
          log({ synthetic_model_output: visible });
        } catch {
          providerOutputs.push({ capture: 'invalid_partial_json' });
        }
      };
      captures.push(
        readChatStream(
          response.clone(),
          async (text) => {
            received = text;
          },
          new AbortController().signal,
        )
          .then((raw) => {
            received = raw;
            record(true);
          })
          .catch(() => record(false)),
      );
    }
    return response;
  };
  const knowledge = createAllRoleKnowledge(cfg),
    models = createWorkflowModels(cfg, fetch, log),
    agent = createInterviewAgent(cfg, log, syntheticFetch);
  const records: object[] = [];
  const terminal = interactive
    ? createInterface({ input: process.stdin, output: process.stdout })
    : null;
  let failures = 0;
  try {
    for (const type of ACTIVE_INTERVIEW_TYPES.filter(
      (type) => !selectedType || type === selectedType,
    )) {
      const state = newInterviewState('synthetic-policy-qa', {
        job: 'frontend',
        career_stage: type === 'hr' ? 'campus' : 'internship',
        interview_type: type,
        duration_minutes: type === 'mixed' ? 20 : 10,
        difficulty: '基础',
        interviewer_style: '标准',
        interaction_mode: 'text_fallback',
      });
      const configuration = state.view.configuration;
      const questions: object[] = [];
      const evaluations: InterviewEvaluation[] = [];
      let memory: InterviewMemory | null = null;
      let plan: InterviewSnapshot['preparation_plan'];
      try {
        const k = await knowledge.read(configuration);
        plan = await models.prepare(configuration, k, undefined, new AbortController().signal);
        if (plan.policy?.version !== interviewPolicy(configuration).version)
          throw new Error('Missing policy');
        const required =
          type === 'hr'
            ? [['motivation'], ['availability'], ['expectations']]
            : Object.values(FEEDBACK_INTERVIEW_GOALS).filter((options) => options.length);
        if (
          required.some(
            (options) =>
              !plan?.goals.some((goal) => (options as readonly string[]).includes(goal.goal)),
          )
        )
          throw new Error('Preparation plan lacks required interview coverage');
        const snapshot: InterviewSnapshot = {
          runtime_version: 'graph-v1',
          interview_type: type,
          job_title: '前端开发',
          knowledge: k,
          model: cfg.LLM_MODEL,
          prompt_version: 'interview-policy-v3',
          scoring_evidence_version: 'candidate-answer-v1',
          rubric_version: 'evidence-uncalibrated-v1',
          preparation_plan: plan,
        };
        state.view.status = 'in_progress';
        state.view.started_at = new Date().toISOString();
        state.view.target_at = new Date(
          Date.now() + configuration.duration_minutes * 60000,
        ).toISOString();
        state.view.turns = [
          {
            ...interviewOpening('前端开发', configuration),
            id: 't0',
            ...nextQuestionPosition([], false)!,
            answer_text: answers.introduction,
            answer_status: 'answered',
            revision: 1,
            input_mode: 'text_fallback',
            generation_id: 'synthetic',
            presented_at: null,
            answered_at: null,
          },
        ];
        for (let i = 0; i < rounds; i++) {
          const context = {
            memory,
            retrieval: {
              release: k.content_version,
              chunks: [],
              mode: 'empty' as const,
              missing_reason: 'Synthetic QA without vector index',
            },
            preview: async () => {},
          };
          let result;
          try {
            result = await agent.advance(
              state.view,
              snapshot,
              false,
              new AbortController().signal,
              false,
              context,
            );
          } catch (error) {
            if (!(error instanceof ServiceError) || !error.retryable) throw error;
            log({ type, retry: i });
            result = await agent.advance(
              state.view,
              snapshot,
              false,
              new AbortController().signal,
              true,
              context,
            );
          }
          memory = result.memory ?? memory;
          questions.push({
            current_question: state.view.turns.at(-1)?.text,
            current_answer: state.view.turns.at(-1)?.answer_text,
            response: memory?.response,
            action: result.action,
            question: result.question,
            decision: memory?.decision,
            focus: memory?.focus,
          });
          if (!result.question) break;
          if (type === 'hr') {
            assertPolicyQuestion(result.question.text, configuration);
            if (result.question.stage === 'technical')
              throw new Error('HR must not become a technical interview');
          }
          const position = nextQuestionPosition(
            state.view.turns,
            result.action === 'follow_up',
            configuration.duration_minutes,
          );
          if (!position) break;
          let answer = answers[memory?.focus ?? 'contribution'] ?? answers.contribution;
          if (terminal) {
            console.log(`\n[${type}] goal=${memory?.focus ?? 'unknown'}\n${result.question.text}`);
            answer = await terminal.question('合成回答> ');
          }
          const t: InterviewTurn = {
            ...result.question,
            ...position,
            id: `t${i + 1}`,
            answer_text: answer,
            answer_status: 'answered',
            revision: 1,
            input_mode: 'text_fallback',
            generation_id: 'synthetic',
            presented_at: null,
            answered_at: null,
          };
          state.view.turns.push(t);
        }
        if (evaluateAll || type === 'hr' || type === 'technical_qa') {
          const lastTurns = evaluateAll
            ? [
                ...new Map(
                  state.view.turns.map((turn) => [turn.main_question_index, turn]),
                ).values(),
              ]
            : [state.view.turns.at(-1)!];
          for (const turn of lastTurns) {
            const earlier = state.view.turns.filter(
              (t) =>
                t.main_question_index === turn.main_question_index &&
                t.follow_up_index < turn.follow_up_index,
            );
            const evaluate = (repair: boolean) =>
              agent.evaluate(turn, snapshot, new AbortController().signal, repair, {
                main_question: state.view.turns.find(
                  (t) =>
                    t.main_question_index === turn.main_question_index && t.follow_up_index === 0,
                )!.text,
                earlier_answers: earlier.map((t) => ({
                  question: t.text,
                  answer: t.answer_text ?? '',
                })),
                earlier_turns: earlier,
              });
            let evaluation;
            try {
              evaluation = await evaluate(false);
            } catch (error) {
              if (!(error instanceof ServiceError) || !error.retryable) throw error;
              log({ type, scoring_retry: turn.id });
              evaluation = await evaluate(true);
            }
            evaluations.push(evaluation);
            console.log(
              JSON.stringify({
                type,
                turn_id: turn.id,
                question: turn.text,
                scoring: evaluation.feedback_assessments,
                observations: evaluation.feedback_observations,
                responses: evaluation.response_assessments,
              }),
            );
          }
          const aggregate = aggregateQuestionAssessments(
            questionScores(state.view.turns, evaluations),
          );
          records.push({
            type,
            evaluations,
            aggregate,
            observations: aggregateFeedbackObservations(evaluations, aggregate),
          });
          console.log(
            JSON.stringify({
              type,
              actual_scored_dimensions: aggregate.map((a) => a.dimension),
              unscored_dimensions: FEEDBACK_DIMENSIONS.filter(
                (d) => !aggregate.some((a) => a.dimension === d.key),
              ).map((d) => d.key),
              evaluated_all: evaluateAll,
            }),
          );
        }
        records.push({
          type,
          duration: configuration.duration_minutes,
          plan,
          questions,
          turns: state.view.turns,
          memory,
        });
        console.log(JSON.stringify({ type, questions, status: 'ok' }));
      } catch (error) {
        failures++;
        const code =
          error instanceof ServiceError
            ? error.code
            : error instanceof Error
              ? error.name
              : 'unknown';
        records.push({
          type,
          status: 'failed',
          code,
          duration: configuration.duration_minutes,
          plan,
          questions,
          turns: state.view.turns,
          memory,
          evaluations,
        });
        console.log(JSON.stringify({ type, status: 'failed', code }));
      }
    }
  } finally {
    terminal?.close();
    await Promise.allSettled(captures);
    await knowledge.close();
    await mkdir('tests/artifacts', { recursive: true });
    await writeFile(
      'tests/artifacts/interview-policy-live.json',
      JSON.stringify(
        {
          model: cfg.LLM_MODEL,
          selectedType,
          rounds,
          evaluateAll,
          interactive,
          failures,
          records,
          providerOutputs,
        },
        null,
        2,
      ),
    );
  }
  if (failures) process.exitCode = 1;
}
void main().catch(() => {
  console.error('Synthetic policy QA failed; no private provider details logged');
  process.exitCode = 1;
});
