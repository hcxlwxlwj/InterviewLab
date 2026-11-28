/** Agent 装配入口：复用 LangChain 传输，组合独立的面试推进与报告分析能力。 */
import type { InterviewComparison } from '@interviewlab/core';
import type { ReportAnalysis } from './reports/agent/core/tools';
import type { InterviewTurnAgent } from './interviews/agent/core/agent';
import type { BackendConfig } from '../foundation/config';
import { createInterviewAgent } from './interviews/agent/core/agent';
import { langChainFetch } from '../foundation/agent/model';
import { createModelAnalysis } from './reports/agent/core/agent';

/** Compose independent interview and report capabilities with the same model transport. */
export function createAgentRuntime(
  config: BackendConfig,
  log: (entry: object) => void = () => {},
  fetcher: typeof fetch = fetch,
) {
  return {
    ...createModelAnalysis(config, langChainFetch(config, fetcher), log),
    ...createInterviewAgent(config, log, fetcher),
  };
}

export type InterviewAgent = InterviewTurnAgent &
  Omit<ReportAnalysis, 'suggest'> & {
    suggest?: ReportAnalysis['suggest'];
    compare(
      input: InterviewComparison,
      signal: AbortSignal,
      repair: boolean,
      context?: { runtime_version?: string; model: string },
    ): Promise<Pick<InterviewComparison, 'changes' | 'remaining_gaps' | 'limitations'>>;
  };
