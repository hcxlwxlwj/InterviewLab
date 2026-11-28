import type { ReportModelCall } from './contracts';
import { createEvaluation } from './evaluation';
import { createSummary } from './summary';
import { createAdvice } from './advice';

export * from './contracts';
export * from './guardrails';
export { reuseSingleQuestionSummary } from './summary';

export function createReportAnalysis(
  call: ReportModelCall,
  log: (entry: object) => void = () => {},
) {
  return {
    evaluate: createEvaluation(call, log),
    summarize: createSummary(call, log),
    suggest: createAdvice(call),
  };
}
export type ReportAnalysis = ReturnType<typeof createReportAnalysis>;
