'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '../../components/session-provider';
import { Header, Loading } from '../../components/shared';
import { ApiClientError } from '../../lib/api/http';
import { Button } from '../../components/ui/button';

export function LiveFrame({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <>
      <Header />
      <main id="main-content" className="container page-body live-page">
        <div className="live-heading">
          <div>
            <span className="eyebrow">真实文字面试</span>
            <h1>{title}</h1>
          </div>
          <nav aria-label="面试导航">
            <Link href="/interview/setup">新建面试</Link>
            <Link href="/me/interviews">面试记录</Link>
          </nav>
        </div>
        <SessionGate>{children}</SessionGate>
      </main>
    </>
  );
}
export function SessionGate({ children }: { children: React.ReactNode }) {
  const { state, refresh } = useSession();
  return state.status === 'loading' ? (
    <Loading />
  ) : state.status === 'signed_in' ? (
    <div key={state.session.user.id}>{children}</div>
  ) : (
    <section className="panel live-state">
      <h2>{state.status === 'signed_out' ? '登录后开始练习' : '暂时无法读取登录状态'}</h2>
      <p>{state.status === 'signed_out' ? '真实面试记录保存在你的账号中。' : state.error}</p>
      <Link className="text-link" href="/login">
        前往账号登录
      </Link>
      <Button variant="outline" onClick={() => void refresh()}>
        重新检查
      </Button>
      <p></p>
    </section>
  );
}
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return message ? (
    <div className="error-inline" role="alert">
      <p>{message}</p>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          重试
        </Button>
      )}
    </div>
  ) : null;
}
/** One in-flight read; mutations invalidate earlier reads, and polling stops on error. */
export function useLiveResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  pending: (value: T) => boolean,
) {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const active = useRef<AbortController | null>(null);
  const pendingState = value !== null && pending(value);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const refresh = useCallback(async () => {
    const seq = ++sequence.current;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    try {
      const next = await load(controller.signal);
      if (seq === sequence.current) {
        setValue(next);
        setError('');
      }
    } catch (e) {
      if (!controller.signal.aborted && seq === sequence.current)
        setError(e instanceof Error ? e.message : '读取失败');
    }
  }, [load]);
  const accept = useCallback((next: T) => {
    sequence.current++;
    active.current?.abort();
    setValue(next);
    setError('');
  }, []);
  useEffect(() => {
    setValue(null);
    void refresh();
    return () => {
      sequence.current++;
      active.current?.abort();
    };
  }, [refresh]);
  useEffect(() => {
    if (!value || error || !pendingRef.current(value)) return;
    const timer = setTimeout(() => void refresh(), 1000);
    return () => clearTimeout(timer);
  }, [value, error, refresh, pendingState]);
  useEffect(() => {
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [refresh]);
  return { value, error, refresh, accept };
}
/** Retains the exact request and idempotency key after an ambiguous transport failure. */
export function useLiveCommand(onConflict?: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unresolved, setUnresolved] = useState(false);
  const pending = useRef<(() => Promise<void>) | null>(null);
  const alive = useRef(true);
  const lock = useRef(false);
  const conflict = useRef(onConflict);
  conflict.current = onConflict;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function execute() {
    if (lock.current || !pending.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await pending.current();
      pending.current = null;
      if (alive.current) setUnresolved(false);
    } catch (e) {
      if (!alive.current) return;
      const ambiguous =
        e instanceof ApiClientError &&
        (e.status === 0 || e.status >= 500 || e.detail.code === 'invalid_response');
      if (!ambiguous) pending.current = null;
      if (e instanceof ApiClientError && e.status === 409) conflict.current?.();
      setUnresolved(Boolean(ambiguous));
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function run<T>(send: (key: string) => Promise<T>, success: (result: T) => void) {
    if (lock.current || pending.current) return;
    const key = crypto.randomUUID();
    pending.current = async () => {
      const result = await send(key);
      if (alive.current) success(result);
    };
    void execute();
  }
  return { busy, error, unresolved, run, retry: () => void execute(), blocked: busy || unresolved };
}
export function CommandNotice({
  command,
  refresh,
}: {
  command: ReturnType<typeof useLiveCommand>;
  refresh?: () => void;
}) {
  return (
    <>
      {command.error && (
        <ErrorNotice
          message={
            command.unresolved
              ? `${command.error} 上次操作的结果尚未确认，请重试原操作。`
              : command.error
          }
          retry={command.unresolved ? command.retry : refresh}
        />
      )}
    </>
  );
}
