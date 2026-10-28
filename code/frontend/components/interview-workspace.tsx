'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  CameraOff,
  Check,
  CheckCheck,
  Clock3,
  FileText,
  Keyboard,
  Pause,
  Play,
  SkipForward,
  Square,
  VolumeX,
} from 'lucide-react';
import Link from 'next/link';
import { Brand, formatTime } from './shared';
import { Button } from './ui/button';

export interface WorkspaceTurn {
  id: string;
  text: string;
  label: string;
  acknowledgement?: string;
  status: 'waiting' | 'answered' | 'skipped';
  answer: string | null;
}
interface Props {
  jobTitle: string;
  typeLabel: string;
  interviewerLabel: string;
  interviewerStatus: string;
  seconds: number;
  durationMinutes: number;
  turns: WorkspaceTurn[];
  current?: WorkspaceTurn;
  draft: string;
  maxAnswer: number;
  canAnswer: boolean;
  blocked?: boolean;
  paused: boolean;
  ended: boolean;
  saveLabel: string;
  draftHint?: string;
  explanation?: string | null;
  notice?: ReactNode;
  conversationNotice?: ReactNode;
  interviewerNote: ReactNode;
  workspace?: ReactNode;
  tools?: ReactNode;
  recordsHref: string;
  reportHref?: string;
  onText: (text: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onRepeat: () => void;
  onClarify?: () => void;
  onPause: () => void;
  onFinish: () => void;
  onStart?: () => void;
}

/** Original interview layout shared by the HTTP and explicit demo controllers. */
export function InterviewWorkspace(p: Props) {
  const log = useRef<HTMLDivElement>(null);
  const last = p.turns.at(-1);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [last?.id, last?.status, p.interviewerStatus, p.explanation]);
  return (
    <div className="session-shell">
      <header className="session-header">
        <Brand />
        <div className="session-title">
          <strong>{p.jobTitle}</strong>
          <span>/</span>
          <span>{p.typeLabel}</span>
        </div>
        <div className="session-header-right">
          <span className={`timer ${p.seconds >= p.durationMinutes * 60 ? 'timer-warning' : ''}`}>
            <Clock3 size={16} />
            {formatTime(p.seconds)}
            <small>/ {formatTime(p.durationMinutes * 60)}</small>
          </span>
          {p.onStart ? (
            <Button size="sm" disabled={p.blocked} onClick={p.onStart}>
              <Play size={14} />
              开始面试
            </Button>
          ) : (
            !p.ended && (
              <>
                <Button variant="outline" size="sm" disabled={p.blocked} onClick={p.onPause}>
                  {p.paused ? <Play size={14} /> : <Pause size={14} />}
                  {p.paused ? '继续' : '暂停'}
                </Button>
                <Button variant="danger" size="sm" disabled={p.blocked} onClick={p.onFinish}>
                  <Square size={12} />
                  结束面试
                </Button>
              </>
            )
          )}
          {p.ended && p.reportHref && (
            <Button asChild size="sm">
              <Link href={p.reportHref}>查看复盘</Link>
            </Button>
          )}
        </div>
      </header>
      <main className="session-main" id="main-content">
        {p.notice}
        <div className="session-grid">
          <aside className="panel interviewer-panel">
            <div className="interviewer-person">
              <span className="avatar avatar-mint">面</span>
              <div>
                <h2>面试官</h2>
                <span>
                  <span className="status-dot" />
                  {p.interviewerStatus}
                </span>
              </div>
              <span className="badge badge-neutral">{p.interviewerLabel}</span>
            </div>
            <div className="current-question">
              <div className="question-meta">
                <span className="badge badge-yellow">当前问题</span>
                <span>{p.current?.label ?? (p.ended ? '已结束' : '准备开始')}</span>
              </div>
              <h1>
                {p.current?.text ?? (p.ended ? '本场面试已结束。' : '准备好后，点击开始面试。')}
              </h1>
              {p.current && (
                <button className="text-link" disabled={!p.canAnswer} onClick={p.onRepeat}>
                  <VolumeX size={14} />
                  再看一遍题目
                </button>
              )}
              {p.explanation && (
                <p className="repeated-question" role="status">
                  {p.explanation}
                </p>
              )}
            </div>
            <div className="question-history">
              <div className="panel-heading">
                <h2>题目轨迹</h2>
                <span>{p.turns.filter((t) => t.status !== 'waiting').length} 次已记录</span>
              </div>
              {p.turns.map((t) => (
                <div
                  className={`history-question ${t.status === 'waiting' ? 'history-current' : ''}`}
                  key={t.id}
                >
                  <span className={t.status === 'skipped' ? 'question-skipped' : 'question-done'}>
                    {t.status === 'skipped' ? (
                      <SkipForward size={11} />
                    ) : t.status === 'answered' ? (
                      <Check size={11} />
                    ) : (
                      '·'
                    )}
                  </span>
                  <div>
                    <small>
                      {t.status === 'waiting' ? (p.ended ? '未回答' : '正在作答') : t.label}
                    </small>
                    <p>{t.text}</p>
                    {t.status === 'skipped' && <em>已跳过</em>}
                  </div>
                </div>
              ))}
            </div>
            <div className="interviewer-foot">
              <FileText size={15} />
              <p>{p.interviewerNote}</p>
            </div>
          </aside>
          <section className="panel answer-panel">
            <div className="answer-panel-header">
              <h2>作答记录</h2>
              <span>
                <CheckCheck size={14} />
                {p.saveLabel}
              </span>
            </div>
            <div className="conversation" ref={log} role="log" aria-label="面试对话记录">
              {!p.turns.some((t) => t.status !== 'waiting') && (
                <div className="conversation-intro">
                  <span className="badge badge-mint">从认识你开始</span>
                  <p>
                    准备好后，在下方输入你的回答。
                    <br />
                    不用追求一次说得完美。
                  </p>
                </div>
              )}
              {p.turns.map((t) => (
                <div className="conversation-turn" key={t.id}>
                  <div
                    className={`message message-interviewer ${t.status === 'waiting' ? 'message-current' : ''}`}
                  >
                    <span className="avatar avatar-mint">面</span>
                    <div>
                      <small>{t.status === 'waiting' ? '当前问题' : t.label}</small>
                      {t.acknowledgement && <p>{t.acknowledgement}</p>}
                      <p>{t.text}</p>
                    </div>
                  </div>
                  {t.status !== 'waiting' && (
                    <div className="message message-user">
                      <span className="avatar avatar-peach">我</span>
                      <div>
                        <small>文字作答 · 已记录</small>
                        <p>{t.status === 'skipped' ? '已跳过此题' : t.answer}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {p.conversationNotice}
              {p.paused && (
                <div className="pause-notice" role="status">
                  <Pause size={15} />
                  面试已暂停，计时仍继续。点击“继续”恢复作答。
                </div>
              )}
              {p.ended && (
                <div className="notice" role="status">
                  本场面试已结束，已提交的回答已保存。
                </div>
              )}
            </div>
            {p.workspace}
            <form
              className="answer-composer"
              onSubmit={(e) => {
                e.preventDefault();
                if (p.canAnswer && p.draft.trim()) p.onSubmit();
              }}
            >
              <div className="composer-heading">
                <label htmlFor="answer">你的回答</label>
                <span>文字作答 · 不采集音视频</span>
              </div>
              <textarea
                id="answer"
                maxLength={p.maxAnswer}
                disabled={!p.canAnswer && !p.ended}
                readOnly={p.ended}
                value={p.draft}
                onChange={(e) => p.onText(e.target.value)}
                placeholder={
                  p.paused ? '继续面试后即可作答' : '在这里输入回答，结合自己的经历和理解说明…'
                }
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    if (p.canAnswer && p.draft.trim()) p.onSubmit();
                  }
                }}
              />
              {p.draftHint && (
                <p className="field-help" role="status">
                  {p.draftHint}
                </p>
              )}
              <div className="composer-bottom">
                <span>
                  {p.draft.length}/{p.maxAnswer} <kbd>Ctrl + Enter</kbd>
                </span>
                <div>
                  {p.onClarify && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!p.canAnswer}
                      onClick={p.onClarify}
                    >
                      澄清题意
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!p.canAnswer}
                    onClick={p.onSkip}
                  >
                    <SkipForward size={14} />
                    跳过
                  </Button>
                  <Button type="submit" size="sm" disabled={!p.canAnswer || !p.draft.trim()}>
                    提交回答
                    <ArrowUp size={15} />
                  </Button>
                </div>
              </div>
            </form>
            <div className="session-tools">
              <span>
                <Keyboard size={14} />
                文字模式
              </span>
              {p.tools}
              <span className="device-off">
                <CameraOff size={14} />
                镜头关闭
              </span>
              <Link href={p.recordsHref}>
                <ArrowLeft size={13} />
                返回记录
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
