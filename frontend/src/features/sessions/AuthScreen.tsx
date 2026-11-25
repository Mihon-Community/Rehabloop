import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../../lib/api';
import { clearLocalDemoToken, setLocalDemoToken } from '../../lib/auth';
import { supabase, supabaseConfigured } from '../../lib/supabase';
import { SafetyBanner } from '../../components/SafetyBanner';

export function AuthScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    clearLocalDemoToken();

    try {
      if (!supabase) throw new Error('Supabase sign-in is not configured for this build.');
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      const profile = await api.me();
      navigate(profile.role === 'patient' ? '/home' : '/clinician');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function useLocalDemo() {
    setBusy(true);
    setError('');
    try {
      if (supabase) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw signOutError;
      }
      setLocalDemoToken('demo-patient-token');
      const profile = await api.me();
      navigate(profile.role === 'patient' ? '/home' : '/clinician');
    } catch (cause) {
      clearLocalDemoToken();
      const message =
        cause instanceof ApiError && cause.status === 401
          ? 'The backend rejected local demo sign-in. Local demo auth requires APP_ENV=local and AUTH_MODE=dev.'
          : cause instanceof Error
            ? cause.message
            : 'Local demo sign-in failed.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="auth-heading">
      <h1 id="auth-heading">Sign in to RehabLoop</h1>
      <SafetyBanner />
      <p>Use your RehabLoop account to view assigned protocols and run a camera session.</p>

      {supabaseConfigured ? (
        <form className="form-stack" onSubmit={signIn}>
          <label>
            Email
            <input
              autoComplete="username"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="primary" disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      ) : (
        <p className="notice" role="status">
          Supabase Auth is not configured. Use the local synthetic account while running the app in
          development, or configure the public Supabase URL and anon key.
        </p>
      )}

      {import.meta.env.DEV && (
        <div className="local-demo">
          <h2>Local synthetic test account</h2>
          <p className="meta">
            This option is shown only in a development build. The backend must also have
            <code> APP_ENV=local</code> and <code> AUTH_MODE=dev</code>.
          </p>
          <button disabled={busy} onClick={useLocalDemo} type="button">
            Continue as synthetic patient
          </button>
        </div>
      )}

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <p className="meta">
        Camera access is optional. You can review assigned information without starting a camera
        session. <Link to="/home">Continue to patient home</Link>
      </p>
    </section>
  );
}
