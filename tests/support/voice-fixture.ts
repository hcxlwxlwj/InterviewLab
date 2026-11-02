import { randomUUID } from 'node:crypto';
import type { Interview, VoiceServerEvent } from '@interviewlab/core';
import type { VoiceInterviews } from '../../code/backend/src/modules/interviews/voice/session';
import type {
  VoiceProvider,
  Recognition,
} from '../../code/backend/src/modules/interviews/voice/volcengine';
import { ServiceError } from '../../code/backend/src/foundation/errors';
export function voiceFixture() {
  let view: Interview = {
    id: randomUUID(),
    version: 1,
    status: 'in_progress',
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    ended_at: null,
    end_reason: null,
    configuration: {
      job: 'frontend',
      career_stage: 'internship',
      interview_type: 'technical_qa',
      difficulty: '基础',
      duration_minutes: 5,
      interviewer_style: '标准',
      interaction_mode: 'text_fallback',
    },
    job_title: '前端开发',
    plan: [],
    generation_id: randomUUID(),
    generation_status: 'ready',
    task_id: null,
    clarification: null,
    target_at: null,
    deadline_at: null,
    parent_interview_id: null,
    parent_turn_id: null,
    parent_revision: null,
    retry_goal: null,
    turns: [
      {
        id: randomUUID(),
        text: '请介绍你负责的项目。',
        topic: '项目',
        purpose: '项目交流',
        knowledge_question_id: null,
        source_refs: [],
        evidence_refs: [],
        main_question_index: 1,
        follow_up_index: 0,
        generation_id: randomUUID(),
        presented_at: null,
        answer_status: 'waiting',
        answer_text: null,
        revision: 0,
        input_mode: 'text_fallback',
        answered_at: null,
      },
    ],
  };
  let recognition: ((result: Recognition) => void) | undefined;
  let asrError: (() => void) | undefined;
  const events: VoiceServerEvent[] = [];
  const answers: string[] = [],
    continuations: string[] = [],
    receipts: unknown[] = [];
  const speeches: { signal: AbortSignal; audio: (pcm: Uint8Array) => void; finish: () => void }[] =
    [];
  let closes = 0,
    audioBytes = 0,
    finishes = 0;
  const provider: VoiceProvider = {
    available: true,
    async recognize(text, error) {
      recognition = text;
      asrError = error;
      return {
        write: (pcm) => {
          audioBytes += pcm.byteLength;
        },
        finish: () => {
          finishes++;
        },
        close: () => {
          closes++;
        },
      };
    },
    speak(_text, signal, audio) {
      return new Promise<void>((resolve) => {
        speeches.push({ signal, audio, finish: resolve });
        signal.addEventListener('abort', () => resolve(), { once: true });
      });
    },
  };
  const copy = () => structuredClone(view);
  const service: VoiceInterviews = {
    async read(principal) {
      if (principal.owner_id !== 'voice-owner')
        throw new ServiceError('not_found', 404, '不可读取');
      return copy();
    },
    async answer(_identity, _id, turn, body) {
      if (view.turns.at(-1)?.id !== turn || view.generation_status === 'pending')
        throw new ServiceError('invalid_state', 409, '已更新');
      answers.push(body.text);
      const current = view.turns.at(-1)!;
      current.answer_status = 'answered';
      current.answer_text = body.text;
      current.input_mode = body.input_mode ?? 'text_fallback';
      current.revision++;
      view.generation_status = 'pending';
      view.version++;
      return copy();
    },
    async interruptVoice() {
      view.generation_status = 'idle';
      view.generation_id = null;
      view.version++;
      return copy();
    },
    async continueVoice(_identity, _id, _turn, body) {
      continuations.push(body.text);
      const current = view.turns.at(-1)!;
      current.answer_text += '\n' + body.text;
      current.revision++;
      view.generation_status = 'pending';
      view.version++;
      return copy();
    },
    async recordVoicePlayback(_identity, _id, _turn, value) {
      receipts.push(value);
    },
  };
  return {
    id: view.id,
    service,
    provider,
    events,
    answers,
    continuations,
    receipts,
    speeches,
    get view() {
      return copy();
    },
    setView(next: Interview) {
      view = next;
    },
    recognize(result: Recognition) {
      recognition?.(result);
    },
    failAsr() {
      asrError?.();
    },
    metrics: () => ({ closes, audioBytes, finishes }),
  };
}
export async function waitFor(check: () => boolean, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Condition did not complete');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
