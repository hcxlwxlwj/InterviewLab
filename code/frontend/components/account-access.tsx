'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { businessTarget, requiresLogin } from '../lib/access';
import { useSession } from './session-provider';
import { AuthForm } from './auth-form';
import { Header, Loading, Modal } from './shared';
import { Button } from './ui/button';

export function AccountAccess({ children }: { children: React.ReactNode }) {
  const { state, refresh } = useSession();
  const path = usePathname();
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  const protectedPage = requiresLogin(path);
  useEffect(() => {
    if (protectedPage && state.status === 'signed_out') {
      setTarget(
        businessTarget(window.location.pathname + window.location.search + window.location.hash) ??
          '/me',
      );
      router.replace('/');
    }
  }, [protectedPage, path, state.status, router]);
  useEffect(() => {
    if (target && state.status === 'signed_in' && path === '/') {
      setTarget(null);
      router.push(target);
    }
  }, [target, state.status, path, router]);
  const content =
    !protectedPage || state.status === 'signed_in' ? (
      children
    ) : state.status === 'loading' || state.status === 'signed_out' ? (
      <>
        <Header />
        <main id="main-content" className="container section">
          <Loading />
        </main>
      </>
    ) : (
      <>
        <Header />
        <main id="main-content" className="container section">
          <p role="alert">无法确认登录状态，业务内容暂不可用。</p>
          <Button onClick={() => void refresh()}>重新连接</Button>
        </main>
      </>
    );
  return (
    <div
      onClickCapture={(event) => {
        if (
          state.status === 'signed_in' ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const anchor = (event.target as Element).closest('a[href]');
        if (
          !(anchor instanceof HTMLAnchorElement) ||
          anchor.target === '_blank' ||
          anchor.hasAttribute('download')
        )
          return;
        const url = new URL(anchor.href);
        if (url.origin !== window.location.origin) return;
        const next = businessTarget(url.pathname + url.search + url.hash);
        if (!next && (url.pathname !== '/login' || path !== '/')) return;
        event.preventDefault();
        event.stopPropagation();
        setTarget(next ?? '/me');
      }}
    >
      <div key={state.status === 'signed_in' ? state.session.user.id : 'guest'}>{content}</div>
      <Modal
        open={Boolean(target) && path === '/' && state.status !== 'signed_in'}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title="登录或注册"
        description="登录后使用当前账号的真实面试和记录。"
      >
        {state.status === 'loading' ? <Loading /> : <AuthForm />}
      </Modal>
    </div>
  );
}
