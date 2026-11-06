'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LIVE_TYPE_LABELS, type Interview } from '@interviewlab/core';
import { interviewsApi } from '../../lib/api/interviews';
import { Button } from '../../components/ui/button';
import { useInterviewFlow } from './flow-provider';
import { SessionGate, useLiveCommand, useLiveResource } from './common';
import { TransitionScreen, type TransitionStep } from './transition-screen';

export function PreparationScreen({
  view,
  error = '',
  refresh,
}: {
  view?: Interview | null;
  error?: string;
  refresh?: () => void;
}) {
  const flow = useInterviewFlow();
  const router = useRouter();
  const command = useLiveCommand(refresh);
  const config = view?.configuration ?? flow.configuration;
  const preparation = view?.preparation;
  const ready = !preparation || ['ready', 'fallback'].includes(preparation.status);
  const failed = preparation?.status === 'failed';
  const message =
    error ||
    flow.error ||
    (view && flow.isAbandoned(view.id) ? '本次准备已取消，你可以重试或返回配置。' : '') ||
    (failed ? '本场面试规划暂未完成，你的配置和简历仍已保存。' : '');
  const steps: TransitionStep[] = [
    {
      label: '检查设备',
      state: flow.deviceReady ? 'done' : message && !failed ? 'error' : 'active',
    },
    {
      label: config?.resume_ref ? '准备岗位与简历' : '准备岗位信息',
      state: preparation?.status === 'waiting_material' ? 'active' : view ? 'done' : 'pending',
    },
    {
      label: '规划本场面试',
      state: failed
        ? 'error'
        : view && ready
          ? 'done'
          : view && preparation?.status !== 'waiting_material'
            ? 'active'
            : 'pending',
    },
    {
      label: '进入面试房间',
      state: flow.phase === 'running' ? 'done' : flow.phase === 'connecting' ? 'active' : 'pending',
    },
  ];
  const returnToConfig = () => {
    flow.abandon();
    router.replace('/interview/setup');
  };
  const retry = () => {
    if (failed && view)
      command.run(
        (key) =>
          interviewsApi.command(
            view.id,
            'prepare',
            { version: view.version, mode: 'personalized' },
            key,
          ),
        (next) => {
          flow.accept(next);
          flow.retry();
          refresh?.();
        },
      );
    else if (view) {
      flow.retry(view);
      refresh?.();
    } else if (config) void flow.begin(config);
    else refresh?.();
  };
  return (
    <TransitionScreen
      kind="preparing"
      title="正在准备面试"
      description={
        flow.phase === 'connecting'
          ? '正在连接面试官'
          : flow.phase === 'devices'
            ? '请允许浏览器使用所选设备'
            : preparation?.status === 'waiting_material'
              ? '正在阅读你的简历'
              : view && !ready
                ? '正在规划本场提问'
                : view
                  ? '即将进入面试'
                  : '正在准备岗位信息'
      }
      context={
        config
          ? `${view?.job_title ?? config.job} · ${LIVE_TYPE_LABELS[config.interview_type]} · ${config.duration_minutes} 分钟`
          : undefined
      }
      steps={steps}
      error={message || command.error}
    >
      <div className="transition-actions">
        {message && (
          <Button disabled={command.blocked} onClick={retry}>
            {failed ? '重试准备' : '重试设备'}
          </Button>
        )}
        {message && !flow.textMode && config?.interaction_mode !== 'text_fallback' && (
          <Button
            variant="outline"
            onClick={() => {
              flow.useText();
              if (!view && config) void flow.begin(config);
              else refresh?.();
            }}
          >
            改用文字
          </Button>
        )}
        {failed && view && (
          <Button
            variant="outline"
            disabled={command.blocked}
            onClick={() =>
              command.run(
                (key) =>
                  interviewsApi.command(
                    view.id,
                    'prepare',
                    { version: view.version, mode: 'fallback' },
                    key,
                  ),
                (next) => {
                  flow.accept(next);
                  flow.retry();
                  refresh?.();
                },
              )
            }
          >
            使用简化准备
          </Button>
        )}
        <Button variant="ghost" onClick={returnToConfig}>
          返回配置
        </Button>
      </div>
    </TransitionScreen>
  );
}

function PreparationBody({ id }: { id: string }) {
  const flow = useInterviewFlow();
  const router = useRouter();
  const load = useCallback((signal: AbortSignal) => interviewsApi.read(id, signal), [id]);
  const resource = useLiveResource(
    load,
    (v) => ['pending', 'waiting_material'].includes(v.preparation?.status ?? ''),
    { retryReadErrors: true },
  );
  const view = resource.value;
  const requested = useRef(new Set<number>());
  const command = useLiveCommand(() => void resource.refresh());
  useEffect(() => {
    if (!view) return;
    flow.accept(view);
    if (['completed', 'failed'].includes(view.status)) {
      flow.release();
      router.replace(`/interview/${id}/analysis`);
      return;
    }
    if (view.status === 'paused') {
      flow.release();
      router.replace(flow.roomPath(view));
      return;
    }
    if (
      view.status === 'ready' &&
      view.preparation?.status === 'pending' &&
      !view.preparation.task_id &&
      !requested.current.has(view.version)
    ) {
      requested.current.add(view.version);
      command.run(
        (key) =>
          interviewsApi.command(
            id,
            'prepare',
            { version: view.version, mode: 'personalized' },
            key,
          ),
        resource.accept,
      );
    }
  }, [view?.id, view?.version, view?.status]);
  useEffect(() => {
    if (!view || flow.phase === 'error' || resource.error) return;
    if (
      view.status !== 'in_progress' &&
      !(
        view.status === 'ready' &&
        (!view.preparation || ['ready', 'fallback'].includes(view.preparation.status))
      )
    )
      return;
    let alive = true;
    void flow
      .enter(view)
      .then((next) => {
        if (alive) router.replace(flow.roomPath(next));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [
    view?.id,
    view?.version,
    view?.status,
    view?.preparation?.status,
    flow.phase,
    resource.error,
  ]);
  return (
    <PreparationScreen
      view={view}
      error={resource.error || command.error}
      refresh={() => void resource.refresh()}
    />
  );
}
export default function InterviewPreparation({ id }: { id: string }) {
  return (
    <SessionGate>
      <PreparationBody id={id} />
    </SessionGate>
  );
}
