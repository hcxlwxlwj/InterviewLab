import { z } from 'zod';
import type {
  InterviewMemory,
  InterviewMemoryDelta,
  InterviewSnapshot,
  InterviewTurn,
} from '@interviewlab/core';
import { evidenceMatches } from '@interviewlab/core';
import { ServiceError } from '../../foundation/errors';
const evidence = z
  .object({
    turn_id: z.string(),
    revision: z.number().int().positive(),
    quote: z.string().min(1).max(300),
  })
  .strict();
export const memoryDeltaSchema = z
  .object({
    focus: z.string().max(50),
    intent: z.string().min(1).max(120),
    observations: z
      .array(
        z
          .object({
            goal: z.string(),
            state: z.enum(['needs_probe', 'covered', 'inconclusive', 'not_applicable']),
            evidence_refs: z.array(evidence).min(1).max(2),
            pending: z.string().max(180).nullable(),
          })
          .strict(),
      )
      .max(3),
    claims: z
      .array(
        z
          .object({
            text: z.string().min(1).max(300),
            evidence_refs: z.array(evidence).min(1).max(2),
          })
          .strict(),
      )
      .max(3),
  })
  .strict();
export function initialMemory(): InterviewMemory {
  return { version: 0, focus: null, observations: [], claims: [], asked_intents: [] };
}
export function applyMemory(
  memory: InterviewMemory | null,
  delta: InterviewMemoryDelta,
  snapshot: InterviewSnapshot,
  turns: InterviewTurn[],
): InterviewMemory {
  const base = memory ?? initialMemory();
  const goals = new Set(snapshot.knowledge.agent_release?.competencies.map((g) => g.id) ?? []);
  if (!goals.has(delta.focus) || delta.observations.some((x) => !goals.has(x.goal)))
    throw new ServiceError('invalid_model_output', 502, '观察目标不可用');
  for (const row of [...delta.observations, ...delta.claims])
    if (row.evidence_refs.some((e) => !evidenceMatches(e, turns)))
      throw new ServiceError('invalid_model_output', 502, '记忆引用无效');
  // Claims are quoted statements, never model-inferred candidate facts.
  for (const claim of delta.claims)
    if (!claim.evidence_refs.some((e) => e.quote === claim.text))
      throw new ServiceError('invalid_model_output', 502, '陈述必须使用原文');
  if (base.asked_intents.includes(delta.intent))
    throw new ServiceError('invalid_model_output', 502, '重复的问题意图');
  const observations = new Map(base.observations.map((x) => [x.goal, x]));
  delta.observations.forEach((x) => observations.set(x.goal, x));
  return {
    version: base.version + 1,
    ...(base.experience ? { experience: base.experience } : {}),
    ...(base.conversation ? { conversation: base.conversation } : {}),
    focus: delta.focus,
    observations: [...observations.values()],
    claims: [...base.claims, ...delta.claims]
      .filter((x, i, a) => a.findIndex((v) => v.text === x.text) === i)
      .slice(-24),
    asked_intents: [...base.asked_intents, delta.intent].slice(-18),
  };
}
