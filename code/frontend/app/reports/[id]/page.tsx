'use client';
import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import LiveReport from '../../../features/live-interview/report';
function Entry() { return <LiveReport id={useParams<{ id: string }>().id} />; }
export default function Page() { return <Suspense><Entry /></Suspense>; }
