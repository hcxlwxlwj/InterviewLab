import { randomUUID } from 'node:crypto';
import type {
  Interview,
  RequestIdentity,
  VoiceClientEvent,
  VoiceServerEvent,
} from '@interviewlab/core';
import { INTERVIEW_MAX_ANSWER } from '@interviewlab/core';
import type { LiveInterviewsService } from '../service';
import { ServiceError } from '../../../foundation/errors';
import type { AsrStream, VoiceProvider } from './volcengine';

export type VoiceInterviews = Pick<
  LiveInterviewsService,
  'read' | 'answer' | 'interruptVoice' | 'continueVoice' | 'recordVoicePlayback'
>;
/** One transport session, one authoritative interview service. No audio is persisted. */
export class InterviewVoiceSession {
  private view!: Interview;
  private asr?: AsrStream;
  private asrEpoch = 0;
  private pendingAudio: Uint8Array[] = [];
  private pendingBytes = 0;
  private closed = false;
  private initialized = false;
  private queued = 0;
  private chain = Promise.resolve();
  private poll?: ReturnType<typeof setInterval>;
  private timer?: ReturnType<typeof setTimeout>;
  private expire?: ReturnType<typeof setTimeout>;
  private speech?: { id: string; turn: string; controller: AbortController };
  private playback = new Map<string, string>();
  private spoken = new Set<string>();
  private text = '';
  private final = false;
  private talking = false;
  private hold = false;
  private manual = false;
  private flushing = false;
  private recognitionPrefix = '';
  private lastAudioVoiceAt = 0;
  private activityRevision = 0;
  private stoppedAt = 0;
  private changedAt = 0;
  private interruptedTurn: string | null = null;
  private capturedTurn: string | null = null;
  private checking = false;
  private lastAuth = 0;
  private initialOwner = '';
  constructor(
    private readonly id: string,
    private readonly identity: () => Promise<RequestIdentity>,
    private readonly service: VoiceInterviews,
    private readonly provider: VoiceProvider,
    private readonly silenceMs: number,
    private readonly send: (event: VoiceServerEvent) => void,
    private readonly disconnect: () => void,
  ) {}
  private enqueue(work: () => Promise<void>) {
    if (this.closed) return;
    if (++this.queued > 64) {
      this.send({
        type: 'error',
        code: 'voice_backpressure',
        message: '语音处理积压，草稿仍保留，请稍后重新连接。',
        retryable: true,
      });
      this.close();
      this.disconnect();
      return;
    }
    this.chain = this.chain
      .then(async () => {
        if (!this.closed) await work();
      })
      .catch((error) => {
        if (this.closed) return;
        const safe = error instanceof ServiceError;
        this.send({
          type: 'error',
          code: safe ? error.code : 'voice_unavailable',
          message: safe ? error.message : '语音连接中断，草稿仍保留，请重新连接或使用文字。',
          retryable: true,
        });
        this.close();
        this.disconnect();
      })
      .finally(() => {
        this.queued--;
      });
  }
  async start() {
    const identity = await this.identity();
    this.initialOwner = identity.owner_id;
    this.view = await this.service.read(identity, this.id);
    if (this.view.status !== 'in_progress')
      throw new ServiceError('invalid_state', 409, '请先开始或继续面试，再开启实时语音。');
    if (
      this.view.generation_status === 'idle' &&
      this.view.turns.at(-1)?.answer_status === 'answered'
    )
      this.interruptedTurn = this.view.turns.at(-1)!.id;
    await this.resetRecognition();
    if (this.closed) return;
    this.initialized = true;
    this.send({ type: 'ready', silence_ms: this.silenceMs });
    this.publish(this.view, true);
    this.poll = setInterval(() => {
      if (this.checking || this.closed) return;
      this.checking = true;
      this.enqueue(async () => {
        try {
          let identity: RequestIdentity = { owner_id: this.initialOwner, roles: [] };
          if (Date.now() - this.lastAuth > 5000) {
            identity = await this.identity();
            this.lastAuth = Date.now();
            if (identity.owner_id !== this.initialOwner)
              throw new ServiceError('unauthorized', 401, '登录状态已变化，请重新登录。');
          }
          this.publish(await this.service.read(identity, this.id));
        } finally {
          this.checking = false;
        }
      });
    }, 500);
    this.expire = setTimeout(
      () => {
        this.close();
        this.disconnect();
      },
      12 * 60 * 1000,
    );
  }
  audio(pcm: Uint8Array) {
    if (!this.initialized) return;
    if (this.closed || !['ready', 'in_progress'].includes(this.view?.status)) return;
    if (!pcm.byteLength || pcm.byteLength > 12800 || pcm.byteLength % 2) {
      this.protocolError();
      return;
    }
    if (this.speech) {
      // ASR rejects a stream with no audio packets (45000081). Keep its clock alive
      // without forwarding microphone samples or treating echo as candidate speech.
      this.asr?.write(new Uint8Array(pcm.byteLength));
      return;
    }
    const samples = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    let power = 0;
    for (let i = 0; i < pcm.byteLength; i += 2) power += (samples.getInt16(i, true) / 32768) ** 2;
    if (Math.sqrt(power / (pcm.byteLength / 2)) > 0.018) this.lastAudioVoiceAt = Date.now();
    else if (this.talking && Date.now() - this.lastAudioVoiceAt > 800) {
      // Recover if a browser VAD speech_end notification is lost.
      this.talking = false;
      this.stoppedAt = this.lastAudioVoiceAt;
      this.arm();
    }
    if (this.asr) this.asr.write(pcm);
    else {
      this.pendingBytes += pcm.byteLength;
      if (this.pendingBytes > 128000) {
        this.protocolError();
        return;
      }
      this.pendingAudio.push(pcm);
    }
  }
  private protocolError() {
    this.send({
      type: 'error',
      code: 'voice_input_invalid',
      message: '音频传输异常，请重新连接语音。',
      retryable: true,
    });
    this.close();
    this.disconnect();
  }
  control(event: VoiceClientEvent) {
    if (!this.initialized || this.closed) return;
    if (this.speech && ['speech_start', 'speech_end', 'commit'].includes(event.type)) return;
    const resumeFlushed = event.type === 'speech_start' && this.flushing;
    const activityRevision = ['speech_start', 'speech_end'].includes(event.type)
      ? ++this.activityRevision
      : this.activityRevision;
    if (event.type === 'speech_start') {
      // Invalidate an already queued endpoint BEFORE any asynchronous DB work.
      this.talking = true;
      this.lastAudioVoiceAt = Date.now();
      this.manual = false;
      clearTimeout(this.timer);
      if (resumeFlushed) {
        ++this.asrEpoch;
        this.asr?.close();
        this.asr = undefined;
        this.flushing = false;
      }
    }
    if (event.type === 'speech_start' || event.type === 'interrupt') this.stopSpeech();
    this.enqueue(async () => {
      if (this.speech && ['speech_start', 'speech_end', 'commit'].includes(event.type)) return;
      if (event.type === 'ping') return;
      if (event.type === 'playback') {
        const turn = this.playback.get(event.speech_id);
        if (turn) {
          this.playback.delete(event.speech_id);
          if (this.speech?.id === event.speech_id) {
            this.speech.controller.abort();
            this.speech = undefined;
            this.talking = false;
            this.final = false;
            this.manual = false;
            clearTimeout(this.timer);
            await this.resetRecognition();
          }
          await this.service.recordVoicePlayback(await this.identity(), this.id, turn, {
            speech_id: event.speech_id,
            played_ms: event.played_ms,
            interrupted: event.interrupted,
          });
        }
        return;
      }
      if (event.type === 'repeat') {
        this.say(true);
        return;
      }
      if (event.type === 'hold') {
        this.hold = event.enabled;
        this.arm();
        return;
      }
      if (event.type === 'speech_start') {
        if (resumeFlushed) await this.resetRecognition(true, true);
        this.publish(await this.service.read(await this.identity(), this.id));
        if (
          this.view.generation_status === 'pending' &&
          this.view.turns.at(-1)?.answer_status === 'answered'
        ) {
          try {
            const next = await this.service.interruptVoice(
              await this.identity(),
              this.id,
              { version: this.view.version },
              randomUUID(),
            );
            this.interruptedTurn = next.turns.at(-1)!.id;
            this.publish(next);
          } catch (e) {
            if (!(e instanceof ServiceError && e.statusCode === 409)) throw e;
            this.publish(await this.service.read(await this.identity(), this.id));
          }
        }
      } else if (event.type === 'speech_end') {
        if (activityRevision !== this.activityRevision) return;
        this.talking = false;
        this.stoppedAt = Date.now();
        this.arm();
      } else if (event.type === 'commit') {
        this.manual = true;
        this.hold = false;
        this.talking = false;
        this.flushing = true;
        this.asr?.finish();
        // Await the recognizer's final packet, rather than committing an unstable partial.
        clearTimeout(this.timer);
        this.timer = setTimeout(
          () =>
            this.enqueue(async () => {
              if (this.manual)
                throw new ServiceError(
                  'voice_final_timeout',
                  504,
                  '暂未收到最终转写，草稿已保留，请切回文字确认后提交。',
                  true,
                );
            }),
          8000,
        );
      }
    });
  }
  private arm() {
    clearTimeout(this.timer);
    if (
      this.closed ||
      this.speech ||
      this.talking ||
      this.hold ||
      this.manual ||
      (!this.text && !this.interruptedTurn)
    )
      return;
    // ASR final means a sentence boundary, not necessarily the end of an answer.
    const unfinished =
      /(?:然后|因为|所以|但是|比如|首先|其次|以及|还有|我想|让我想想)[，,。.!！?？\s]*$/.test(
        this.text,
      );
    const delay = unfinished ? Math.max(this.silenceMs, 4500) : this.silenceMs;
    const remaining = Math.max(10, delay - (Date.now() - Math.max(this.stoppedAt, this.changedAt)));
    this.timer = setTimeout(
      () =>
        this.enqueue(async () => {
          if (this.closed || this.talking || this.hold || this.manual) return;
          if (Date.now() - Math.max(this.stoppedAt, this.changedAt) < delay) {
            this.arm();
            return;
          }
          if (!this.final && this.text) {
            if (!this.flushing) {
              this.flushing = true;
              this.manual = true;
              this.asr?.finish();
            }
            this.armAfterFinalWait();
            return;
          }
          await this.submit();
        }),
      remaining,
    );
  }
  private armAfterFinalWait() {
    if (Date.now() - this.changedAt > 8000) {
      this.send({
        type: 'error',
        code: 'voice_final_pending',
        message: '正在等待最终识别，可点击“我说完了”，或切回文字确认草稿。',
        retryable: true,
      });
      this.manual = false;
      return;
    }
    this.timer = setTimeout(
      () =>
        this.enqueue(async () => {
          if (this.final) await this.submit();
          else this.armAfterFinalWait();
        }),
      300,
    );
  }
  private async resetRecognition(preserveText = false, keepBuffered = false) {
    this.recognitionPrefix = preserveText ? this.text : '';
    this.flushing = false;
    const epoch = ++this.asrEpoch;
    this.asr?.close();
    this.asr = undefined;
    if (!keepBuffered) {
      this.pendingAudio = [];
      this.pendingBytes = 0;
    }
    const stream = await this.provider.recognize(
      (result) => {
        if (this.closed || this.speech || epoch !== this.asrEpoch) return;
        this.enqueue(async () => {
          if (this.speech || epoch !== this.asrEpoch) return;
          const completeText = [this.recognitionPrefix, result.text].filter(Boolean).join('');
          const done =
            result.final && /(?:回答结束|我的回答完毕|我说完了)[。！!，,\s]*$/.test(completeText);
          const recognizedText = done
            ? completeText.replace(/(?:回答结束|我的回答完毕|我说完了)[。！!，,\s]*$/, '').trim()
            : completeText;
          result = { ...result, text: recognizedText };
          if (result.text.length > INTERVIEW_MAX_ANSWER)
            throw new ServiceError(
              'unsupported_input',
              400,
              '语音回答已超过字数上限，草稿已保留，请使用文字缩短后提交。',
            );
          // Quiet speech may be recognized even if the local energy VAD did not fire.
          if (
            result.text.trim() &&
            this.view.generation_status === 'pending' &&
            this.view.turns.at(-1)?.answer_status === 'answered'
          ) {
            try {
              const next = await this.service.interruptVoice(
                await this.identity(),
                this.id,
                { version: this.view.version },
                randomUUID(),
              );
              this.interruptedTurn = next.turns.at(-1)!.id;
              this.publish(next);
            } catch (error) {
              if (!(error instanceof ServiceError && error.statusCode === 409)) throw error;
              this.publish(await this.service.read(await this.identity(), this.id));
            }
          }
          const unchanged = this.text === result.text;
          if (!unchanged) this.changedAt = Date.now();
          if (result.text.trim() && !this.capturedTurn)
            this.capturedTurn = this.view.turns.at(-1)?.id ?? null;
          this.text = result.text;
          this.final = unchanged ? this.final || result.final : result.final;
          if (this.text.trim()) this.stopSpeech();
          this.send({
            type: 'transcript',
            text: this.text,
            final: result.final,
            turn_id: this.view?.turns.at(-1)?.id ?? null,
          });
          if (done) {
            this.talking = false;
            this.hold = false;
            this.manual = true;
          }
          if (this.manual) {
            if (result.final) {
              clearTimeout(this.timer);
              this.manual = false;
              await this.submit();
            }
          } else this.arm();
        });
      },
      () => {
        if (epoch === this.asrEpoch)
          this.enqueue(async () => {
            throw new ServiceError(
              'voice_asr_failed',
              502,
              '语音识别连接失败，草稿已保留，请重新连接或使用文字。',
              true,
            );
          });
      },
    );
    if (this.closed || epoch !== this.asrEpoch) {
      stream.close();
      return;
    }
    this.asr = stream;
    for (const chunk of this.pendingAudio) stream.write(chunk);
    this.pendingAudio = [];
    this.pendingBytes = 0;
  }
  private async submit() {
    clearTimeout(this.timer);
    if (this.talking || this.hold || this.closed || this.speech) return;
    const text = this.text.trim();
    if (!text && !this.interruptedTurn) {
      await this.resetRecognition();
      this.send({ type: 'status', state: 'listening' });
      return;
    }
    const principal = await this.identity();
    const current = await this.service.read(principal, this.id);
    if (this.talking || this.hold || this.closed || this.speech) return;
    const turn = current.turns.at(-1);
    if (current.status !== 'in_progress' || !turn) return;
    if (this.capturedTurn && this.capturedTurn !== turn.id)
      throw new ServiceError(
        'voice_turn_changed',
        409,
        '当前问题已在其他页面更新，语音草稿仍保留，请先确认内容再继续。',
      );
    if (current.generation_status === 'pending') return;
    if (!this.interruptedTurn && turn.answer_status !== 'waiting') return;
    this.send({ type: 'submitting', text, turn_id: turn.id });
    const next = this.interruptedTurn
      ? await this.service.continueVoice(
          principal,
          this.id,
          this.interruptedTurn,
          { version: current.version, text },
          randomUUID(),
        )
      : await this.service.answer(
          principal,
          this.id,
          turn.id,
          { version: current.version, text, input_mode: 'voice' },
          randomUUID(),
        );
    this.text = '';
    this.recognitionPrefix = '';
    this.final = false;
    this.interruptedTurn = null;
    this.capturedTurn = null;
    this.publish(next, true);
    if (next.status === 'in_progress') await this.resetRecognition();
  }
  private publish(next: Interview, force = false) {
    const changed = force || this.view?.version !== next.version;
    this.view = next;
    if (changed) this.send({ type: 'interview', interview: next });
    if (next.status !== 'in_progress' && next.status !== 'ready') {
      this.stopSpeech();
      this.send({ type: 'status', state: next.status === 'paused' ? 'paused' : 'closed' });
      this.close();
      this.disconnect();
      return;
    }
    if (changed) {
      this.send({
        type: 'status',
        state: next.generation_status === 'pending' ? 'thinking' : 'listening',
      });
      this.say();
    }
  }
  private say(repeat = false) {
    const turn = this.view.turns.at(-1);
    if (
      !turn ||
      turn.answer_status !== 'waiting' ||
      this.view.status !== 'in_progress' ||
      this.view.generation_status === 'pending' ||
      this.talking ||
      this.text
    )
      return;
    const text =
      this.view.clarification || [turn.acknowledgement, turn.text].filter(Boolean).join(' ');
    const key = `${turn.id}:${text}`;
    if (!repeat && this.spoken.has(key)) return;
    this.spoken.add(key);
    this.stopSpeech();
    const id = randomUUID(),
      controller = new AbortController();
    this.speech = { id, turn: turn.id, controller };
    this.playback.set(id, turn.id);
    if (this.playback.size > 12) this.playback.delete(this.playback.keys().next().value!);
    this.send({ type: 'speech_start', speech_id: id, turn_id: turn.id, text });
    void this.provider
      .speak(text, controller.signal, (pcm) => {
        if (!this.closed && !controller.signal.aborted && this.speech?.id === id)
          this.send({ type: 'audio', speech_id: id, pcm: Buffer.from(pcm).toString('base64') });
      })
      .then(() => {
        if (!this.closed && !controller.signal.aborted && this.speech?.id === id)
          this.send({ type: 'speech_end', speech_id: id });
      })
      .catch(() => {
        if (!this.closed && !controller.signal.aborted) {
          this.stopSpeech();
          this.send({
            type: 'error',
            code: 'voice_tts_failed',
            message: '语音播报失败，题目已保留在页面，可继续回答或切回文字。',
            retryable: true,
          });
        }
      });
  }
  private stopSpeech() {
    const speech = this.speech;
    this.speech = undefined;
    speech?.controller.abort();
    if (speech) this.send({ type: 'interrupted', speech_id: speech.id });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.poll);
    clearTimeout(this.timer);
    clearTimeout(this.expire);
    ++this.asrEpoch;
    this.asr?.close();
    this.asr = undefined;
    this.pendingAudio = [];
    this.speech?.controller.abort();
    this.speech = undefined;
  }
}
