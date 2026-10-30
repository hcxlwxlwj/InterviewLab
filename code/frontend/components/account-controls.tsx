'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from './session-provider';
import { authClient } from '../lib/api/auth';
import { Button } from './ui/button';

export function AccountControls() {
  const { state, refresh, isDevelopment } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (isDevelopment) return null;
  if (state.status !== 'signed_in')
    return (
      <Link href="/login" className="text-link">
        登录 / 注册
      </Link>
    );
  return (
    <>
      <Link href="/me" className="text-link">
        {state.session.user.name}
      </Link>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await authClient.signOut();
            router.replace('/');
            await refresh();
          } catch {
            setError('退出失败，请稍后重试。');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? '正在退出…' : '退出登录'}
      </Button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
