import { api } from './api';
import { supabase, supabaseConfigured } from './supabase';

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
