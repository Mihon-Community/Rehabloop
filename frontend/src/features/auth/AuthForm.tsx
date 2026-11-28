import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Info, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useDemo } from '@/app/demoStore';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemePicker } from '@/components/layout/ThemePicker';
import {
  destinationAfterSignIn,
  signInWithPassword,
  signUpWithPassword,
  supabaseConfigured,
} from '@/lib/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shared form for distinct sign-in / sign-up routes. No password is ever logged or stored here. */
export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const isSignUp = mode === 'sign-up';
  const navigate = useNavigate();
  const { role, setRole, setCameraMode } = useDemo();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'info'>('idle');
  const [message, setMessage] = useState('');
  const [fieldError, setFieldError] = useState<{
    email?: string;
    password?: string;
    confirm?: string;
  }>({});

  function validate(): boolean {
    const errors: typeof fieldError = {};
    if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.';
    if (password.length < 8) errors.password = 'Use at least 8 characters.';
    if (isSignUp && confirmPassword !== password) errors.confirm = 'Passwords do not match.';
    setFieldError(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!validate()) {
      setStatus('error');
      setMessage('Please correct the highlighted fields.');
      return;
    }
    if (!supabaseConfigured) {
      setStatus('error');
      setMessage('Accounts are not configured in this demo build. Use demo access below.');
      return;
    }
    setStatus('loading');
    try {
      if (isSignUp) {
        const user = await signUpWithPassword(email, password);
        if (user && !user.confirmed_at) {
          setStatus('info');
          setMessage('Check your email to confirm the account before signing in.');
          return;
        }
      } else {
        await signInWithPassword(email, password);
      }
      setStatus('info');
      setMessage('Signed in. Opening your dashboard…');
      navigate(await destinationAfterSignIn());
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error ? error.message : 'Authentication failed. Please try again.',
      );
    }
  }

  function continueWithDemo() {
    setCameraMode('review');
    navigate(role === 'clinician' ? '/clinician' : '/home');
  }

  const title = isSignUp ? 'Create your account' : 'Welcome back';

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-bold" aria-label="RehabLoop home">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          RehabLoop
        </Link>
        <div className="ml-auto">
          <ThemePicker />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:py-16">
        <section className="max-w-lg" aria-labelledby="auth-title">
          <p className="section-kicker">{isSignUp ? 'Get started' : 'Sign in'}</p>
          <h1 id="auth-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="screen-intro">
            {isSignUp
              ? 'Set up access to review clinician-prescribed movement sessions.'
              : 'Continue to your assigned protocols and recorded session measurements.'}
          </p>

          <form onSubmit={handleSubmit} noValidate className="card space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(fieldError.email)}
                aria-describedby={fieldError.email ? 'email-error' : undefined}
                placeholder="you@example.com"
              />
              {fieldError.email ? (
                <p id="email-error" className="mt-1 text-sm text-[var(--danger)]">
                  {fieldError.email}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(fieldError.password)}
                aria-describedby={fieldError.password ? 'password-error' : undefined}
                placeholder="At least 8 characters"
              />
              {fieldError.password ? (
                <p id="password-error" className="mt-1 text-sm text-[var(--danger)]">
                  {fieldError.password}
                </p>
              ) : null}
            </div>

            {isSignUp ? (
              <div>
                <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-semibold">
                  Confirm password
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  aria-invalid={Boolean(fieldError.confirm)}
                  aria-describedby={fieldError.confirm ? 'confirm-error' : undefined}
                />
                {fieldError.confirm ? (
                  <p id="confirm-error" className="mt-1 text-sm text-[var(--danger)]">
                    {fieldError.confirm}
                  </p>
                ) : null}
              </div>
            ) : null}

            {message ? (
              <Alert
                variant={status === 'error' ? 'destructive' : 'info'}
                icon={
                  status === 'loading' ? (
                    <LoaderCircle className="size-5 animate-spin" />
                  ) : (
                    <Info className="size-5" />
                  )
                }
              >
                <AlertTitle>{status === 'error' ? 'Please check' : 'Sign-in status'}</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}
            {status === 'loading' ? (
              <p role="status" className="text-sm text-[var(--muted-foreground)]">
                Signing in…
              </p>
            ) : null}

            <Button type="submit" disabled={status === 'loading'} className="w-full">
              {status === 'loading' ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden="true" /> Please wait
                </>
              ) : (
                <>
                  {isSignUp ? 'Create account' : 'Sign in'} <ArrowRight aria-hidden="true" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-4 text-sm text-[var(--muted-foreground)]">
            {isSignUp ? (
              <>
                Already have an account? <Link to="/sign-in">Sign in</Link>
              </>
            ) : (
              <>
                New to RehabLoop? <Link to="/sign-up">Create an account</Link>
              </>
            )}
            {' · '}
            <Link to="/">Back to home</Link>
          </p>
        </section>

        <aside className="space-y-5 lg:pt-8" aria-labelledby="demo-access-heading">
          <div className="card">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="simulated">SIMULATED</Badge>
              <Badge variant="outline">Demo access</Badge>
            </div>
            <h2 id="demo-access-heading" className="mt-0 text-lg">
              Explore without an account
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              {supabaseConfigured
                ? 'Demo access signs nobody in — it only changes what this build displays, using labelled synthetic data. Viewing live data still needs a real account, because the backend verifies real roles and patient assignment.'
                : 'No Supabase project is configured in this build, so no real account is created and no user is signed in. Demo access only changes what is displayed; the backend verifies real roles and patient assignment.'}
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold">View the demo as</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="demo-role"
                  checked={role === 'patient'}
                  onChange={() => setRole('patient')}
                />
                Patient
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="demo-role"
                  checked={role === 'clinician'}
                  onChange={() => setRole('clinician')}
                />
                Physiotherapist / clinician
              </label>
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full"
              type="button"
              onClick={continueWithDemo}
            >
              Continue with demo access <ArrowRight aria-hidden="true" />
            </Button>
            <p className="meta mt-3">
              <SimulatedBadge source="simulated" /> Example metrics shown in demo mode are labelled
              simulated and are never presented as real inference.
            </p>
          </div>

          <Alert variant="info" icon={<ShieldCheck className="size-5" />}>
            <AlertTitle>Prototype, not a medical device</AlertTitle>
            <AlertDescription>
              Angles are projected 2D estimates from one camera view. RehabLoop does not diagnose,
              prescribe or advise, and raw video is not stored by default.
            </AlertDescription>
          </Alert>
        </aside>
      </main>
    </div>
  );
}
