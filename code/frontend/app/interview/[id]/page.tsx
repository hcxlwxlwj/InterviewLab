'use client';
import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import LiveInterview from '../../../features/live-interview/interview';
function Entry() { return <LiveInterview id={useParams<{ id: string }>().id} />; }
export default function Page() { return <Suspense><Entry /></Suspense>; }
