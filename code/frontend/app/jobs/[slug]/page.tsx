import { notFound } from 'next/navigation';
import { getJob, JOBS } from '@interviewlab/core';
import { JobDetail } from '../../../components/job-library';
export function generateStaticParams() {
  return JOBS.map((j) => ({ slug: j.slug }));
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = getJob(slug);
  if (!job) notFound();
  return <JobDetail job={job} />;
}
