'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Interview, InterviewConfig } from '@interviewlab/core';
import { useSession } from '../../components/session-provider';
import { startPreparedInterview, type StartRequest } from './start-request';
import { interviewsApi } from '../../lib/api/interviews';
import { useInterviewVoice } from './voice/use-voice';
import {
  prepareVoiceDevices,
  releaseVoiceDevices,
  type PreparedVoiceDevices,
} from './voice/devices';

type Phase = 'idle' | 'devices' | 'creating' | 'preparing' | 'connecting' | 'running' | 'error';
interface FlowState {
  phase: Phase;
  view: Interview | null;
  configuration: InterviewConfig | null;
  error: string;
  deviceReady: boolean;
  camera: MediaStream | null;
  textMode: boolean;
}
const initial: FlowState = {
  phase: 'idle',
  view: null,
  configuration: null,
  error: '',
  deviceReady: false,
  camera: null,
  textMode: false,
};
type Binding = {
  id: string;
  draft: string;
  onDraft: (text: string) => void;
  onView: (view: Interview) => void;
};

export function InterviewFlowProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { state: account } = useSession();
  const owner = account.status === 'signed_in' ? account.session.user.id : '';
  const [state, setState] = useState<FlowState>(initial);
  const current = useRef(state);
  const binding = useRef<Binding | null>(null);
  const [draft, setDraft] = useState('');
  const devices = useRef<PreparedVoiceDevices | null>(null);
  const deviceWork = useRef<Promise<PreparedVoiceDevices> | null>(null);
  const enterWork = useRef<Promise<Interview> | null>(null);
  const createWork = useRef<Promise<void> | null>(null);
  const creation = useRef<{ config: InterviewConfig; key: string } | null>(null);
  const startRequest = useRef<StartRequest | null>(null);
  const epoch = useRef(0);
  const abandoned = useRef(new Set<string>());
  const alive = useRef(true);
  function update(patch: Partial<FlowState>) {
    current.current = { ...current.current, ...patch };
    if (alive.current) setState(current.current);
  }
  function accept(view: Interview) {
    if (abandoned.current.has(view.id)) return;
    if (current.current.view?.id === view.id && current.current.view.version > view.version) return;
    update({ view, configuration: view.configuration });
    if (binding.current?.id === view.id) binding.current.onView(view);
  }
  const voice = useInterviewVoice({
    id: state.view?.id ?? '',
    view:
      state.textMode && state.view
        ? {
            ...state.view,
            configuration: { ...state.view.configuration, interaction_mode: 'text_fallback' },
          }
        : state.view,
    draft,
    onDraft: (text) => {
      setDraft(text);
      binding.current?.onDraft(text);
    },
    onView: accept,
  });
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  function clearDevices() {
    voiceRef.current.stop();
    current.current.camera?.getTracks().forEach((track) => track.stop());
    if (devices.current) releaseVoiceDevices(devices.current);
    devices.current = null;
    deviceWork.current = null;
    update({ camera: null, deviceReady: false });
  }
  function release() {
    epoch.current++;
    clearDevices();
    enterWork.current = null;
    update({ camera: null, deviceReady: false });
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      release();
    };
  }, []);
  const previousOwner = useRef(owner);
  useEffect(() => {
    if (previousOwner.current !== owner) {
      previousOwner.current = owner;
      release();
      creation.current = null;
      startRequest.current = null;
      binding.current = null;
      update(initial);
    }
  }, [owner]);

  function prepareDevices(config: InterviewConfig): Promise<PreparedVoiceDevices | null> {
    if (config.interaction_mode === 'text_fallback' || current.current.textMode) {
      update({ deviceReady: true });
      return Promise.resolve(null);
    }
    if (
      devices.current?.context.state !== 'closed' &&
      devices.current?.media.getAudioTracks().some((t) => t.readyState !== 'ended')
    )
      return Promise.resolve(devices.current);
    if (deviceWork.current) return deviceWork.current;
    const generation = epoch.current;
    // This call starts AudioContext.resume in the original submit/retry gesture.
    const work = prepareVoiceDevices(config.interaction_mode === 'realtime_video').then(
      (result) => {
        if (generation !== epoch.current || !alive.current) {
          releaseVoiceDevices(result);
          throw new Error('本次准备已取消。');
        }
        result.camera?.getVideoTracks().forEach((t) => {
          t.enabled = false;
        });
        devices.current = result;
        update({ camera: result.camera });
        return result;
      },
    );
    deviceWork.current = work;
    void work.catch(() => {
      if (deviceWork.current === work) deviceWork.current = null;
    });
    return work;
  }
  async function prepareSession(view: Interview) {
    const generation = epoch.current;
    const prepared = await prepareDevices(view.configuration);
    if (generation !== epoch.current || !alive.current) throw new Error('本次准备已取消。');
    if (prepared) await voiceRef.current.prepareFor(view.id, prepared);
    if (generation !== epoch.current || !alive.current) throw new Error('本次准备已取消。');
    update({ deviceReady: true });
  }
  async function startOnce(view: Interview): Promise<Interview> {
    const generation = epoch.current;
    const next = await startPreparedInterview(view.id, {
      request: startRequest,
      storageKey: `interviewlab:start:${owner}:${view.id}`,
      isCurrent: () => generation === epoch.current && alive.current,
    });
    accept(next);
    return next;
  }
  async function enter(view: Interview): Promise<Interview> {
    if (abandoned.current.has(view.id)) throw new Error('本次准备已取消。');
    if (current.current.view?.id === view.id && current.current.view.version > view.version)
      view = current.current.view;
    if (enterWork.current) return enterWork.current;
    if (current.current.phase === 'running' && current.current.view?.id === view.id)
      return current.current.view;
    const generation = epoch.current;
    const work = (async () => {
      accept(view);
      update({ error: '', phase: 'preparing' });
      if (!['ready', 'in_progress'].includes(view.status))
        throw new Error('本场面试暂不能自动开始。');
      await prepareSession(view);
      if (generation !== epoch.current) throw new Error('本次准备已取消。');
      update({ phase: 'connecting' });
      if (current.current.textMode || view.configuration.interaction_mode === 'text_fallback')
        await startOnce(view);
      else
        await voiceRef.current.connectPrepared(async () => {
          await startOnce(view);
        });
      if (generation !== epoch.current) throw new Error('本次准备已取消。');
      devices.current?.camera?.getVideoTracks().forEach((t) => {
        t.enabled = true;
      });
      update({ phase: 'running' });
      return current.current.view!;
    })();
    enterWork.current = work;
    try {
      return await work;
    } catch (error) {
      if (generation === epoch.current) {
        clearDevices();
        update({
          phase: 'error',
          deviceReady: false,
          camera: null,
          error: error instanceof Error ? error.message : '面试准备失败，请重试。',
        });
      }
      throw error;
    } finally {
      if (enterWork.current === work) enterWork.current = null;
    }
  }
  function begin(config: InterviewConfig): Promise<void> {
    if (createWork.current) return createWork.current;
    if (
      current.current.view ||
      !creation.current ||
      JSON.stringify(creation.current.config) !== JSON.stringify(config)
    ) {
      release();
      creation.current = { config, key: crypto.randomUUID() };
      try {
        const saved = JSON.parse(sessionStorage.getItem(`interviewlab:create:${owner}`) ?? 'null');
        if (
          typeof saved?.key === 'string' &&
          JSON.stringify(saved.config) === JSON.stringify(config)
        )
          creation.current.key = saved.key;
      } catch {}
      update({ view: null, textMode: false });
      setDraft('');
    }
    const request = creation.current;
    const generation = epoch.current;
    try {
      sessionStorage.setItem(`interviewlab:create:${owner}`, JSON.stringify(request));
    } catch {}
    update({ configuration: config, error: '', phase: 'devices' });
    const devicePromise = prepareDevices(config);
    const work = (async () => {
      try {
        await devicePromise;
        if (generation !== epoch.current || !alive.current) return;
        update({ phase: 'creating' });
        const view = await interviewsApi.create(request.config, request.key);
        if (generation !== epoch.current || !alive.current) return;
        abandoned.current.delete(view.id);
        try {
          sessionStorage.removeItem(`interviewlab:create:${owner}`);
        } catch {}
        accept(view);
        update({ phase: 'preparing' });
        router.push(`/interview/${view.id}/prepare`);
        void prepareSession(view).catch((error) => {
          if (generation !== epoch.current || !alive.current) return;
          clearDevices();
          update({
            phase: 'error',
            error: error instanceof Error ? error.message : '设备检查失败。',
          });
        });
      } catch (error) {
        if (generation !== epoch.current || !alive.current) return;
        clearDevices();
        update({
          phase: 'error',
          camera: null,
          deviceReady: false,
          error: error instanceof Error ? error.message : '面试创建失败，请重试。',
        });
      }
    })();
    createWork.current = work;
    void work.finally(() => {
      if (createWork.current === work) createWork.current = null;
    });
    return work;
  }
  function useText() {
    release();
    update({
      textMode: true,
      deviceReady: true,
      error: '',
      phase: current.current.view ? 'preparing' : 'idle',
    });
    voiceRef.current.switchToText();
  }
  function abandon() {
    if (current.current.view) abandoned.current.add(current.current.view.id);
    release();
    creation.current = null;
    startRequest.current = null;
    createWork.current = null;
    update({ ...initial, configuration: current.current.configuration });
  }
  const value = {
    ...state,
    voice,
    begin,
    enter,
    accept,
    release,
    useText,
    abandon,
    busy: !['idle', 'error', 'running'].includes(state.phase),
    isAbandoned(id: string) {
      return abandoned.current.has(id);
    },
    retry(view?: Interview) {
      if (view) {
        abandoned.current.delete(view.id);
        accept(view);
      }
      update({ error: '', phase: 'preparing' });
      const config = current.current.configuration;
      if (config) {
        const generation = epoch.current;
        void prepareDevices(config).catch((error) => {
          if (generation !== epoch.current) return;
          clearDevices();
          update({
            phase: 'error',
            error: error instanceof Error ? error.message : '设备检查失败。',
          });
        });
      }
    },
    bind(next: Binding) {
      binding.current = next;
      setDraft(next.draft);
      return () => {
        if (binding.current === next) binding.current = null;
      };
    },
    setCamera(camera: MediaStream | null) {
      if (devices.current) devices.current.camera = camera;
      update({ camera });
    },
    roomPath(view: Interview) {
      return `/interview/${view.id}${!current.current.textMode && view.configuration.interaction_mode === 'realtime_video' ? '/video' : ''}`;
    },
  };
  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}
interface Flow extends FlowState {
  voice: ReturnType<typeof useInterviewVoice>;
  busy: boolean;
  begin(config: InterviewConfig): Promise<void>;
  enter(view: Interview): Promise<Interview>;
  accept(view: Interview): void;
  release(): void;
  useText(): void;
  abandon(): void;
  retry(view?: Interview): void;
  isAbandoned(id: string): boolean;
  bind(binding: Binding): () => void;
  setCamera(camera: MediaStream | null): void;
  roomPath(view: Interview): string;
}
const FlowContext = createContext<Flow | null>(null);
export function useInterviewFlow() {
  const flow = useContext(FlowContext);
  if (!flow) throw new Error('InterviewFlowProvider is required');
  return flow;
}
export function useOptionalInterviewFlow() {
  return useContext(FlowContext);
}
