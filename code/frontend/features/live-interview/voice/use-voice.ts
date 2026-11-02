'use client';
import { useEffect, useRef, useState } from 'react';
import type { Interview, VoiceCapabilities, VoiceServerEvent } from '@interviewlab/core';
import { apiRequest } from '../../../lib/api/http';
import { RealtimeVoiceClient } from './client';

export function useInterviewVoice(options: {
  id: string;
  view: Interview | null;
  draft: string;
  onDraft: (text: string) => void;
  onView: (view: Interview) => void;
}) {
  const latest = useRef(options);
  latest.current = options;
  const client = useRef<RealtimeVoiceClient | null>(null);
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
  const modeInitialized = useRef(false);
  useEffect(() => {
    if (!options.view || modeInitialized.current) return;
    modeInitialized.current = true;
    setDisplay(options.view.configuration.interaction_mode === 'realtime_voice');
  }, [options.view]);
  const pending = useRef<{ turn: string; text: string; expected: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<VoiceCapabilities>(`/interviews/${options.id}/voice/capabilities`, {
      signal: controller.signal,
    })
      .then(setCapabilities)
      .catch(() => {
        if (!controller.signal.aborted) setError('无法检查语音服务，请确认后端连接正常。');
      });
    return () => {
      controller.abort();
      client.current?.stop();
      client.current = null;
    };
  }, [options.id]);
  function stop() {
    client.current?.stop();
    client.current = null;
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
      client.current?.stop();
      client.current = null;
      setActive(false);
      setConnecting(false);
      setPlaying(false);
      setTalking(false);
      setHold(false);
    }
  }, [status]);
  async function start() {
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
    const connection = new RealtimeVoiceClient(
      options.id,
      (event: VoiceServerEvent) => {
        if (client.current !== connection) return;
        if (event.type === 'ready') {
          setConnecting(false);
          setError('');
        }
        if (event.type === 'transcript') {
          latest.current.onDraft(event.text);
        }
        if (event.type === 'submitting') {
          const turn = latest.current.view?.turns.at(-1);
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
            if (latest.current.draft === submitted.text) latest.current.onDraft('');
            pending.current = null;
          }
        }
        if (event.type === 'status') setThinking(event.state === 'thinking');
        if (event.type === 'error') setError(event.message);
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
    try {
      await connection.start();
    } catch (e) {
      if (client.current === connection) {
        stop();
        setError(e instanceof Error ? e.message : '无法启动实时语音。');
      }
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
    start,
    stop,
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
        ? '面试官正在说话，开口即可打断'
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
