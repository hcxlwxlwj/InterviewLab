'use client';
import { useEffect, useRef, useState } from 'react';
import type { Interview, VoiceCapabilities, VoiceServerEvent } from '@interviewlab/core';
import { apiRequest } from '../../../lib/api/http';
import { RealtimeVoiceClient } from './client';
import type { PreparedVoiceDevices } from './devices';

export interface UnsubmittedVoiceSupplement {
  turn_id: string | null;
  question: string | null;
  text: string;
}
export function routeVoiceTranscript(
  event: Extract<VoiceServerEvent, { type: 'transcript' }>,
  view: Pick<Interview, 'turns'> | null,
  onDraft: (text: string) => void,
  preserve: (supplement: UnsubmittedVoiceSupplement) => void,
) {
  if (event.turn_id && event.turn_id === view?.turns.at(-1)?.id) {
    onDraft(event.text);
  } else if (event.text.trim()) {
    preserve({
      turn_id: event.turn_id,
      question: view?.turns.find((turn) => turn.id === event.turn_id)?.text ?? null,
      text: event.text,
    });
  }
}

export function useInterviewVoice(options: {
  id: string;
  view: Interview | null;
  draft: string;
  onDraft: (text: string) => void;
  onView: (view: Interview) => void;
}) {
  const latest = useRef(options);
  latest.current = options;
  const confirmedView = useRef(options.view);
  if (
    !confirmedView.current ||
    !options.view ||
    options.view.id !== confirmedView.current.id ||
    options.view.version >= confirmedView.current.version
  )
    confirmedView.current = options.view;
  const client = useRef<RealtimeVoiceClient | null>(null);
  const clientId = useRef('');
  const prepared = useRef<Promise<void> | null>(null);
  const [capabilities, setCapabilities] = useState<VoiceCapabilities | null>(null);
  const [active, setActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [talking, setTalking] = useState(false);
  const [hold, setHold] = useState(false);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [display, setDisplay] = useState(false);
  const [supplements, setSupplements] = useState<UnsubmittedVoiceSupplement[]>([]);
  useEffect(() => {
    setSupplements([]);
  }, [options.id]);
  const modeInitialized = useRef('');
  useEffect(() => {
    if (!options.view || modeInitialized.current === options.view.id) return;
    modeInitialized.current = options.view.id;
    setDisplay(options.view.configuration.interaction_mode === 'realtime_voice');
  }, [options.view]);
  const pending = useRef<{ turn: string; text: string; expected: string } | null>(null);
  useEffect(() => {
    if (!options.id) return;
    const effectId = options.id;
    const controller = new AbortController();
    void apiRequest<VoiceCapabilities>(`/interviews/${options.id}/voice/capabilities`, {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setCapabilities(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('无法检查语音服务，请确认后端连接正常。');
      });
    return () => {
      controller.abort();
      if (clientId.current === effectId) {
        client.current?.stop();
        client.current = null;
        prepared.current = null;
      }
    };
  }, [options.id]);
  function stop() {
    client.current?.stop();
    client.current = null;
    prepared.current = null;
    clientId.current = '';
    setActive(false);
    setConnecting(false);
    setPlaying(false);
    setThinking(false);
    setTalking(false);
    setHold(false);
    setMuted(false);
  }
  const status = options.view?.status;
  useEffect(() => {
    if (status && !['ready', 'in_progress'].includes(status)) {
      stop();
    }
  }, [status]);
  function createConnection(id: string) {
    const connection = new RealtimeVoiceClient(
      id,
      (event: VoiceServerEvent) => {
        if (client.current !== connection) return;
        if (event.type === 'ready') {
          setConnecting(false);
          setError('');
        }
        if (event.type === 'transcript') {
          routeVoiceTranscript(
            event,
            confirmedView.current,
            latest.current.onDraft,
            (supplement) => {
              // ASR partial/final events are cumulative text for the same captured turn.
              setSupplements((current) => [
                ...current.filter((entry) => entry.turn_id !== supplement.turn_id),
                supplement,
              ]);
            },
          );
        }
        if (event.type === 'submitting') {
          const turn = confirmedView.current?.turns.at(-1);
          pending.current = {
            turn: event.turn_id,
            text: event.text,
            expected:
              turn?.answer_status === 'answered'
                ? [turn.answer_text, event.text].filter(Boolean).join('\n')
                : event.text,
          };
          setThinking(true);
          setTalking(false);
        }
        if (event.type === 'interview') {
          const submitted = pending.current;
          const previousTurn = confirmedView.current?.turns.at(-1)?.id;
          // The next transcript can arrive before React renders this interview event.
          if (!confirmedView.current || event.interview.version >= confirmedView.current.version)
            confirmedView.current = event.interview;
          latest.current.onView(event.interview);
          if (
            submitted &&
            event.interview.turns.some(
              (t) =>
                t.id === submitted.turn &&
                t.answer_status === 'answered' &&
                t.answer_text === submitted.expected,
            )
          ) {
            if (previousTurn === submitted.turn && latest.current.draft === submitted.text)
              latest.current.onDraft('');
            pending.current = null;
          }
        }
        if (event.type === 'status') setThinking(event.state === 'thinking');
        if (event.type === 'error' && event.code !== 'voice_previous_draft')
          setError(event.message);
      },
      setPlaying,
      () => {
        if (client.current !== connection) return;
        stop();
        setError((previous) => previous || '语音连接已关闭，草稿仍保留，可重新连接或使用文字。');
      },
      setTalking,
    );
    client.current = connection;
    clientId.current = id;
    return connection;
  }
  async function start(beforeConnect?: () => Promise<void>) {
    if (client.current) return;
    if (latest.current.draft.trim()) {
      setError('当前有未提交的文字草稿，请先提交或清空，再开启实时语音。');
      return;
    }
    setError('');
    setDisplay(true);
    setConnecting(true);
    setActive(true);
    pending.current = null;
    const connection = createConnection(latest.current.id);
    try {
      await connection.start(beforeConnect);
    } catch (e) {
      if (client.current === connection) {
        stop();
        setError(e instanceof Error ? e.message : '无法启动实时语音。');
      }
    }
  }
  async function prepareFor(id: string, devices: PreparedVoiceDevices) {
    if (client.current && clientId.current === id && prepared.current) return prepared.current;
    stop();
    setError('');
    setDisplay(true);
    const connection = createConnection(id);
    const work = (async () => {
      const available = await apiRequest<VoiceCapabilities>(`/interviews/${id}/voice/capabilities`);
      if (client.current !== connection) throw new Error('设备准备已取消。');
      setCapabilities(available);
      if (!available.available)
        throw new Error(available.reason || '当前语音服务不可用，可改用文字。');
      await connection.prepare(devices);
    })();
    prepared.current = work;
    try {
      await work;
    } catch (e) {
      const isCurrent = client.current === connection;
      if (isCurrent) stop();
      const message = e instanceof Error ? e.message : '设备检查失败，请重试。';
      if (isCurrent) setError(message);
      throw new Error(message);
    }
  }
  async function connectPrepared(beforeConnect?: () => Promise<void>) {
    const connection = client.current;
    if (!connection || !prepared.current) throw new Error('请先完成设备检查。');
    await prepared.current;
    setError('');
    setDisplay(true);
    setConnecting(true);
    setActive(true);
    try {
      await connection.connect(beforeConnect);
    } catch (e) {
      if (client.current === connection) stop();
      const message = e instanceof Error ? e.message : '语音连接失败，请重试。';
      setError(message);
      throw new Error(message);
    }
  }
  return {
    getOutputLevel: () => client.current?.getOutputLevel() ?? 0,
    capabilities,
    display,
    muted,
    sessionStatus: status,
    turns: options.view?.turns ?? [],
    draft: options.draft,
    active,
    connecting,
    playing,
    thinking,
    talking,
    hold,
    error,
    supplements,
    dismissSupplement(turnId: string | null) {
      setSupplements((current) => current.filter((entry) => entry.turn_id !== turnId));
    },
    start,
    stop,
    suspend() {
      const connection = client.current;
      if (!connection) return () => {};
      connection.send({ type: 'hold', enabled: true });
      connection.setMuted(true);
      setHold(true);
      setMuted(true);
      return () => {
        if (client.current !== connection) return;
        connection.send({ type: 'hold', enabled: hold });
        connection.setMuted(muted);
        setHold(hold);
        setMuted(muted);
      };
    },
    prepareFor,
    connectPrepared,
    switchToText() {
      stop();
      setDisplay(false);
    },
    toggleMute() {
      client.current?.setMuted(!muted);
      setMuted(!muted);
    },
    status: connecting
      ? '正在连接语音…'
      : playing
        ? '面试官正在说话，麦克风暂时关闭'
        : thinking
          ? '面试官正在思考，可继续补充'
          : talking
            ? '正在转写，停顿后将自动提交'
            : '正在听，你可以直接说话',
    commit() {
      setHold(false);
      client.current?.send({ type: 'commit' });
    },
    interrupt() {
      client.current?.interrupt();
      setPlaying(false);
    },
    repeat() {
      client.current?.send({ type: 'repeat' });
    },
    toggleHold() {
      setHold(!hold);
      client.current?.send({ type: 'hold', enabled: !hold });
    },
  };
}
