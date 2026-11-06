'use client';
import { useParams } from 'next/navigation';
import InterviewPreparation from '../../../../features/live-interview/preparation';

export default function PreparePage() {
  return <InterviewPreparation id={useParams<{ id: string }>().id} />;
}
