'use client';
import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '../../lib/api/auth';
import { ApiClientError } from '../../lib/api/http';
import { useSession } from '../../components/session-provider';
import { Footer, Header } from '../../components/shared';
import { Button } from '../../components/ui/button';

export default function LoginPage() {
  const { state, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setMessage('');
    try {
      await authClient.signIn({
        email: String(values.get('email')),
        password: String(values.get('password')),
        rememberMe: values.get('remember') === 'on',
      });
      form.reset();
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof ApiClientError && error.status === 401
          ? '邮箱或密码不正确。'
          : error instanceof Error
            ? error.message
            : '登录失败，请重试。',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Header />
      <main id="main-content" className="container section">
        <section className="library-panel auth-panel">
          <h1>账号登录</h1>
          {state.status === 'loading' ? (
            <p role="status">正在读取登录状态…</p>
          ) : state.status === 'signed_in' ? (
            <>
              <p>已登录：{state.session.user.name}</p>
              <Button
                disabled={busy}
                variant="outline"
                onClick={async () => {
                  setBusy(true);
                  setMessage('');
                  try {
                    await authClient.signOut();
                    await refresh();
                  } catch {
                    setMessage('退出失败，请稍后重试。');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                退出登录
              </Button>
            </>
          ) : state.status === 'unavailable' || state.status === 'error' ? (
            <>
              <p role="alert">
                {state.status === 'unavailable' ? '账号登录暂未开放。' : '暂时无法连接登录服务。'}
              </p>
              <Button variant="outline" onClick={() => void refresh()}>
                重新连接
              </Button>
            </>
          ) : (
            <form onSubmit={submit} className="auth-form">
              <p>使用管理员提供的受邀账号登录。</p>
              <label>
                邮箱
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  maxLength={254}
                  required
                  disabled={busy}
                />
              </label>
              <label>
                密码
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  maxLength={128}
                  required
                  disabled={busy}
                />
              </label>
              <label className="row-actions">
                <input name="remember" type="checkbox" disabled={busy} />
                记住登录状态
              </label>
              <Button type="submit" disabled={busy}>
                {busy ? '正在登录…' : '登录'}
              </Button>
            </form>
          )}
          {message && <p role="alert">{message}</p>}
          <p className="muted">演示页面中的练习资料仍保留在当前标签页，登录不会自动上传。</p>
          <Link href="/" className="text-link">
            返回首页
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
