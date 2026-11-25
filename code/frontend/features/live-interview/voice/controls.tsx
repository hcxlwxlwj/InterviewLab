'use client';
import { useState } from 'react';
import { Mic, MicOff, Keyboard, Hand, MessageSquare } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { useInterviewVoice } from './use-voice';
import { callState, callHint, callLabel, type VoiceState } from './call-presentation';

async function copySupplement(text: string, onStatus: (message: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    onStatus('已复制补充内容。');
  } catch {
    onStatus('暂时无法复制，可选中上方文字手动复制。');
  }
}

export function VoiceDraftRecovery({
  voice,
}: {
  voice: Pick<ReturnType<typeof useInterviewVoice>, 'supplements' | 'dismissSupplement'>;
}) {
  const [copyStatus, setCopyStatus] = useState('');
  if (!voice.supplements?.length) return null;
  return (
    <section className="voice-call-error" aria-label="未提交的语音补充">
      <strong>有补充内容尚未提交</strong>
      <p>这段内容未加入当前回答，可先复制保存。</p>
      {voice.supplements.map((supplement) => (
        <div key={supplement.turn_id ?? 'unassigned'}>
          {supplement.question && <p>对应问题：{supplement.question}</p>}
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{supplement.text}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copySupplement(supplement.text, setCopyStatus)}
          >
            复制补充
          </Button>{' '}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => voice.dismissSupplement(supplement.turn_id)}
          >
            关闭补充提示
          </Button>
        </div>
      ))}
      <p role="status">{copyStatus}</p>
    </section>
  );
}

type VoiceControlsProps = { voice: VoiceState; disabled: boolean; preferred?: boolean };

function VoiceCallNotices({ voice, className }: { voice: VoiceState; className: string }) {
  return (
    <>
      {voice.error && (
        <p className={className} role="alert">
          {voice.error}
        </p>
      )}
      <VoiceDraftRecovery voice={voice} />
    </>
  );
}

function VoicePreview({ voice, disabled }: VoiceControlsProps) {
  return (
    <section className="voice-controls" aria-label="实时语音面试">
      <div className="voice-heading">
        <div>
          <strong>
            <Mic size={17} />
            实时语音
          </strong>
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
      <VoiceCallNotices voice={voice} className="error-inline" />
    </section>
  );
}

function VoiceCallHeading({
  voice,
  state,
  ended,
  preferred,
}: {
  voice: VoiceState;
  state: ReturnType<typeof callState>;
  ended: boolean;
  preferred: boolean;
}) {
  return (
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
        {callLabel(voice, state)}
      </h2>
      <p>{callHint(voice, ended, preferred)}</p>
    </div>
  );
}

function VoiceConnection({ voice, disabled }: VoiceControlsProps) {
  return (
    <>
      {voice.sessionStatus !== 'ready' && (
        <Button
          type="button"
          disabled={disabled || !voice.capabilities?.available}
          onClick={() => void voice.start()}
        >
          <Mic size={17} />
          连接语音
        </Button>
      )}
      <p className="voice-call-consent">
        开始语音面试时请求麦克风权限，音频实时发送至火山引擎识别。本站保存转写，不保存原始录音。
      </p>
      {voice.capabilities?.reason && <p className="field-help">{voice.capabilities.reason}</p>}
    </>
  );
}

function VoiceCallButtons({ voice }: { voice: VoiceState }) {
  return (
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
    </div>
  );
}

function VoiceCallSecondary({ voice }: { voice: VoiceState }) {
  return (
    <div className="voice-call-secondary">
      <button type="button" onClick={voice.switchToText}>
        <Keyboard size={14} />
        切回文字
      </button>
    </div>
  );
}

function VoiceTranscript({ voice }: { voice: VoiceState }) {
  return (
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
  );
}

export function VoiceControls({ voice, disabled, preferred = false }: VoiceControlsProps) {
  if (!voice.display) return <VoicePreview voice={voice} disabled={disabled} />;
  const ended = voice.sessionStatus === 'completed' || voice.sessionStatus === 'failed';
  const state = callState(voice, ended);
  return (
    <section className={`voice-call voice-call-${state}`} aria-label="语音通话">
      <div className="voice-call-topline">
        <span className="voice-call-tag">
          <span />
          {voice.active ? '通话中' : ended ? '通话已结束' : '语音面试'}
        </span>
        <span>AI 面试官</span>
      </div>
      <VoiceCallHeading voice={voice} state={state} ended={ended} preferred={preferred} />
      <VoiceCallNotices voice={voice} className="voice-call-error" />
      {!voice.active && !ended && <VoiceConnection voice={voice} disabled={disabled} />}
      {voice.active && <VoiceCallButtons voice={voice} />}
      <VoiceCallSecondary voice={voice} />
      <VoiceTranscript voice={voice} />
    </section>
  );
}
