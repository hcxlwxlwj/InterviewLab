'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { INTERVIEW_MAX_ANSWER, interviewDurationMinutes, type Interview } from '@interviewlab/core';
import { useRouter } from 'next/navigation';
import { interviewsApi } from '../../lib/api/interviews';
import { useSession } from '../../components/session-provider';
import { Brand, Header, Loading, Modal } from '../../components/shared';
import { CommandNotice, ErrorNotice, SessionGate, useLiveCommand, useLiveResource } from './common';

import { useInterviewStream } from './stream';
import { InterviewWorkspace } from '../../components/interview-workspace';
import { Button } from '../../components/ui/button';
import { useInterviewFlow } from './flow-provider';
import { PreparationScreen } from './preparation';
import { TransitionScreen } from './transition-screen';
import { VoiceControls } from './voice/controls';
import { VideoInterviewWorkspace } from '../video-interview/room';
import { useQuestionPresentation } from './use-question-presentation';
import { interviewPresentation } from './interview-presentation';
import { InterviewProgressNotice, InterviewGenerationNotice } from './interview-notices';

function InterviewBody({ id, videoRoom = false }: { id: string; videoRoom?: boolean }) {
  const flow = useInterviewFlow();
  const router = useRouter();
  const Workspace = videoRoom ? VideoInterviewWorkspace : InterviewWorkspace;
  const { state: account } = useSession();
  const load = useCallback((signal: AbortSignal) => interviewsApi.read(id, signal), [id]);
  const resource = useLiveResource(
    load,
    (v) =>
      v.generation_status === 'pending' ||
      ['pending', 'waiting_material'].includes(v.preparation?.status ?? ''),
  );
  const stream = useInterviewStream(id, resource.value, resource.accept, resource.refresh);
  const command = useLiveCommand(() => void resource.refresh());
  const [draft, setDraft] = useState({ key: '', text: '' });
  const [storageError, setStorageError] = useState('');
  const [finish, setFinish] = useState(false);
  const restoreVoice = useRef<(() => void) | null>(null);
  const [now, setNow] = useState(Date.now());
  const deadlineChecked = useRef(false);
  const v = resource.value;
  const presentation = useQuestionPresentation(v);
  const turn = v?.turns.at(-1);
  const terminal = v?.status === 'completed' || v?.status === 'failed';
  const userId = account.status === 'signed_in' ? account.session.user.id : '';
  const draftKey = userId && turn ? `interviewlab:live:${userId}:${id}:${turn.id}` : '';
  useEffect(() => {
    if (!draftKey) return;
    try {
      setDraft({ key: draftKey, text: sessionStorage.getItem(draftKey) ?? '' });
    } catch {
      setDraft({ key: draftKey, text: '' });
      setStorageError('浏览器无法保存草稿，请保持页面打开。');
    }
  }, [draftKey]);
  useEffect(() => {
    if (!v?.started_at || terminal) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [v?.started_at, terminal]);
  useEffect(() => {
    if (
      v?.deadline_at &&
      now >= Date.parse(v.deadline_at) &&
      !terminal &&
      !deadlineChecked.current
    ) {
      deadlineChecked.current = true;
      void resource.refresh();
    }
  }, [now, v?.deadline_at, terminal, resource.refresh]);
  function setText(text: string) {
    setDraft({ key: draftKey, text });
    try {
      sessionStorage.setItem(draftKey, text);
    } catch {
      setStorageError('草稿仅保留在当前页面，刷新可能丢失。');
    }
  }
  const text = draft.key === draftKey ? draft.text : '';
  function accepted(result: Interview, submitted?: { turnId: string; text: string; key: string }) {
    if (
      submitted &&
      result.turns.some(
        (t) =>
          t.id === submitted.turnId &&
          t.answer_status === 'answered' &&
          t.answer_text === submitted.text,
      )
    ) {
      try {
        sessionStorage.removeItem(submitted.key);
      } catch {}
      setDraft({ key: submitted.key, text: '' });
    }
    resource.accept(result);
    setNow(Date.now());
    restoreVoice.current = null;
    setFinish(false);
  }
  function act(
    action: string,
    body: object,
    submitted?: { turnId: string; text: string; key: string },
  ) {
    const input = { version: v!.version, ...body };
    command.run(
      (key) => interviewsApi.command(id, action, input, key),
      (result) => accepted(result, submitted),
    );
  }
  const voice = flow.voice;
  function changeFinish(open: boolean) {
    if (open) restoreVoice.current = voice.suspend();
    else {
      restoreVoice.current?.();
      restoreVoice.current = null;
    }
    setFinish(open);
  }
  useEffect(
    () => flow.bind({ id, draft: text, onDraft: setText, onView: resource.accept }),
    [id, text, draftKey],
  );
  useEffect(() => {
    if (!v) return;
    if (flow.view !== v) flow.accept(v);
    if (terminal) {
      flow.release();
      router.replace(`/interview/${id}/analysis`);
    } else if (
      v.status === 'ready' ||
      (v.status === 'in_progress' &&
        v.configuration.interaction_mode !== 'text_fallback' &&
        flow.phase === 'idle')
    )
      router.replace(`/interview/${id}/prepare`);
  }, [v?.id, v?.version, v?.status]);
  if (!v)
    return (
      <>
        <header className="session-header">
          <Brand />
        </header>
        <main className="session-main" id="main-content">
          <ErrorNotice message={resource.error} retry={() => void resource.refresh()} />
          {!resource.error && <Loading />}
        </main>
      </>
    );
  if (v.status === 'ready') return <PreparationScreen view={v} />;
  if (terminal)
    return (
      <TransitionScreen
        kind="analysis"
        title="恭喜你完成面试"
        description="回答已保存，正在为你准备复盘。"
        steps={[
          { label: '保存回答', state: 'done' },
          { label: '读取分析进度', state: 'active' },
        ]}
      />
    );
  const waiting = turn?.answer_status === 'waiting';
  const continuation =
    turn?.answer_status === 'answered' &&
    ['idle', 'failed'].includes(v.generation_status) &&
    v.status === 'in_progress';
  const canAnswer =
    (waiting || continuation) &&
    v.status === 'in_progress' &&
    v.generation_status !== 'pending' &&
    !command.blocked;
  const targetReached = v.target_at && now >= Date.parse(v.target_at);
  const workspace = interviewPresentation(v, now, stream.preview);
  const submit = () => {
    if (voice.active) {
      voice.commit();
      return;
    }
    if (continuation)
      act(
        'voice/continue',
        { turn_id: turn!.id, text },
        {
          turnId: turn!.id,
          text: [turn!.answer_text, text].filter(Boolean).join('\n'),
          key: draftKey,
        },
      );
    else act(`turns/${turn!.id}/answer`, { text }, { turnId: turn!.id, text, key: draftKey });
  };

  return (
    <>
      <Workspace
        voice={voice}
        initialCamera={flow.camera}
        onCameraChange={flow.setCamera}
        jobTitle={v.job_title}
        typeLabel={workspace.typeLabel}
        interviewerLabel="AI 面试官"
        interviewerStatus={workspace.interviewerStatus}
        seconds={workspace.seconds}
        durationMinutes={interviewDurationMinutes(v)}
        turns={workspace.turns}
        current={workspace.current}
        draft={text}
        maxAnswer={INTERVIEW_MAX_ANSWER}
        canAnswer={Boolean(canAnswer)}
        blocked={
          command.blocked ||
          voice.connecting ||
          Boolean(v.preparation && !['ready', 'fallback'].includes(v.preparation.status))
        }
        paused={v.status === 'paused'}
        ended={Boolean(terminal)}
        saveLabel={workspace.saveLabel}
        draftHint={storageError || (terminal && text ? '此草稿尚未提交，你仍可复制保存。' : '')}
        explanation={v.clarification}
        voiceActive={voice.active}
        voiceView={voice.display}
        workspace={
          <VoiceControls
            voice={voice}
            preferred={v.configuration.interaction_mode === 'realtime_voice'}
            disabled={v.status !== 'in_progress' || command.blocked || finish}
          />
        }
        notice={
          <>
            <ErrorNotice message={resource.error} retry={() => void resource.refresh()} />
            <ErrorNotice message={presentation.error} retry={presentation.retry} />
            <CommandNotice command={command} refresh={() => void resource.refresh()} />
            <InterviewProgressNotice
              view={v}
              continuation={Boolean(continuation)}
              targetReached={Boolean(targetReached)}
              canContinue={!command.blocked && !voice.active}
              onContinue={() => act('voice/continue', { turn_id: turn!.id, text: '' })}
              canExtend={!command.blocked}
              onExtend={() => act('extend', {})}
              onFinish={() => changeFinish(true)}
            />
          </>
        }
        conversationNotice={
          <InterviewGenerationNotice
            view={v}
            preview={stream.preview}
            blocked={command.blocked}
            onRetry={(fallback) => act('generation/retry', { fallback })}
          />
        }
        interviewerNote={<>不熟悉的内容可以直接说明，也可以跳过本题。</>}
        recordsHref="/me/interviews"
        reportHref={`/reports/${id}`}
        onText={setText}
        onSubmit={submit}
        onSkip={() => {
          voice.stop();
          if (text.trim()) setStorageError('请先提交或清空当前草稿，再跳过本题。');
          else act(`turns/${turn!.id}/actions`, { action: 'skip' });
        }}
        onRepeat={() => act(`turns/${turn!.id}/actions`, { action: 'repeat_question' })}
        onClarify={() => act(`turns/${turn!.id}/actions`, { action: 'clarify_question' })}
        onPause={() => {
          voice.stop();
          act(v.status === 'paused' ? 'resume' : 'pause', {});
        }}
        onFinish={() => changeFinish(true)}
      />
      {finish && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!command.blocked) changeFinish(open);
          }}
          title="确定提前结束面试？"
          description={
            text.trim()
              ? '当前回答会一并提交，随后为你呈现本场分析报告。'
              : '结束后将为你呈现本场分析报告。'
          }
        >
          <div className="dialog-actions">
            <Button
              variant="outline"
              disabled={command.blocked}
              onClick={() => changeFinish(false)}
            >
              继续面试
            </Button>
            <Button
              disabled={command.blocked}
              onClick={() => {
                const finalText = text.trim();
                act(
                  'finish',
                  {
                    reason: 'user_finished',
                    ...(finalText && turn
                      ? { final_answer: { turn_id: turn.id, text: finalText } }
                      : {}),
                  },
                  finalText && turn
                    ? {
                        turnId: turn.id,
                        text: continuation
                          ? [turn.answer_text, finalText].filter(Boolean).join('\n')
                          : finalText,
                        key: draftKey,
                      }
                    : undefined,
                );
              }}
            >
              结束面试并查看报告
            </Button>
          </div>
          <CommandNotice command={command} refresh={() => void resource.refresh()} />
        </Modal>
      )}
    </>
  );
}
export default function LiveInterview({
  id,
  videoRoom = false,
}: {
  id: string;
  videoRoom?: boolean;
}) {
  const { state } = useSession();
  if (state.status !== 'signed_in')
    return (
      <>
        <Header />
        <main className="container page-body" id="main-content">
          <SessionGate>{null}</SessionGate>
        </main>
      </>
    );
  return <InterviewBody key={`${state.session.user.id}:${id}`} id={id} videoRoom={videoRoom} />;
}
