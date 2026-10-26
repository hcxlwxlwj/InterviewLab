'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Demo from './demo';
import LiveHistory from '../../../features/live-interview/history';
function Entry() {
  return useSearchParams().get('demo') === '1' ? <Demo /> : <LiveHistory />;
}
export default function Page() {
  return (
    <Suspense>
      <Entry />
    </Suspense>
  );
}
