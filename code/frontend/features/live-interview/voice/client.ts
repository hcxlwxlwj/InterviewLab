import type { VoiceClientEvent, VoiceServerEvent } from '@interviewlab/core';
import { apiVoiceSocket } from '../../../lib/api/http';
import { VoicePlayback } from './playback';
import {
  prepareVoiceDevices,
  resumeVoiceContext,
  voiceDeviceError,
  type PreparedVoiceDevices,
} from './devices';

export class RealtimeVoiceClient {
  private socket?: WebSocket;
  private context?: AudioContext;
  private media?: MediaStream;
  private capture?: AudioWorkletNode;
  private source?: MediaStreamAudioSourceNode;
  private playback?: VoicePlayback;
  private closed = false;
  private ready = false;
  private muted = false;
  private outputActive = false;
  private resumeCapture?: ReturnType<typeof setTimeout>;
  private aliveTimer?: ReturnType<typeof setInterval>;
  private timeout?: ReturnType<typeof setTimeout>;
  private captureTimeout?: ReturnType<typeof setTimeout>;
  private captured = false;
  private captureEpoch = 0;
  private readyEvent?: Extract<VoiceServerEvent, { type: 'ready' }>;
  private initialization?: Promise<void>;
  private preparation?: Promise<void>;
  private connection?: Promise<void>;
  private captureReady?: { resolve: () => void; reject: (error: Error) => void };
  private connectionReady?: { resolve: () => void; reject: (error: Error) => void };

  constructor(
    private readonly id: string,
    private readonly event: (event: VoiceServerEvent) => void,
    private readonly playing: (value: boolean) => void,
    private readonly disconnected: () => void,
    private readonly activity: (speaking: boolean) => void = () => {},
  ) {}
  /** Legacy callers still receive control before server/capture readiness events arrive. */
  async start(beforeConnect?: () => Promise<void>) {
    try {
      await this.initialize();
      await this.openSocket(beforeConnect);
    } catch (error) {
      this.stop();
      throw voiceDeviceError(error);
    }
  }
  /** Establish and verify local capture without sending microphone audio to the server. */
  prepare(devices?: PreparedVoiceDevices): Promise<void> {
    this.preparation ??= this.initialize(devices).then(async () => {
      if (this.closed) throw new Error('语音准备已取消。');
      if (this.captured) return;
      await new Promise<void>((resolve, reject) => {
        this.captureReady = { resolve, reject };
      });
    });
    return this.preparation;
  }
  /** Start the interview only after capture is usable, then await actual server readiness. */
  connect(beforeConnect?: () => Promise<void>): Promise<void> {
    this.connection ??= (async () => {
      try {
        await this.prepare();
        await this.openSocket(beforeConnect);
        if (this.closed) throw new Error('语音连接已取消。');
        if (this.ready && this.captured) return;
        await new Promise<void>((resolve, reject) => {
          this.connectionReady = { resolve, reject };
        });
      } catch (error) {
        this.stop();
        throw voiceDeviceError(error);
      }
    })();
    return this.connection;
  }
  private initialize(prepared?: PreparedVoiceDevices): Promise<void> {
    this.initialization ??= (async () => {
      try {
        const devices = prepared ?? (await prepareVoiceDevices(false));
        if (this.closed) {
          devices.media.getAudioTracks().forEach((track) => track.stop());
          void devices.context.close().catch(() => {});
          throw new Error('语音准备已取消。');
        }
        this.context = devices.context;
        this.media = devices.media;
        const microphone = this.media.getAudioTracks()[0];
        if (!microphone || microphone.readyState === 'ended')
          throw new Error('浏览器未提供可用麦克风音轨，请选择其他输入设备。');
        await resumeVoiceContext(this.context);
        if (this.closed) throw new Error('语音准备已取消。');
        if (this.context.state !== 'running')
          throw new Error('浏览器音频采集尚未启动，请重新开启语音。');
        await this.context.audioWorklet.addModule('/voice-capture.worklet.js');
        if (this.closed) throw new Error('语音准备已取消。');
        this.playback = new VoicePlayback(
          this.context,
          (id, playedMs, interrupted) =>
            this.send({ type: 'playback', speech_id: id, played_ms: playedMs, interrupted }),
          (playing) => this.onPlaybackState(playing),
        );
        this.capture = new AudioWorkletNode(this.context, 'interview-voice-capture');
        this.capture.onprocessorerror = () => this.fail('麦克风音频处理失败，请重新连接语音。');
        this.capture.port.onmessage = ({
          data,
        }: MessageEvent<
          ({ type: 'audio'; pcm: ArrayBuffer } | { type: 'speech_start' | 'speech_end' }) & {
            epoch?: number;
          }
        >) => {
          if (this.closed) return;
          if (data.epoch !== undefined && data.epoch !== this.captureEpoch) return;
          if (data.type === 'audio' && data.pcm instanceof ArrayBuffer && data.pcm.byteLength > 0) {
            this.captured = true;
            clearTimeout(this.captureTimeout);
            this.captureReady?.resolve();
            this.captureReady = undefined;
            this.publishReady();
          }
          const socket = this.socket;
          if (!this.ready || !socket || socket.readyState !== WebSocket.OPEN) return;
          if (data.type === 'audio') {
            if (socket.bufferedAmount > 128000) {
              this.fail('网络发送过慢，已关闭麦克风，文字草稿仍保留。');
              return;
            }
            socket.send(
              this.muted || this.outputActive ? new ArrayBuffer(data.pcm.byteLength) : data.pcm,
            );
          } else {
            if (this.muted || this.outputActive) return;
            this.activity(data.type === 'speech_start');
            this.send({ type: data.type });
          }
        };
        this.source = this.context.createMediaStreamSource(this.media);
        this.source.connect(this.capture);
        this.capture.connect(this.context.destination);
        this.captureTimeout = setTimeout(() => {
          if (!this.closed && !this.captured)
            this.fail('浏览器已授权，但没有产生麦克风音频。请更换输入设备后重新连接。');
        }, 5000);
        this.media.getAudioTracks().forEach((track) =>
          track.addEventListener('ended', () => {
            if (!this.closed) this.fail('麦克风已断开，文字草稿仍保留。');
          }),
        );
        this.context.onstatechange = () => {
          if (!this.closed && this.context?.state !== 'running')
            this.fail('浏览器音频采集已暂停，请重新开启语音。');
        };
      } catch (error) {
        this.stop();
        throw voiceDeviceError(error);
      }
    })();
    return this.initialization;
  }
  private async openSocket(beforeConnect?: () => Promise<void>) {
    if (this.closed || !this.context) throw new Error('语音准备已取消。');
    if (this.socket) return;
    if (this.context.state !== 'running') await resumeVoiceContext(this.context);
    if (this.closed || this.context.state !== 'running')
      throw new Error('浏览器音频尚未启动，请重试连接。');
    if (beforeConnect) await beforeConnect();
    if (this.closed) throw new Error('语音连接已取消。');
    const socket = (this.socket = apiVoiceSocket(`/interviews/${this.id}/voice`));
    this.timeout = setTimeout(() => this.fail('语音连接超时，请重试或使用文字。'), 15000);
    socket.onmessage = ({ data }) => {
      if (this.closed || typeof data !== 'string') return;
      try {
        const event = JSON.parse(data) as VoiceServerEvent;
        if (event.type === 'ready') {
          this.ready = true;
          clearTimeout(this.timeout);
          this.readyEvent = event;
          this.publishReady();
          return;
        }
        if (event.type === 'error' && !this.ready) {
          this.event(event);
          this.rejectPending(new Error(event.message));
          this.stop();
          this.disconnected();
          return;
        }
        if (event.type === 'speech_start') this.playback?.start(event.speech_id);
        if (event.type === 'audio') this.playback?.append(event.speech_id, event.pcm);
        if (event.type === 'speech_end') this.playback?.finish(event.speech_id);
        if (event.type === 'interrupted') this.playback?.interrupt(event.speech_id);
        if (event.type === 'submitting') {
          this.resetCapture();
          this.activity(false);
        }
        this.event(event);
      } catch {
        this.fail('语音数据异常，请重新连接或使用文字。');
      }
    };
    socket.onclose = () => {
      if (!this.closed) {
        this.rejectPending(new Error('语音连接已关闭，请重试连接。'));
        this.stop();
        this.disconnected();
      }
    };
    socket.onerror = () => this.fail('语音连接失败，请检查后端状态或重新连接。');
    this.aliveTimer = setInterval(() => this.send({ type: 'ping' }), 5000);
  }
  private rejectPending(error: Error) {
    this.captureReady?.reject(error);
    this.captureReady = undefined;
    this.connectionReady?.reject(error);
    this.connectionReady = undefined;
  }
  private publishReady() {
    if (this.readyEvent && this.captured) {
      const event = this.readyEvent;
      this.readyEvent = undefined;
      this.event(event);
      this.connectionReady?.resolve();
      this.connectionReady = undefined;
    }
  }
  send(event: VoiceClientEvent) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(event));
  }
  getOutputLevel() {
    return this.playback?.getLevel() ?? 0;
  }
  interrupt() {
    this.playback?.stop(true);
    this.send({ type: 'interrupt' });
  }
  private onPlaybackState(playing: boolean) {
    if (this.closed) return;
    clearTimeout(this.resumeCapture);
    if (playing) {
      this.outputActive = true;
      this.applyCaptureState();
      this.activity(false);
      this.playing(true);
    } else {
      // Network speech_end only seals the queue. This callback runs after local playback drains.
      // A short tail also excludes speaker echo and already queued capture messages.
      this.resumeCapture = setTimeout(() => {
        if (this.closed) return;
        this.outputActive = false;
        this.applyCaptureState();
        this.playing(false);
      }, 300);
    }
  }
  private applyCaptureState() {
    this.media?.getAudioTracks().forEach((track) => {
      track.enabled = !this.muted && !this.outputActive;
    });
    this.resetCapture();
  }
  private resetCapture() {
    this.capture?.port.postMessage({ type: 'reset', epoch: ++this.captureEpoch });
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyCaptureState();
    if (muted) {
      this.activity(false);
      this.send({ type: 'speech_end' });
    }
  }
  private fail(message: string) {
    if (this.closed) return;
    this.rejectPending(new Error(message));
    this.event({ type: 'error', code: 'voice_client_failed', message, retryable: true });
    this.stop();
    this.disconnected();
  }
  stop() {
    if (this.closed) return;
    this.closed = true;
    this.rejectPending(new Error('语音准备或连接已取消。'));
    this.ready = false;
    clearInterval(this.aliveTimer);
    clearTimeout(this.timeout);
    clearTimeout(this.captureTimeout);
    clearTimeout(this.resumeCapture);
    this.readyEvent = undefined;
    this.playback?.stop(true);
    this.socket?.close();
    if (this.capture) {
      this.capture.port.onmessage = null;
      this.capture.disconnect();
    }
    this.source?.disconnect();
    this.media?.getAudioTracks().forEach((track) => track.stop());
    void this.context?.close().catch(() => {});
  }
}
