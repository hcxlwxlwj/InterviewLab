import { redirect } from 'next/navigation';
import LiveSetup from '../../../features/live-interview/setup';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ job?: string | string[] }>;
}) {
  const { job } = await searchParams;
  if (Array.isArray(job)) redirect('/jobs');
  return <LiveSetup jobId={job?.trim() || undefined} />;
}
