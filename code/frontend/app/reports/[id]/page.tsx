'use client';
import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Demo from './demo';
import LiveReport from '../../../features/live-interview/report';
function Entry() {
  const { id } = useParams<{ id: string }>();
  return useSearchParams().get('demo') === '1' ? <Demo /> : <LiveReport id={id} />;
}
export default function Page() {
  return (
    <Suspense>
      <Entry />
    </Suspense>
  );
}
