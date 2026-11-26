const LOCAL_DEMO_TOKEN_KEY = 'rehabloop-local-demo-token';

/** Local demo tokens are synthetic and only offered by the development UI. */
export function getLocalDemoToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(LOCAL_DEMO_TOKEN_KEY);
}

export function setLocalDemoToken(token: string): void {
  if (!import.meta.env.DEV) throw new Error('Local demo sign-in is only available in development.');
  window.sessionStorage.setItem(LOCAL_DEMO_TOKEN_KEY, token);
}

export function clearLocalDemoToken(): void {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(LOCAL_DEMO_TOKEN_KEY);
}

export function isLocalDemoSession(): boolean {
  return Boolean(getLocalDemoToken());
}
