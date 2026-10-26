'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { INTERVIEW_MAX_ANSWER, LIVE_TYPE_LABELS, type Interview } from '@interviewlab/core';
import { interviewsApi } from '../../lib/api/interviews';
import { useSession } from '../../components/session-provider';
import { Brand, Header, Loading, Modal } from '../../components/shared';
import { CommandNotice, ErrorNotice, SessionGate, useLiveCommand, useLiveResource } from './common';

import { useInterviewStream } from './stream';
import { InterviewWorkspace } from '../../components/interview-workspace';
import { Button } from '../../components/ui/button';

const STAGES = {
  introduction: '自我介绍',
  experience: '经历交流',
  technical: '专业交流',
  business: '业务交流',
  behavioral: '动机与协作',
  closing: '面试收尾',
};
function InterviewBody({ id }: { id: string }) {
  const { state: account, isDevelopment } = useSession();
  const load = useCallback((signal: AbortSignal) => interviewsApi.read(id, signal), [id]);
  const [streamConnected, setStreamConnected] = useState(false);
  const resource = useLiveResource(
    load,
    (v) => v.generation_status === 'pending' && !streamConnected,
  );
  const stream = useInterviewStream(id, resource.value, resource.accept, resource.refresh);
  useEffect(() => setStreamConnected(stream.connected), [stream.connected]);
  const command = useLiveCommand(() => void resource.refresh());
  const [draft, setDraft] = useState({ key: '', text: '' });
  const [storageError, setStorageError] = useState('');
  const [finish, setFinish] = useState(false);
  const [dismissedParticipation, setDismissedParticipation] = useState('');
  const [now, setNow] = useState(Date.now());
  const acknowledged = useRef(new Set<string>());
  const deadlineChecked = useRef(false);
  const v = resource.value;
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
  useEffect(() => {
    if (
      !v ||
      v.status !== 'in_progress' ||
      !turn ||
      turn.answer_status !== 'waiting' ||
      turn.presented_at ||
      acknowledged.current.has(turn.id)
    )
      return;
    acknowledged.current.add(turn.id);
    void interviewsApi
      .command(id, `turns/${turn.id}/presented`, { version: v.version }, crypto.randomUUID())
      .catch(() => {});
  }, [id, v, turn]);
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
  const waiting = turn?.answer_status === 'waiting';
  const canAnswer =
    waiting && v.status === 'in_progress' && v.generation_status !== 'pending' && !command.blocked;
  const targetReached = v.target_at && now >= Date.parse(v.target_at);
  const turns = v.turns.map((t) => ({
    id: t.id,
    text: t.text,
    label: t.stage
      ? STAGES[t.stage]
      : `主问题 ${t.main_question_index}${t.follow_up_index ? ` · 追问 ${t.follow_up_index}` : ''}`,
    acknowledgement: t.acknowledgement,
    status: t.answer_status,
    answer: t.answer_text,
  }));
  const seconds = v.started_at
    ? Math.min(
        720,
        Math.max(
          0,
          Math.floor(
            ((terminal && v.ended_at ? Date.parse(v.ended_at) : now) - Date.parse(v.started_at)) /
              1000,
          ),
        ),
      )
    : 0;
  const submit = () =>
    act(`turns/${turn!.id}/answer`, { text }, { turnId: turn!.id, text, key: draftKey });
  const participation = v.participation;
  const participationKey = participation ? `${participation.turn_id}:${participation.level}` : '';
  return (
    <>
      <InterviewWorkspace
        jobTitle={v.job_title}
        typeLabel={
          v.parent_interview_id ? '单题重练' : LIVE_TYPE_LABELS[v.configuration.interview_type]
        }
        interviewerLabel="AI 面试官"
        interviewerStatus={
          v.status === 'paused'
            ? '面试已暂停'
            : terminal
              ? '本场交流已结束'
              : v.generation_status === 'pending'
                ? stream.preview
                  ? '正在提问…'
                  : '正在结合你的回答…'
                : waiting
                  ? '等待你的回答'
                  : v.generation_status === 'failed'
                    ? '生成失败，可重试'
                    : '准备开始'
        }
        seconds={seconds}
        durationMinutes={v.configuration.duration_minutes}
        turns={turns}
        current={
          stream.preview
            ? {
                id: 'generation-preview',
                text: stream.preview.text,
                label: '面试官正在提问',
                acknowledgement: stream.preview.acknowledgement,
                status: 'waiting',
                answer: null,
              }
            : terminal && participation?.level === 'ended'
              ? {
                  id: 'participation-ended',
                  text: '本场面试已结束。',
                  label: '结束说明',
                  status: 'answered',
                  answer: null,
                }
              : turns.at(-1)
        }
        draft={text}
        maxAnswer={INTERVIEW_MAX_ANSWER}
        canAnswer={Boolean(canAnswer)}
        blocked={command.blocked}
        paused={v.status === 'paused'}
        ended={Boolean(terminal)}
        saveLabel={
          v.turns.some((t) => t.answer_status === 'answered') ? '回答已保存' : '提交后保存'
        }
        draftHint={
          storageError ||
          (terminal && text
            ? '此草稿尚未提交，你仍可复制保存。'
            : '草稿保留在当前标签页，提交确认后清除。')
        }
        explanation={v.clarification}
        notice={
          <>
            <ErrorNotice message={resource.error} retry={() => void resource.refresh()} />
            <CommandNotice command={command} refresh={() => void resource.refresh()} />
            {participation && (
              <p className="notice" role="status">
                {participation.message}
              </p>
            )}
            {v.status === 'ready' && (
              <p className="notice">
                {v.parent_interview_id
                  ? '本次重练直接回到原问题。'
                  : '从自我介绍开始，面试官将根据你的回答继续交流。'}
                点击右上角开始后计时。
              </p>
            )}
            {v.retry_goal && <p className="notice">单题重练目标：{v.retry_goal}</p>}
            {targetReached && !terminal && (
              <p className="notice" role="status">
                已到目标时长，请完成当前回答后收尾。12 分钟后会自动封存，暂停和断线仍计时。
              </p>
            )}
          </>
        }
        conversationNotice={
          <>
            {stream.preview && (
              <div className="message message-interviewer" aria-live="polite">
                <p>{stream.preview.acknowledgement}</p>
                <p>{stream.preview.text}</p>
                <small>生成中，完成后即可回答</small>
              </div>
            )}
            {v.generation_status === 'pending' && !stream.preview && (
              <p className="notice" role="status">
                回答已保存，面试官正在结合你的陈述思考…
              </p>
            )}
            {v.generation_status === 'failed' && (
              <div className="notice" role="status">
                <span>生成暂时失败，已保存的回答仍保留。</span>
                <Button
                  size="sm"
                  disabled={command.blocked}
                  onClick={() => act('generation/retry', { fallback: false })}
                >
                  重试生成
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={command.blocked}
                  onClick={() => act('generation/retry', { fallback: true })}
                >
                  {waiting ? '保留原题继续作答' : '使用通用流程题继续'}
                </Button>
              </div>
            )}
          </>
        }
        interviewerNote={
          <>
            结合自己的实际经历回答，不熟悉的内容可以直接说明。
            <br />
            面试中不展示评价和参考答案。
          </>
        }
        recordsHref="/me/interviews"
        reportHref={isDevelopment ? undefined : `/reports/${id}`}
        onText={setText}
        onSubmit={submit}
        onSkip={() => {
          if (text.trim()) setStorageError('请先提交或清空当前草稿，再跳过本题。');
          else act(`turns/${turn!.id}/actions`, { action: 'skip' });
        }}
        onRepeat={() => act(`turns/${turn!.id}/actions`, { action: 'repeat_question' })}
        onClarify={() => act(`turns/${turn!.id}/actions`, { action: 'clarify_question' })}
        onPause={() => act(v.status === 'paused' ? 'resume' : 'pause', {})}
        onFinish={() => setFinish(true)}
        onStart={v.status === 'ready' ? () => act('start', {}) : undefined}
      />
      {participation && !finish && dismissedParticipation !== participationKey && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) setDismissedParticipation(participationKey);
          }}
          title={
            participation.level === 'ended'
              ? '本场面试已结束'
              : participation.level === 'confirmation'
                ? '是否继续面试？'
                : '面试交流提醒'
          }
          description={participation.message}
        >
          <div className="dialog-actions">
            <Button onClick={() => setDismissedParticipation(participationKey)}>
              {terminal ? '知道了' : '继续作答'}
            </Button>
            {!terminal && (
              <Button
                variant="outline"
                disabled={command.blocked}
                onClick={() => {
                  setDismissedParticipation(participationKey);
                  setFinish(true);
                }}
              >
                结束面试
              </Button>
            )}
          </div>
        </Modal>
      )}
      {finish && (
        <Modal open={finish} onOpenChange={setFinish} title="结束本场面试">
          <p>
            {isDevelopment
              ? '本次联调只保存回答并封存面试，不生成报告。'
              : '已提交的回答会保留并生成复盘。'}
            未提交的草稿不会自动保存。
          </p>
          <div className="dialog-actions">
            <button
              className="button button-outline"
              disabled={command.blocked}
              onClick={() => act('finish', { reason: 'user_finished' })}
            >
              仅保存已提交内容并结束
            </button>
            {waiting && text.trim() && (
              <button
                className="button button-primary"
                disabled={command.blocked}
                onClick={() =>
                  act(
                    'finish',
                    { reason: 'user_finished', final_answer: { turn_id: turn!.id, text } },
                    { turnId: turn!.id, text, key: draftKey },
                  )
                }
              >
                提交当前草稿并结束
              </button>
            )}
          </div>
          <CommandNotice command={command} refresh={() => void resource.refresh()} />
        </Modal>
      )}
    </>
  );
}
export default function LiveInterview({ id }: { id: string }) {
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
  return <InterviewBody key={`${state.session.user.id}:${id}`} id={id} />;
}
