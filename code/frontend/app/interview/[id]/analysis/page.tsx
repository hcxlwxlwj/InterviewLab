'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import LiveAnalysis from '../../../../features/live-interview/analysis';

function Entry() {
  return <LiveAnalysis id={useParams<{ id: string }>().id} />;
}
export default function Page() {
  return (
    <Suspense>
      <Entry />
    </Suspense>
  );
}
