import { FEEDBACK_DIMENSIONS } from '@interviewlab/core';
/** Build compact provider responses from synthetic domain fixtures. */
export function evaluationWire(input: unknown): unknown {
  if (!input || typeof input !== 'object' || !('turn_id' in input)) return input;
  const v = input as {
    six_scores?: Record<string, { score: number; text: string; evidence_ids: string[] }>;
    strengths?: { text: string; evidence_refs: { quote: string }[] }[];
    gaps?: { text: string; evidence_refs: { quote: string }[] }[];
    retry_goal?: string;
    reference_points?: string[];
  };
  const findings = (values: typeof v.strengths) =>
    (values ?? []).map((f) => [f.text, f.evidence_refs[0].quote.replace(/^q(\d+)$/, 'g0-$1')]);
  return {
    scores: FEEDBACK_DIMENSIONS.map((d) => {
      const a = v.six_scores?.[d.key];
      return a ? [a.score, a.text, a.evidence_ids[0] ?? null] : [0, '本次未体现', null];
    }),
    strengths: findings(v.strengths),
    gaps: findings(v.gaps),
    retry_goal: v.retry_goal ?? '补充验证过程',
    reference_points: v.reference_points ?? [],
  };
}
