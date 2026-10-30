'use client';
import { useState } from 'react';
import { authClient } from '../lib/api/auth';
import { ApiClientError } from '../lib/api/http';
import { useSession } from './session-provider';
import { Button } from './ui/button';

export function AuthForm({ onSuccess }: { onSuccess?: () => void }) {
  const { state, refresh } = useSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get('password'));
    if (mode === 'register' && password !== values.get('confirmation')) {
      setMessage('两次输入的密码不一致。');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const email = String(values.get('email')).trim();
      if (mode === 'register')
        await authClient.signUp({ email, password, name: String(values.get('name')).trim() });
      else
        await authClient.signIn({ email, password, rememberMe: values.get('remember') === 'on' });
      form.reset();
      const session = await refresh();
      if (!session) {
        setMessage('操作已完成，但无法确认登录状态。请重试登录或重新连接。');
        return;
      }
      onSuccess?.();
    } catch (error) {
      setMessage(
        error instanceof ApiClientError && error.status === 401
          ? '邮箱或密码不正确。'
          : error instanceof ApiClientError && error.status === 429
            ? '操作过于频繁，请稍后重试。'
            : error instanceof Error
              ? error.message
              : '操作失败，请重试。',
      );
    } finally {
      setBusy(false);
    }
  }
  if (state.status === 'unavailable' || state.status === 'error')
    return (
      <div role="alert">
        <p>账号服务暂时不可用，请检查服务配置或稍后重试。</p>
        <Button onClick={() => void refresh()}>重新连接</Button>
      </div>
    );
  return (
    <>
      <div className="row-actions" role="group" aria-label="账号操作">
        <Button
          type="button"
          variant={mode === 'login' ? 'default' : 'outline'}
          disabled={busy}
          aria-pressed={mode === 'login'}
          onClick={() => {
            setMode('login');
            setMessage('');
          }}
        >
          登录
        </Button>
        <Button
          type="button"
          variant={mode === 'register' ? 'default' : 'outline'}
          disabled={busy}
          aria-pressed={mode === 'register'}
          onClick={() => {
            setMode('register');
            setMessage('');
          }}
        >
          注册
        </Button>
      </div>
      <form key={mode} onSubmit={submit} className="auth-form">
        {mode === 'register' && (
          <label>
            显示名
            <input
              name="name"
              autoComplete="nickname"
              minLength={1}
              maxLength={100}
              required
              disabled={busy}
            />
          </label>
        )}
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
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={mode === 'register' ? 12 : 1}
            maxLength={128}
            required
            disabled={busy}
          />
        </label>
        {mode === 'register' ? (
          <>
            <label>
              确认密码
              <input
                name="confirmation"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                disabled={busy}
              />
            </label>
            <p className="muted">
              密码为 12–128 字符。本阶段邮箱未经验证，请确认填写正确；暂不支持找回密码。
            </p>
          </>
        ) : (
          <label className="row-actions">
            <input name="remember" type="checkbox" disabled={busy} />
            记住登录状态
          </label>
        )}
        <Button type="submit" disabled={busy || state.status === 'loading'}>
          {busy ? '正在处理…' : mode === 'register' ? '注册并登录' : '登录账号'}
        </Button>
      </form>
      {message && <p role="alert">{message}</p>}
    </>
  );
}
