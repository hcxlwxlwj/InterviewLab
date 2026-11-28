import type { InterviewComparison } from '@interviewlab/core';
import type { ReportAnalysis } from './reports/agent/analysis';
import type { InterviewTurnAgent } from './interviews/agent/runtime/types';
import type { BackendConfig } from '../foundation/config';
import { createInterviewAgent } from './interviews/agent/runtime/interview-agent';
import { langChainFetch } from './interviews/agent/runtime/model';
import { createModelAnalysis } from './reports/agent/model-analysis';

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
