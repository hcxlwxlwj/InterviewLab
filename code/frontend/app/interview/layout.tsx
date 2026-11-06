import type { ReactNode } from 'react';
import { InterviewFlowProvider } from '../../features/live-interview/flow-provider';

export default function InterviewLayout({ children }: { children: ReactNode }) {
  return <InterviewFlowProvider>{children}</InterviewFlowProvider>;
}
