import type { AuthSession, SignInInput, SignUpInput } from '@interviewlab/core';
import { apiRequest, notifySessionChanged } from './http';

export const authClient = {
  session: (signal?: AbortSignal) => apiRequest<AuthSession | null>('/auth/session', { signal }),
  async signUp(input: SignUpInput) {
    await apiRequest<{ success: true }>('/auth/sign-up/email', { method: 'POST', body: input });
    notifySessionChanged();
  },
  async signIn(input: SignInInput) {
    await apiRequest<{ success: true }>('/auth/sign-in/email', { method: 'POST', body: input });
    notifySessionChanged();
  },
  async signOut() {
    await apiRequest<{ success: true }>('/auth/sign-out', { method: 'POST', body: {} });
    notifySessionChanged();
  },
};
