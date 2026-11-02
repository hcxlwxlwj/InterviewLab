'use client';
import { useParams } from 'next/navigation';
import LiveInterview from '../../../../features/live-interview/interview';
import '../../../../features/video-interview/room.css';
export default function VideoInterviewPage() {
  const { id } = useParams<{ id: string }>();
  return <LiveInterview id={id} videoRoom />;
}
