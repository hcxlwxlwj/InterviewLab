'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Demo from './demo';
import LiveHistory from '../../../features/live-interview/history';
import { useSession } from '../../../components/session-provider';
import { Loading } from '../../../components/shared';
function Entry() {
  const demo = useSearchParams().get('demo') === '1';
  const { state } = useSession();
  if (demo) return <Demo />;
  if (state.status === 'loading') return <Loading />;
  // Guests can inspect labeled synthetic records; private records still require a session.
  return state.status === 'signed_out' ? <Demo /> : <LiveHistory />;
}
export default function Page() {
  return (
    <Suspense>
      <Entry />
    </Suspense>
  );
}
