import type { SessionRepository } from '@interviewlab/core';
export interface AuthContext {
  owner_id: string;
}
export interface BackendServices {
  authenticate(request: Request): Promise<AuthContext>;
  sessions: SessionRepository;
}
