'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthForm } from '../../components/auth-form';
import { useSession } from '../../components/session-provider';
import { Footer, Header, Loading } from '../../components/shared';
export default function LoginPage() {
  const { state } = useSession();
  const router = useRouter();
  return (
    <>
      <Header />
      <main id="main-content" className="container section">
        <section className="library-panel auth-panel">
          <h1>账号登录 / 注册</h1>
          {state.status === 'loading' ? (
            <Loading />
          ) : state.status === 'signed_in' ? (
            <>
              <p>已登录：{state.session.user.name}</p>
              <Link className="text-link" href="/me">
                进入个人中心
              </Link>
            </>
          ) : (
            <AuthForm onSuccess={() => router.replace('/me')} />
          )}
          <Link href="/" className="text-link">
            返回首页
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
