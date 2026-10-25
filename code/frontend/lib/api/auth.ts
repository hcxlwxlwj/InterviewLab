import type { AuthSession, SignInInput } from '@interviewlab/core';
import { apiRequest, notifySessionChanged } from './http';

export const authClient = {
  session: (signal?: AbortSignal) => apiRequest<AuthSession | null>('/auth/session', { signal }),
  async signIn(input: SignInInput) {
    await apiRequest<{ success: true }>('/auth/sign-in/email', { method: 'POST', body: input });
    notifySessionChanged();
  },
  async signOut() {
    await apiRequest<{ success: true }>('/auth/sign-out', { method: 'POST', body: {} });
    notifySessionChanged();
  },
};
