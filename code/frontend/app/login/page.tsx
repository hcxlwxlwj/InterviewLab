'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loginDestination } from '../../lib/access';
import { AuthForm } from '../../components/auth-form';
import { useSession } from '../../components/session-provider';
import { Footer, Header, Loading } from '../../components/shared';
export default function LoginPage() {
  const { state } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (state.status === 'signed_in') {
      router.replace(loginDestination(new URLSearchParams(window.location.search).get('next')));
    }
  }, [state.status, router]);
  return (
    <>
      <Header />
      <main id="main-content" className="container section">
        <section className="library-panel auth-panel">
          <h1>账号登录 / 注册</h1>
          {state.status === 'loading' || state.status === 'signed_in' ? <Loading /> : <AuthForm />}
          <Link href="/" className="text-link">
            返回首页
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
