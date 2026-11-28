import type {
  Interview,
  InterviewSnapshot,
  InterviewQuestion,
  InterviewMemory,
  InterviewRetrieval,
} from '@interviewlab/core';
import type { AdvanceContext } from './streaming-agent';

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
