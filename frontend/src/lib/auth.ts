import { api } from './api';
import { supabase, supabaseConfigured } from './supabase';

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

/** Real Supabase Auth only. Demo access is a separate, clearly labelled path. */
export async function signInWithPassword(email: string, password: string) {
  if (!supabase) throw new Error('Supabase Auth is not configured in this demo build.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function signUpWithPassword(email: string, password: string) {
  if (!supabase) throw new Error('Supabase Auth is not configured in this demo build.');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

/** The backend remains authoritative for role; this is display/navigation only. */
export async function destinationAfterSignIn(): Promise<string> {
  try {
    const profile = await api.me();
    return profile.role === 'clinician' ? '/clinician' : '/home';
  } catch {
    return '/home';
  }
}

export { supabaseConfigured };
