'use client';
import { JOBS } from '@interviewlab/backend/content';
import {
  TYPE_LABELS,
  commitAnswer,
  elapsedSeconds,
  finishSession,
  transitionSession,
  type Session,
} from '@interviewlab/core';
import { Code2, MicOff } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CodeWorkspace } from '../../../components/code-workspace';
import { Brand, DemoNotice, EmptyState, Loading, Modal } from '../../../components/shared';
import { InterviewWorkspace, type WorkspaceTurn } from '../../../components/interview-workspace';
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
  const submitLock = useRef(false);
  useEffect(() => {
    const current = demoClient.getSession(id);
    setSession(current);
    setSaveLabel(storageAvailable() ? '本标签页已保存' : '仅临时保留，刷新可能丢失');
    try {
      setDraft(sessionStorage.getItem(`interviewlab-answer-${id}`) ?? '');
    } catch {}
    if (current?.status === 'completed' || current?.status === 'failed')
      router.replace(`/reports/${id}?demo=1`);
    const timer = setInterval(() => {
      const s = demoClient.getSession(id);
      if (s) {
        setSeconds(elapsedSeconds(s));
        if (s.status === 'completed') {
          setSession(s);
          router.replace(`/reports/${id}?demo=1`);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [id, router]);
  const question = session?.questions[session.turns.length];
  function save(next: Session) {
    demoClient.saveSession(next);
    setSession(next);
    if (next.status === 'completed') router.push(`/reports/${id}?demo=1`);
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
  const ended = session.status === 'completed' || session.status === 'failed';
  const turns: WorkspaceTurn[] = session.turns.map((t) => ({
    id: t.id,
    text: t.text,
    label: t.follow_up_index
      ? `追问 ${t.main_question_index}.${t.follow_up_index}`
      : `主问题 ${t.main_question_index}`,
    status: t.action === 'skip' ? 'skipped' : 'answered',
    answer: t.answer_text,
  }));
  if (question)
    turns.push({
      id: question.id,
      text: question.text,
      label: `主问题 ${question.main_question_index} / 最多 6${question.follow_up_index ? ` · 追问 ${question.follow_up_index}/2` : ''}`,
      status: 'waiting',
      answer: null,
    });
  return (
    <>
      <InterviewWorkspace
        jobTitle={
          session.material_snapshot.job_template?.title ??
          JOBS.find((j) => j.id === session.configuration.job)?.title ??
          session.configuration.job
        }
        typeLabel={session.parent_session_id ? '单题重练' : TYPE_LABELS[session.interview_type]}
        interviewerLabel="预设流程"
        interviewerStatus={active ? '等待你的回答' : '面试已暂停'}
        seconds={seconds}
        durationMinutes={session.configuration.duration_minutes}
        turns={turns}
        current={turns.at(-1)}
        draft={draft}
        maxAnswer={20000}
        canAnswer={active}
        paused={!active && !ended}
        ended={ended}
        saveLabel={saveLabel}
        explanation={repeated ? question?.text : null}
        notice={
          <>
            <DemoNotice compact />
            {error && (
              <div className="error-inline" role="alert">
                {error}
              </div>
            )}
          </>
        }
        conversationNotice={
          seconds >= session.configuration.duration_minutes * 60 ? (
            <div className="notice" role="status">
              已达到目标时长，可以完成当前回答后结束。12 分钟会自动收尾。
            </div>
          ) : null
        }
        interviewerNote={<>当前是预设流程演示，不调用 AI，也不评估你的回答。</>}
        workspace={
          codeOpen && (
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
          )
        }
        tools={
          <>
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
          </>
        }
        recordsHref="/me/interviews?demo=1"
        onText={updateDraft}
        onSubmit={() => submit('answer')}
        onSkip={() => {
          if (draft.trim()) setError('请先提交或清空当前草稿，再跳过本题。');
          else submit('skip');
        }}
        onRepeat={() => setRepeated(!repeated)}
        onPause={pause}
        onFinish={() => setFinishOpen(true)}
      />
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
    </>
  );
}
