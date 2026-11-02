'use client';
import { useEffect, useRef } from 'react';

/** Two-frame portrait animation driven only by currently audible TTS, not microphone input. */
export function InterviewerAvatar({
  getLevel,
  status,
}: {
  getLevel: () => number;
  status: string;
}) {
  const mouth = useRef<HTMLDivElement>(null);
  const input = useRef(getLevel);
  input.current = getLevel;
  useEffect(() => {
    let frame = 0;
    let previous = 0;
    const update = () => {
      const value = Math.max(0, Math.min(1, input.current()));
      previous = value === 0 ? 0 : previous * 0.35 + value * 0.65;
      if (mouth.current) mouth.current.style.opacity = String(Math.min(1, previous * 1.8));
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      className="interviewer-avatar interviewer-avatar-portrait"
      role="img"
      aria-label={`数字人面试官，${status}`}
    >
      <div className="interviewer-portrait-frame" aria-hidden="true" />
      <div
        ref={mouth}
        className="interviewer-portrait-frame interviewer-portrait-mouth"
        aria-hidden="true"
      />
      <div className="interviewer-avatar-caption">
        <strong>技术面试官</strong>
        <span>{status}</span>
      </div>
      <span className="video-room-tile-label">数字人 · 中文男声</span>
    </div>
  );
}
