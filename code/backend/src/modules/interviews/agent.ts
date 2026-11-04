import type { InterviewAgent } from './model-analysis';
import { assertQuestion, createModelAnalysis } from './model-analysis';
import { createStreamingAgent } from './streaming-agent';
import { langChainFetch } from './model';
import { checkedGraph } from './graph';
import type { BackendConfig } from '../../foundation/config';
import { ServiceError } from '../../foundation/errors';

/** The single interview runtime: LangChain transport and a bounded LangGraph turn workflow. */
export function createInterviewAgent(
  config: BackendConfig,
  log: (entry: object) => void = () => {},
  fetcher: typeof fetch = fetch,
): InterviewAgent {
  const transport = langChainFetch(config, fetcher);
  const graphBase = createModelAnalysis(config, transport, log);
  const realtime = createStreamingAgent(graphBase, config, log, transport);
  return {
    ...graphBase,
    async advance(interview, snapshot, clarify, signal, repair, context) {
      if (snapshot.runtime_version !== 'graph-v1')
        throw new ServiceError('unsupported_input', 409, '该面试使用已停用的运行时，请新建面试；原记录仍可查看');
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
            realtime.advance(
              input.interview,
              input.snapshot,
              clarify,
              signal,
              repair,
              input.context,
            ),
          validate: (raw) => {
            const result = raw as Awaited<ReturnType<InterviewAgent['advance']>>;
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
