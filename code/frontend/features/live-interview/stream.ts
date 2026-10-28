'use client';
import { useEffect, useState, useRef } from 'react';
import type { Interview, InterviewPreview } from '@interviewlab/core';
import { apiEvents } from '../../lib/api/http';
export function useInterviewStream(
  id: string,
  view: Interview | null,
  accept: (view: Interview) => void,
  refresh: () => Promise<void>,
) {
  const latest = useRef(view);
  latest.current = view;
  const generation = view?.generation_status === 'pending' ? view.generation_id : null;
  const [state, setState] = useState<{
    generation: string | null;
    connected: boolean;
    preview: InterviewPreview | null;
  }>({ generation: null, connected: false, preview: null });
  useEffect(() => {
    if (!generation) return;
    let live = true;
    const events = apiEvents(`/interviews/${id}/events?generation_id=${generation}`);
    const clear = () => {
      if (live) setState({ generation, connected: false, preview: null });
    };
    events.onopen = () => {
      if (live) setState((s) => ({ ...s, generation, connected: true }));
    };
    events.onerror = clear;
    events.addEventListener('question_delta', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (
          live &&
          data.generation_id === generation &&
          typeof data.text === 'string' &&
          typeof data.acknowledgement === 'string'
        )
          setState({
            generation,
            connected: true,
            preview:
              data.text || data.acknowledgement
                ? { text: data.text, acknowledgement: data.acknowledgement }
                : null,
          });
      } catch {
        clear();
      }
    });
    events.addEventListener('committed', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (
          live &&
          latest.current?.generation_id === generation &&
          latest.current.status === 'in_progress' &&
          data.interview?.id === id &&
          data.interview.generation_id === generation &&
          data.interview.version >= latest.current.version
        )
          accept(data.interview);
      } finally {
        clear();
        events.close();
      }
    });
    for (const type of ['failed', 'invalidated'])
      events.addEventListener(type, () => {
        clear();
        events.close();
        if (live) void refresh();
      });
    return () => {
      live = false;
      events.close();
    };
  }, [id, generation, accept, refresh]);
  return generation && state.generation === generation
    ? state
    : { generation, connected: false, preview: null };
}
