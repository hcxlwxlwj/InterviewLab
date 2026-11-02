'use client';
import { memo, useEffect, useRef } from 'react';

/** The room timer and live transcript must not reattach a playing media stream. */
export const MediaPreview = memo(function MediaPreview({
  stream,
  className,
}: {
  stream: MediaStream;
  className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (element.srcObject !== stream) element.srcObject = stream;
    return () => {
      // Track ownership stays with useLocalMedia; detach only this preview.
      if (element.srcObject === stream) element.srcObject = null;
    };
  }, [stream]);
  return <video ref={video} autoPlay muted playsInline className={className} />;
});
