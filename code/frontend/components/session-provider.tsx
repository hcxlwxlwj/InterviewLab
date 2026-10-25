'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AuthSession } from '@interviewlab/core';
import { authClient } from '../lib/api/auth';
import { ApiClientError, SESSION_CHANGED } from '../lib/api/http';

type SessionState =
  | { status: 'loading'; session: null }
  | { status: 'signed_out'; session: null }
  | { status: 'signed_in'; session: AuthSession }
  | { status: 'unavailable' | 'error'; session: null; error: string };
const SessionContext = createContext<{ state: SessionState; refresh(): Promise<void> } | null>(
  null,
);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null });
  const sequence = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    try {
      const session = await authClient.session(controller.signal);
      if (current === sequence.current)
        setState(
          session ? { status: 'signed_in', session } : { status: 'signed_out', session: null },
        );
    } catch (error) {
      if (current !== sequence.current || controller.signal.aborted) return;
      setState({
        status:
          error instanceof ApiClientError && error.detail.code === 'capability_unavailable'
            ? 'unavailable'
            : 'error',
        session: null,
        error: error instanceof Error ? error.message : '无法读取登录状态。',
      });
    }
  }, []);
  useEffect(() => {
    const update = () => {
      void refresh();
    };
    update();
    window.addEventListener(SESSION_CHANGED, update);
    window.addEventListener('focus', update);
    return () => {
      sequence.current++;
      pending.current?.abort();
      window.removeEventListener(SESSION_CHANGED, update);
      window.removeEventListener('focus', update);
    };
  }, [refresh]);
  return <SessionContext.Provider value={{ state, refresh }}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession requires SessionProvider');
  return context;
}
