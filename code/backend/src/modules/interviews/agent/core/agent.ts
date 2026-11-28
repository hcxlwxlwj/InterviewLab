/** 面试 Agent 入口：以 LangChain 调用模型，用 LangGraph 编排上下文、工具执行和结果护栏。 */
import { assertQuestion } from './guardrails';
import { langChainFetch } from '../../../../foundation/agent/model';
import { createInterviewTools, createStreamingAgent, type AdvanceContext } from './tools';
import { checkedGraph } from '../../../../foundation/agent/graph';
import type { BackendConfig } from '../../../../foundation/config';
import { ServiceError } from '../../../../foundation/errors';

import type {
  Interview,
  InterviewSnapshot,
  InterviewQuestion,
  InterviewMemory,
  InterviewRetrieval,
} from '@interviewlab/core';

export interface InterviewTurnAgent {
  readonly available: boolean;
  readonly model: string;
  advance(
    interview: Interview,
    snapshot: InterviewSnapshot,
    clarify: boolean,
    signal: AbortSignal,
    repair: boolean,
    context?: AdvanceContext,
  ): Promise<{
    action: 'follow_up' | 'next' | 'finish' | 'clarify';
    question: InterviewQuestion | null;
    clarification: string | null;
    memory?: InterviewMemory;
    retrieval?: InterviewRetrieval;
  }>;
}

/** The single interview runtime: LangChain transport and a bounded LangGraph turn workflow. */
export function createInterviewAgent(
  config: BackendConfig,
  log: (entry: object) => void = () => {},
  fetcher: typeof fetch = fetch,
): InterviewTurnAgent {
  const transport = langChainFetch(config, fetcher);
  const graphBase = {
    available: Boolean(config.LLM_BASE_URL && config.LLM_API_KEY && config.LLM_MODEL),
    model: config.LLM_MODEL ?? 'unconfigured',
  };
  const realtime = createStreamingAgent(graphBase, config, log, transport);
  const tools = createInterviewTools(realtime.advance, log);
  return {
    ...graphBase,
    async advance(interview, snapshot, clarify, signal, repair, context) {
      if (snapshot.runtime_version !== 'graph-v1')
        throw new ServiceError(
          'unsupported_input',
          409,
          '该面试使用已停用的运行时，请新建面试；原记录仍可查看',
        );
      return checkedGraph(
        'interview_advance',
        { interview, snapshot, context },
        {
          prepare: (input) => {
            if (!input.context || !input.snapshot.knowledge.agent_release)
              throw new ServiceError('invalid_state', 409, '面试准备上下文缺失');
            return input;
          },
          generate: (input) =>
            tools.generate_question.invoke(
              input.interview,
              input.snapshot,
              clarify,
              signal,
              repair,
              input.context,
            ),
          validate: (raw) => {
            const result = raw as Awaited<ReturnType<InterviewTurnAgent['advance']>>;
            if (result.question) assertQuestion(result.question, snapshot, interview.turns);
            return result;
          },
        },
        signal,
        log,
      );
    },
  };
}
