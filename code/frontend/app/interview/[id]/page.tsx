'use client';
import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Demo from './demo';
import LiveInterview from '../../../features/live-interview/interview';
function Entry() {
  const { id } = useParams<{ id: string }>();
  return useSearchParams().get('demo') === '1' ? <Demo /> : <LiveInterview id={id} />;
}
export default function Page() {
  return (
    <Suspense>
      <Entry />
    </Suspense>
  );
}
