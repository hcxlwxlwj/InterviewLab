'use client';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import Link from 'next/link';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Pause,
  Play,
  ArrowUp,
  Bot,
  Hand,
} from 'lucide-react';
import type { InterviewWorkspace } from '../../components/interview-workspace';
import type { useInterviewVoice } from '../live-interview/voice/use-voice';
import { VoiceDraftRecovery } from '../live-interview/voice/controls';
import { formatTime } from '../../components/shared';
import { MediaPreview } from './media-preview';
import { InterviewerAvatar } from './interviewer-avatar';

type Props = ComponentProps<typeof InterviewWorkspace> & {
  voice: ReturnType<typeof useInterviewVoice>;
  initialCamera?: MediaStream | null;
  onCameraChange?: (camera: MediaStream | null) => void;
};
function useLocalMedia(
  initialCamera?: MediaStream | null,
  onCameraChange?: (camera: MediaStream | null) => void,
) {
  const [camera, setCamera] = useState<MediaStream | null>(initialCamera ?? null);
  const [screen, setScreen] = useState<MediaStream | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const streams = useRef<{ camera: MediaStream | null; screen: MediaStream | null }>({
    camera: initialCamera ?? null,
    screen: null,
  });
  const epochs = useRef({ camera: 0, screen: 0 });
  const alive = useRef(true);
  function stop(kind: 'camera' | 'screen') {
    epochs.current[kind]++;
    streams.current[kind]?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    streams.current[kind] = null;
    if (kind === 'camera') onCameraChange?.(null);
    if (alive.current) (kind === 'camera' ? setCamera : setScreen)(null);
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (!onCameraChange) stop('camera');
      stop('screen');
    };
  }, []);
  useEffect(() => {
    if (!onCameraChange) return;
    streams.current.camera = initialCamera ?? null;
    setCamera(initialCamera ?? null);
  }, [initialCamera]);
  async function toggle(kind: 'camera' | 'screen') {
    if (streams.current[kind]) {
      stop(kind);
      return;
    }
    const epoch = ++epochs.current[kind];
    setBusy(kind);
    setError('');
    try {
      if (!navigator.mediaDevices) throw new Error();
      const stream =
        kind === 'camera'
          ? await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
              audio: false,
            })
          : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      if (!alive.current || epoch !== epochs.current[kind]) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streams.current[kind] = stream;
      if (kind === 'camera') onCameraChange?.(stream);
      (kind === 'camera' ? setCamera : setScreen)(stream);
      stream.getVideoTracks().forEach((t) => {
        t.onended = () => stop(kind);
      });
    } catch {
      if (alive.current)
        setError(
          kind === 'camera'
            ? '摄像头未开启，请检查浏览器权限和设备占用后重试。'
            : '屏幕共享已取消或未获授权，可重新选择一个窗口。',
        );
    } finally {
      if (alive.current) setBusy('');
    }
  }
  return { camera, screen, busy, error, toggle, stop };
}
export function VideoInterviewWorkspace(p: Props) {
  const media = useLocalMedia(p.initialCamera, p.onCameraChange);
  const log = useRef<HTMLDivElement>(null);
  const last = p.turns.at(-1);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [last?.id, last?.status, p.draft]);
  useEffect(() => {
    if (p.ended) {
      media.stop('camera');
      media.stop('screen');
    }
  }, [p.ended]);
  return (
    <div className="video-room">
      <header className="video-room-header">
        <div className="video-room-title">
          <span className="video-room-mark">
            <Bot size={20} />
          </span>
          <div>
            <strong>
              {p.typeLabel} · {p.jobTitle}
            </strong>
            <small>独立视频面试房间</small>
          </div>
        </div>
        <div className="video-room-header-actions">
          <span>
            {formatTime(p.seconds)} / {p.durationMinutes}:00
          </span>
          <Link href="/me/interviews">面试记录</Link>
        </div>
      </header>
      <main className="video-room-main" id="main-content">
        <section className="video-room-conversation" aria-label="视频面试对话">
          <div className="video-room-notices">
            {p.notice}
            {media.error && (
              <p role="alert" className="error-inline">
                {media.error}
              </p>
            )}
            {p.voice.error && (
              <p role="alert" className="error-inline">
                {p.voice.error}
              </p>
            )}
            <VoiceDraftRecovery voice={p.voice} />
            {p.voice.capabilities?.reason && (
              <p className="field-help">{p.voice.capabilities.reason}</p>
            )}
          </div>
          {media.screen && (
            <div className="video-room-share">
              <div>
                <span>正在共享所选画面 · 仅本机预览</span>
                <button onClick={() => media.stop('screen')}>停止共享</button>
              </div>
              <MediaPreview stream={media.screen} />
            </div>
          )}
          <div className="video-room-log" ref={log} role="log" aria-label="面试对话记录">
            {!p.turns.length && (
              <div className="video-room-welcome">
                <Bot size={40} />
                <h1>准备好，开始这次交流</h1>
                <p>你可以打开摄像头，分享项目画面。点击开始面试，允许麦克风后即可进入语音对话。</p>
              </div>
            )}
            {p.turns.map((turn) => (
              <div key={turn.id} className="video-room-turn">
                <div className="video-room-ai">
                  <span>AI 面试官</span>
                  {turn.acknowledgement && <p>{turn.acknowledgement}</p>}
                  <p>{turn.text}</p>
                </div>
                {turn.answer && (
                  <div className="video-room-answer">
                    <span>我 · 已保存</span>
                    <p>{turn.answer}</p>
                  </div>
                )}
              </div>
            ))}
            {p.conversationNotice}
            {p.draft && (
              <div className="video-room-answer video-room-draft">
                <span>我 · 正在组织回答</span>
                <p>{p.draft}</p>
              </div>
            )}
          </div>
          <div className="video-room-composer">
            {p.voice.active ? (
              <p role="status">
                <span className="video-room-live-dot" />
                {p.voice.status}。可以说“回答结束”提交。
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (p.canAnswer && p.draft.trim()) p.onSubmit();
                }}
              >
                <input
                  aria-label="文字回答"
                  placeholder="也可以在这里输入回答…"
                  value={p.draft}
                  disabled={!p.canAnswer}
                  onChange={(e) => p.onText(e.target.value)}
                  maxLength={p.maxAnswer}
                />
                <button
                  type="submit"
                  aria-label="提交回答"
                  disabled={!p.canAnswer || !p.draft.trim()}
                >
                  <ArrowUp size={18} />
                </button>
              </form>
            )}
          </div>
        </section>
        <aside className="video-room-sidebar">
          <div className="video-room-tile video-room-agent">
            <InterviewerAvatar
              getLevel={p.voice.getOutputLevel ?? (() => 0)}
              status={p.voice.playing ? '正在提问' : p.interviewerStatus}
            />
          </div>
          <div className="video-room-tile">
            {media.camera ? (
              <MediaPreview stream={media.camera} className="video-room-camera" />
            ) : (
              <div className="video-room-camera-off">
                <CameraOff size={30} />
                <p>摄像头未开启</p>
              </div>
            )}
            <span className="video-room-tile-label">
              我 · {media.camera ? '本机画面' : '摄像头关闭'}
            </span>
          </div>
          <div className="video-room-tips">
            <h2>面试提示</h2>
            <p>问题说完后直接回答。短暂停顿会继续等待；说“回答结束”或点击下方按钮可主动提交。</p>
            <p>需要思考时点击“让我想想”。面试官说话时自动暂停收音，播报结束后恢复。</p>
            <p>开启麦克风后，音频发送至火山引擎识别；本站仅保存转写文字。</p>
            <p>摄像头与共享画面当前仅在本机预览，不上传、不录像，也未发送给视觉模型分析。</p>
          </div>
          {p.voice.active && (
            <div className="video-room-side-actions">
              <button onClick={p.voice.commit} disabled={p.voice.connecting}>
                我说完了
              </button>
              <button onClick={p.voice.toggleHold} aria-pressed={p.voice.hold}>
                <Hand size={14} />
                {p.voice.hold ? '继续接话' : '让我想想'}
              </button>
            </div>
          )}
        </aside>
      </main>
      <footer className="video-room-footer">
        {p.onStart ? (
          <button className="video-room-start" disabled={p.blocked} onClick={p.onStart}>
            <Play />
            开始面试
          </button>
        ) : (
          !p.ended && (
            <>
              <button
                disabled={
                  p.voice.connecting || p.blocked || p.paused || !p.voice.capabilities?.available
                }
                onClick={() => (p.voice.active ? p.voice.toggleMute() : void p.voice.start())}
              >
                {p.voice.active && !p.voice.muted ? <Mic /> : <MicOff />}
                <span>{p.voice.active ? (p.voice.muted ? '取消静音' : '静音') : '开启麦克风'}</span>
              </button>
              <button disabled={p.blocked} onClick={p.onPause}>
                {p.paused ? <Play /> : <Pause />}
                <span>{p.paused ? '继续面试' : '暂停面试'}</span>
              </button>
            </>
          )
        )}
        <button
          disabled={Boolean(media.busy) || p.ended}
          onClick={() => void media.toggle('camera')}
        >
          {media.camera ? <Camera /> : <CameraOff />}
          <span>{media.camera ? '关闭摄像头' : '开启摄像头'}</span>
        </button>
        <button
          disabled={Boolean(media.busy) || p.ended}
          onClick={() => void media.toggle('screen')}
        >
          <MonitorUp />
          <span>{media.screen ? '停止共享' : '共享屏幕'}</span>
        </button>
        {!p.onStart && !p.ended && (
          <button
            className="video-room-end"
            disabled={p.blocked}
            onClick={() => {
              media.stop('camera');
              media.stop('screen');
              p.onFinish();
            }}
          >
            <PhoneOff />
            <span>结束面试</span>
          </button>
        )}
        {p.ended && p.reportHref && <Link href={p.reportHref}>查看复盘</Link>}
      </footer>
    </div>
  );
}
