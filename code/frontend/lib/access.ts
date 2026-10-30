/** Only application pages can be restored after authentication. */
export function businessTarget(value: string): string | null {
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return null;
  const url = new URL(value, 'https://interviewlab.invalid');
  if (url.origin !== 'https://interviewlab.invalid') return null;
  if (!/^\/(jobs|me|interview|reports|compare)(\/|$)/.test(url.pathname)) return null;
  return url.pathname + url.search + url.hash;
}

export function requiresLogin(pathname: string) {
  return pathname !== '/' && pathname !== '/login';
}
