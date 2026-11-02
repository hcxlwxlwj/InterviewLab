'use client';
import {
  Mic,
  MicOff,
  Keyboard,
  PhoneOff,
  Volume2,
  Hand,
  CircleStop,
  ArrowUp,
  MessageSquare,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { useInterviewVoice } from './use-voice';

export function VoiceControls({
  voice,
  disabled,
  preferred = false,
}: {
  voice: ReturnType<typeof useInterviewVoice>;
  disabled: boolean;
  preferred?: boolean;
}) {
  if (!voice.display)
    return (
      <section className="voice-controls" aria-label="实时语音面试">
        <div className="voice-heading">
          <div>
            <strong>
              <Mic size={17} />
              实时语音
            </strong>
            <p>像打电话一样交流，可以随时插话。</p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={disabled || !voice.capabilities?.available}
            onClick={() => void voice.start()}
          >
            <Mic size={15} />
            开启实时语音
          </Button>
        </div>
        {voice.capabilities?.reason && <p className="field-help">{voice.capabilities.reason}</p>}
        {voice.error && (
          <p className="error-inline" role="alert">
            {voice.error}
          </p>
        )}
      </section>
    );
  const ended = voice.sessionStatus === 'completed' || voice.sessionStatus === 'failed';
  const state = ended
    ? 'ended'
    : voice.connecting
      ? 'connecting'
      : !voice.active
        ? 'idle'
        : voice.muted
          ? 'muted'
          : voice.hold
            ? 'hold'
            : voice.playing
              ? 'speaking'
              : voice.talking
                ? 'hearing'
                : voice.thinking
                  ? 'thinking'
                  : 'listening';
  const labels = {
    ended: '本场通话已结束',
    connecting: '正在连接…',
    idle: voice.sessionStatus === 'ready' ? '准备好，就开始聊吧' : '语音通话待连接',
    muted: '麦克风已静音',
    hold: '慢慢想，我在这里',
    speaking: '面试官正在说话',
    hearing: '正在听你说',
    thinking: '正在思考你的回答',
    listening: '我在听，你可以直接说话',
  };
  const silence = Math.round((voice.capabilities?.silence_ms ?? 3000) / 1000);
  return (
    <section className={`voice-call voice-call-${state}`} aria-label="语音通话">
      <div className="voice-call-topline">
        <span className="voice-call-tag">
          <span />
          {voice.active ? '通话中' : ended ? '通话已结束' : '语音面试'}
        </span>
        <span>AI 面试官</span>
      </div>
      <div className="voice-call-center">
        <div className="voice-orb-scene" aria-hidden="true">
          <div className="voice-orb-halo" />
          <div className="voice-orb">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="voice-call-wave" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
        <h2 role="status" aria-live="polite">
          {labels[state]}
        </h2>
        <p>
          {voice.active
            ? voice.muted
              ? '取消静音后继续说话'
              : voice.hold
                ? '准备好后点一下“继续接话”'
                : voice.playing
                  ? '直接开口，就能打断我'
                  : voice.thinking
                    ? '想到新的内容，也可以继续补充'
                    : `说完停顿约 ${silence} 秒，我会接着问`
            : ended
              ? '已提交的讲话内容保存在面试记录中'
              : preferred
                ? '开始面试后，开启麦克风进入通话'
                : '开启麦克风，直接说出你的回答'}
        </p>
      </div>
      {voice.error && (
        <p className="voice-call-error" role="alert">
          {voice.error}
        </p>
      )}
      {!voice.active && !ended && (
        <>
          <Button
            type="button"
            disabled={disabled || !voice.capabilities?.available}
            onClick={() => void voice.start()}
          >
            <Mic size={17} />
            开启实时语音
          </Button>
          <p className="voice-call-consent">
            开启后请求麦克风权限，音频实时发送至火山引擎识别。本站保存转写，不保存原始录音。
          </p>
          {voice.capabilities?.reason && <p className="field-help">{voice.capabilities.reason}</p>}
        </>
      )}
      {voice.active && (
        <div className="voice-call-buttons">
          <button
            type="button"
            className={`voice-round-button ${voice.muted ? 'is-muted' : ''}`}
            disabled={voice.connecting}
            onClick={voice.toggleMute}
            aria-label={voice.muted ? '取消静音' : '静音麦克风'}
            aria-pressed={voice.muted}
          >
            {voice.muted ? <MicOff /> : <Mic />}
            <span>{voice.muted ? '取消静音' : '静音'}</span>
          </button>
          <button
            type="button"
            className="voice-round-button"
            disabled={voice.connecting}
            onClick={voice.toggleHold}
            aria-label={voice.hold ? '继续自动接话' : '让我想想'}
            aria-pressed={voice.hold}
          >
            <Hand />
            <span>{voice.hold ? '继续接话' : '让我想想'}</span>
          </button>
          <button
            type="button"
            className="voice-round-button voice-hangup"
            onClick={voice.stop}
            aria-label="挂断语音，保留面试和记录"
          >
            <PhoneOff />
            <span>挂断语音</span>
          </button>
        </div>
      )}
      <div className="voice-call-secondary">
        {voice.active && (
          <>
            <button
              type="button"
              disabled={voice.connecting || !voice.draft.trim()}
              onClick={voice.commit}
            >
              <ArrowUp size={14} />
              我说完了
            </button>
            <button type="button" disabled={!voice.playing} onClick={voice.interrupt}>
              <CircleStop size={14} />
              停止播报
            </button>
            <button
              type="button"
              disabled={voice.connecting || voice.thinking}
              onClick={voice.repeat}
            >
              <Volume2 size={14} />
              重听
            </button>
          </>
        )}
        <button type="button" onClick={voice.switchToText}>
          <Keyboard size={14} />
          切回文字
        </button>
      </div>
      <p className="voice-call-save">
        {voice.active ? '讲话会自动转写保存，无需逐条点击发送' : '语音与文字共用同一份面试记录'}
      </p>
      <details className="voice-call-transcript">
        <summary>
          <MessageSquare size={14} />
          查看对话记录
        </summary>
        <div>
          {voice.turns.map((turn) => (
            <div key={turn.id}>
              <small>面试官</small>
              <p>{turn.text}</p>
              {turn.answer_text && (
                <>
                  <small>我 · 已保存</small>
                  <p>{turn.answer_text}</p>
                </>
              )}
            </div>
          ))}
          {voice.draft && (
            <div>
              <small>我 · 尚未提交</small>
              <p>{voice.draft}</p>
            </div>
          )}
          {!voice.turns.length && <p>开始面试后，这里会保留对话记录。</p>}
        </div>
      </details>
    </section>
  );
}
