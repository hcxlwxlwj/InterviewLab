'use client';
import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import LiveReport from '../../../../features/live-interview/report';
function Entry() {
  const { id } = useParams<{ id: string }>();
  return <LiveReport id={id} practice />;
}
export default function Page() {
  return (
    <Suspense>
      <Entry />
    </Suspense>
  );
}
