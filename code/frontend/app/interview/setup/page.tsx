'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Demo from './demo';
import LiveSetup from '../../../features/live-interview/setup';
function Entry() {
  return useSearchParams().get('demo') === '1' ? <Demo /> : <LiveSetup />;
}
export default function Page() {
  return (
    <Suspense>
      <Entry />
    </Suspense>
  );
}
