'use client';
import { Suspense } from 'react';
import LiveSetup from '../../../features/live-interview/setup';
function Entry() { return <LiveSetup />; }
export default function Page() { return <Suspense><Entry /></Suspense>; }
