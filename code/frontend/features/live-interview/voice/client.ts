import type { VoiceClientEvent, VoiceServerEvent } from '@interviewlab/core';
import { apiVoiceSocket } from '../../../lib/api/http';
import { VoicePlayback } from './playback';

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
  private aliveTimer?: ReturnType<typeof setInterval>;
  private timeout?: ReturnType<typeof setTimeout>;
  constructor(
    private readonly id: string,
    private readonly event: (event: VoiceServerEvent) => void,
    private readonly playing: (value: boolean) => void,
    private readonly disconnected: () => void,
    private readonly activity: (speaking: boolean) => void = () => {},
  ) {}
  async start() {
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        !window.AudioWorkletNode ||
        !window.isSecureContext
      )
        throw new Error(
          '当前浏览器无法使用实时语音，请使用新版 Chrome 并通过本机地址或 HTTPS 访问。',
        );
      // Resume in the user's click handler, before awaiting microphone permission.
      this.context = new AudioContext();
      await this.context.resume();
      this.media = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (this.closed) {
        this.media.getTracks().forEach((t) => t.stop());
        return;
      }
      await this.context.audioWorklet.addModule('/voice-capture.worklet.js');
      if (this.closed) return;
      this.playback = new VoicePlayback(
        this.context,
        (id, playedMs, interrupted) =>
          this.send({ type: 'playback', speech_id: id, played_ms: playedMs, interrupted }),
        this.playing,
      );
      this.capture = new AudioWorkletNode(this.context, 'interview-voice-capture');
      this.source = this.context.createMediaStreamSource(this.media);
      this.source.connect(this.capture);
      this.capture.connect(this.context.destination);
      const socket = (this.socket = apiVoiceSocket(`/interviews/${this.id}/voice`));
      this.capture.port.onmessage = ({
        data,
      }: MessageEvent<
        { type: 'audio'; pcm: ArrayBuffer } | { type: 'speech_start' | 'speech_end' }
      >) => {
        if (!this.ready || socket.readyState !== WebSocket.OPEN) return;
        if (data.type === 'audio') {
          if (socket.bufferedAmount > 128000) {
            this.fail('网络发送过慢，已关闭麦克风，文字草稿仍保留。');
            return;
          }
          socket.send(this.muted ? new ArrayBuffer(data.pcm.byteLength) : data.pcm);
        } else {
          if (this.muted) return;
          this.activity(data.type === 'speech_start');
          if (data.type === 'speech_start') this.playback?.stop(true);
          this.send({ type: data.type });
        }
      };
      this.timeout = setTimeout(() => this.fail('语音连接超时，请重试或使用文字。'), 15000);
      socket.onmessage = ({ data }) => {
        if (this.closed || typeof data !== 'string') return;
        try {
          const event = JSON.parse(data) as VoiceServerEvent;
          if (event.type === 'ready') {
            this.ready = true;
            clearTimeout(this.timeout);
          }
          if (event.type === 'speech_start') this.playback?.start(event.speech_id);
          if (event.type === 'audio') this.playback?.append(event.speech_id, event.pcm);
          if (event.type === 'speech_end') this.playback?.finish(event.speech_id);
          if (event.type === 'interrupted') this.playback?.interrupt(event.speech_id);
          this.event(event);
        } catch {
          this.fail('语音数据异常，请重新连接或使用文字。');
        }
      };
      socket.onclose = () => {
        if (!this.closed) {
          this.stop();
          this.disconnected();
        }
      };
      socket.onerror = () => this.fail('语音连接失败，请检查后端状态或重新连接。');
      this.aliveTimer = setInterval(() => this.send({ type: 'ping' }), 5000);
      this.media.getAudioTracks().forEach((track) =>
        track.addEventListener('ended', () => {
          if (!this.closed) this.fail('麦克风已断开，文字草稿仍保留。');
        }),
      );
    } catch (error) {
      this.stop();
      if (error instanceof DOMException && error.name === 'NotAllowedError')
        throw new Error('未获得麦克风权限，请在浏览器地址栏允许麦克风后重试。');
      throw error instanceof Error ? error : new Error('无法启动麦克风。');
    }
  }
  send(event: VoiceClientEvent) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(event));
  }
  interrupt() {
    this.playback?.stop(true);
    this.send({ type: 'interrupt' });
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    this.media?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    if (muted) {
      this.activity(false);
      this.send({ type: 'speech_end' });
    }
  }
  private fail(message: string) {
    if (this.closed) return;
    this.event({ type: 'error', code: 'voice_client_failed', message, retryable: true });
    this.stop();
    this.disconnected();
  }
  stop() {
    if (this.closed) return;
    this.closed = true;
    this.ready = false;
    clearInterval(this.aliveTimer);
    clearTimeout(this.timeout);
    this.playback?.stop(true);
    this.socket?.close();
    if (this.capture) {
      this.capture.port.onmessage = null;
      this.capture.disconnect();
    }
    this.source?.disconnect();
    this.media?.getTracks().forEach((track) => track.stop());
    void this.context?.close().catch(() => {});
  }
}
