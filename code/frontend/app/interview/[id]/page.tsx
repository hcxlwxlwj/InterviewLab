'use client';
import { JOBS } from '@interviewlab/content';
import {
  TYPE_LABELS,
  commitAnswer,
  elapsedSeconds,
  finishSession,
  transitionSession,
  type Session,
} from '@interviewlab/core';
import {
  ArrowLeft,
  ArrowUp,
  CameraOff,
  Check,
  CheckCheck,
  Clock3,
  Code2,
  FileText,
  Keyboard,
  MicOff,
  Pause,
  Play,
  SkipForward,
  Square,
  VolumeX,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CodeWorkspace } from '../../../components/code-workspace';
import {
  Brand,
  DemoNotice,
  EmptyState,
  Loading,
  Modal,
  formatTime,
} from '../../../components/shared';
import { Button } from '../../../components/ui/button';
import { demoClient, readDemo, storageAvailable } from '../../../lib/demo-client';

export default function InterviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(null);
  const [draft, setDraft] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [finishOpen, setFinishOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [error, setError] = useState('');
  const [repeated, setRepeated] = useState(false);
  const [saveLabel, setSaveLabel] = useState('本标签页已保存');
  const log = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const submitLock = useRef(false);
  useEffect(() => {
    const current = demoClient.getSession(id);
    setSession(current);
    setSaveLabel(storageAvailable() ? '本标签页已保存' : '仅临时保留，刷新可能丢失');
    try {
      setDraft(sessionStorage.getItem(`interviewlab-answer-${id}`) ?? '');
    } catch {}
    if (current?.status === 'completed' || current?.status === 'failed')
      router.replace(`/reports/${id}`);
    const timer = setInterval(() => {
      const s = demoClient.getSession(id);
      if (s) {
        setSeconds(elapsedSeconds(s));
        if (s.status === 'completed') {
          setSession(s);
          router.replace(`/reports/${id}`);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [id, router]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [session?.turns.length]);
  const question = session?.questions[session.turns.length];
  function save(next: Session) {
    demoClient.saveSession(next);
    setSession(next);
    if (next.status === 'completed') router.push(`/reports/${id}`);
  }
  function updateDraft(value: string) {
    setDraft(value);
    try {
      sessionStorage.setItem(`interviewlab-answer-${id}`, value);
    } catch {}
  }
  function clearDraft() {
    updateDraft('');
  }
  function submit(action: 'answer' | 'skip') {
    if (!session || submitLock.current) return;
    submitLock.current = true;
    setError('');
    try {
      const current = demoClient.getSession(id);
      if (!current) throw new Error('记录已不可用');
      const next = commitAnswer(current, draft, action, crypto.randomUUID());
      save(next);
      clearDraft();
      setRepeated(false);
      textarea.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败，请重试。');
    } finally {
      submitLock.current = false;
    }
  }
  function pause() {
    if (!session) return;
    try {
      save(transitionSession(session, session.status === 'paused' ? 'in_progress' : 'paused'));
    } catch (e) {
      setError(e instanceof Error ? e.message : '状态更新失败');
    }
  }
  function end(withDraft: boolean) {
    if (!session) return;
    try {
      let current = session;
      if (withDraft && draft.trim()) {
        if (current.status === 'paused') current = transitionSession(current, 'in_progress');
        if (current.status === 'in_progress')
          current = commitAnswer(current, draft, 'answer', crypto.randomUUID());
      }
      save(finishSession(current));
      clearDraft();
      setFinishOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '结束失败，请重试');
    }
  }
  if (session === null)
    return (
      <>
        <header className="session-header">
          <Brand />
        </header>
        <main id="main-content">
          <Loading />
        </main>
      </>
    );
  if (!session)
    return (
      <>
        <header className="session-header">
          <Brand />
        </header>
        <main id="main-content">
          <EmptyState
            title="这场面试暂时找不到了"
            description="演示记录只保留在原标签页。你可以从个人中心查看当前记录，或开始新的练习。"
            href="/me"
            action="查看我的面试"
          />
        </main>
      </>
    );
  const active = session.status === 'in_progress';
  const currentMain = question?.main_question_index ?? 6;
  return (
    <div className="session-shell">
      <header className="session-header">
        <Brand />
        <div className="session-title">
          <strong>
            {session.material_snapshot.job_template?.title ??
              JOBS.find((j) => j.id === session.configuration.job)?.title}
          </strong>
          <span>/</span>
          <span>
            {session.parent_session_id ? '单题重练' : TYPE_LABELS[session.interview_type]}
          </span>
        </div>
        <div className="session-header-right">
          <span
            className={`timer ${seconds >= session.configuration.duration_minutes * 60 ? 'timer-warning' : ''}`}
          >
            <Clock3 size={16} />
            {formatTime(seconds)}
            <small>/ {formatTime(session.configuration.duration_minutes * 60)}</small>
          </span>
          <Button variant="outline" size="sm" onClick={pause}>
            {active ? <Pause size={14} /> : <Play size={14} />}
            {active ? '暂停' : '继续'}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setFinishOpen(true)}>
            <Square size={12} />
            结束面试
          </Button>
        </div>
      </header>
      <main className="session-main" id="main-content">
        <DemoNotice compact />
        <div className="session-grid">
          <aside className="panel interviewer-panel">
            <div className="interviewer-person">
              <span className="avatar avatar-mint">面</span>
              <div>
                <h2>面试官</h2>
                <span>
                  <span className="status-dot" />
                  {active ? '等待你的回答' : '面试已暂停'}
                </span>
              </div>
              <span className="badge badge-neutral">预设流程</span>
            </div>
            <div className="current-question">
              <div className="question-meta">
                <span className="badge badge-yellow">当前问题</span>
                <span>
                  {session.parent_session_id ? '单题重练' : `主问题 ${currentMain} / 最多 6`}
                  {question?.follow_up_index ? ` · 追问 ${question.follow_up_index}/2` : ''}
                </span>
              </div>
              <h1>{question?.text ?? '本场面试已结束。'}</h1>
              <button className="text-link" onClick={() => setRepeated(!repeated)}>
                <VolumeX size={14} />
                {repeated ? '收起重复题目' : '再看一遍题目'}
              </button>
              {repeated && (
                <p className="repeated-question" role="status">
                  {question?.text}
                </p>
              )}
            </div>
            <div className="question-history">
              <div className="panel-heading">
                <h2>题目轨迹</h2>
                <span>{session.turns.length} 次已记录</span>
              </div>
              {session.turns.map((t) => (
                <div className="history-question" key={t.id}>
                  <span className={t.action === 'skip' ? 'question-skipped' : 'question-done'}>
                    {t.action === 'skip' ? <SkipForward size={11} /> : <Check size={11} />}
                  </span>
                  <div>
                    <small>
                      {t.follow_up_index
                        ? `追问 ${t.main_question_index}.${t.follow_up_index}`
                        : `主问题 ${t.main_question_index}`}
                    </small>
                    <p>{t.text}</p>
                    {t.action === 'skip' && <em>已跳过</em>}
                  </div>
                </div>
              ))}
              {question && (
                <div className="history-question history-current">
                  <span>{currentMain}</span>
                  <div>
                    <small>
                      正在作答
                      {question.follow_up_index ? ` · 追问 ${question.follow_up_index}` : ''}
                    </small>
                    <p>{question.text}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="interviewer-foot">
              <FileText size={15} />
              <p>
                评分与建议在面试结束后展示。
                <br />
                当前演示不会评估你的回答。
              </p>
            </div>
          </aside>
          <section className="panel answer-panel">
            <div className="answer-panel-header">
              <h2>作答记录</h2>
              <span>
                <CheckCheck size={14} />
                {saveLabel}
              </span>
            </div>
            <div className="conversation" ref={log} role="log" aria-label="面试对话记录">
              {session.turns.length === 0 && (
                <div className="conversation-intro">
                  <span className="badge badge-mint">从熟悉的经历开始</span>
                  <p>
                    准备好后，在下方输入你的回答。
                    <br />
                    不用追求一次说得完美。
                  </p>
                </div>
              )}
              {session.turns.map((t) => (
                <div className="conversation-turn" key={t.id}>
                  <div className="message message-interviewer">
                    <span className="avatar avatar-mint">面</span>
                    <div>
                      <small>
                        {t.follow_up_index
                          ? `追问 ${t.main_question_index}.${t.follow_up_index}`
                          : `主问题 ${t.main_question_index}`}
                      </small>
                      <p>{t.text}</p>
                    </div>
                  </div>
                  <div className="message message-user">
                    <span className="avatar avatar-peach">我</span>
                    <div>
                      <small>文字作答 · 已记录</small>
                      <p>{t.action === 'skip' ? '已跳过此题（不作为回答评分）' : t.answer_text}</p>
                    </div>
                  </div>
                </div>
              ))}
              {question && (
                <div className="message message-interviewer message-current">
                  <span className="avatar avatar-mint">面</span>
                  <div>
                    <small>
                      当前问题
                      {question.follow_up_index ? ` · 第 ${question.follow_up_index} 次追问` : ''}
                    </small>
                    <p>{question.text}</p>
                  </div>
                </div>
              )}
              {!active && (
                <div className="pause-notice" role="status">
                  <Pause size={15} />
                  面试已暂停，计时仍继续。点击“继续”恢复作答。
                </div>
              )}
              {seconds >= session.configuration.duration_minutes * 60 && (
                <div className="notice" role="status">
                  已达到目标时长，可以完成当前回答后结束。12 分钟会自动收尾。
                </div>
              )}
            </div>
            {codeOpen && (
              <CodeWorkspace
                sessionId={id}
                disabled={!active}
                theme={readDemo().preferences.editor_theme}
                onClose={() => setCodeOpen(false)}
                onSubmit={(language, source_code, revision) =>
                  save({
                    ...session,
                    version: session.version + 1,
                    code_submissions: [
                      ...(session.code_submissions ?? []),
                      {
                        language,
                        source_code,
                        revision,
                        submitted_at: new Date().toISOString(),
                        execution_mode: 'simulated',
                      },
                    ],
                  })
                }
              />
            )}
            <form
              className="answer-composer"
              onSubmit={(e) => {
                e.preventDefault();
                submit('answer');
              }}
            >
              <div className="composer-heading">
                <label htmlFor="answer">你的回答</label>
                <span>文字作答 · 不采集音视频</span>
              </div>
              <textarea
                ref={textarea}
                id="answer"
                maxLength={20000}
                disabled={!active}
                value={draft}
                onChange={(e) => updateDraft(e.target.value)}
                placeholder={
                  active
                    ? '在这里输入回答，讲讲你做了什么、如何实现，以及为什么这样选择…'
                    : '继续面试后即可作答'
                }
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    submit('answer');
                  }
                }}
              />
              {error && (
                <div className="error-inline" role="alert">
                  {error}
                </div>
              )}
              <div className="composer-bottom">
                <span>
                  {draft.length}/20000 <kbd>Ctrl + Enter</kbd>
                </span>
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!active}
                    onClick={() => {
                      if (draft.trim()) setError('请先提交或清空当前草稿，再跳过本题。');
                      else submit('skip');
                    }}
                  >
                    <SkipForward size={14} />
                    跳过
                  </Button>
                  <Button type="submit" size="sm" disabled={!active || !draft.trim()}>
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
              <button onClick={() => setVoiceOpen(true)}>
                <MicOff size={14} />
                语音流程说明
              </button>
              {session.configuration.code_assessment_enabled && (
                <button onClick={() => setCodeOpen(!codeOpen)}>
                  <Code2 size={14} />
                  {codeOpen ? '收起代码区' : '打开代码区'}
                </button>
              )}
              <span className="device-off">
                <CameraOff size={14} />
                镜头关闭
              </span>
              <Link href="/me/interviews">
                <ArrowLeft size={13} />
                返回记录
              </Link>
            </div>
          </section>
        </div>
      </main>
      <Modal
        open={finishOpen}
        onOpenChange={setFinishOpen}
        title="结束这次面试？"
        description="已提交的回答会保留在当前标签页。结束后进入报告页，未提交的草稿不会自动纳入记录。"
      >
        {draft.trim() && (
          <div className="notice">你还有一份未提交的回答，可以提交后结束，或放弃这份草稿。</div>
        )}
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setFinishOpen(false)}>
            返回作答
          </Button>
          <Button variant={draft.trim() ? 'ghost' : 'default'} onClick={() => end(false)}>
            {draft.trim() ? '放弃草稿并结束' : '确认结束'}
          </Button>
          {draft.trim() && <Button onClick={() => end(true)}>提交并结束</Button>}
        </div>
      </Modal>
      <Modal
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        title="实时语音流程预览"
        description="正式接入后的目标：听到问题 → 直接口头回答 → 自动识别回合结束 → 保存原始回答 → 自然接话。"
      >
        <div className="notice">
          <MicOff size={16} />
          当前版本没有 ASR、TTS 或端点检测服务，不会启动麦克风或摄像头。请使用文字继续体验。
        </div>
        <p className="field-help">
          后续支持思考停顿、打断与误截续答；转写不提供润色后发送。表达观测在面试结束后展示。
        </p>
        <div className="dialog-actions">
          <Button onClick={() => setVoiceOpen(false)}>继续文字作答</Button>
        </div>
      </Modal>
    </div>
  );
}
