import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDemo } from '@/app/demoStore';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { ThemePicker } from '@/components/layout/ThemePicker';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  HeartPulse,
  Info,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Stethoscope,
  Users,
  type IconComponent,
} from '@/components/icon';
import { Alert, AlertDescription, AlertTitle, Badge, Button, Card, Input } from '@/components/base';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';
import {
  destinationAfterSignIn,
  signInWithPassword,
  signUpWithPassword,
  supabaseConfigured,
} from '@/lib/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* The two things this build can honestly say about accounts. The first is on
   screen before anyone types, so nobody fills in a form that cannot work; the
   second is what a submit attempt reports. Wording is fixed. */
const NOT_CONFIGURED_NOTICE =
  'Supabase values are empty in this build, so no real session is created. Use demo access below.';
const NOT_CONFIGURED_ON_SUBMIT =
  'Accounts are not configured in this demo build. Use demo access below.';

const ROLE_OPTIONS: { value: Role; label: string; Icon: IconComponent }[] = [
  { value: 'patient', label: 'Patient', Icon: Users },
  { value: 'clinician', label: 'Physiotherapist / clinician', Icon: Stethoscope },
];

/** Joins the ids a field is described by, or undefined when there are none. */
function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  const list = ids.filter((id): id is string => Boolean(id));
  return list.length > 0 ? list.join(' ') : undefined;
}

/* Field-level problems stay next to the field they belong to and are wired to
   it with aria-describedby; the icon means the message is never carried by red
   alone. The form-level summary above the fields is a real Alert. */
function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-[var(--danger)]">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** Shared form for distinct sign-in / sign-up routes. No password is ever logged or stored here. */
export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const isSignUp = mode === 'sign-up';
  const navigate = useNavigate();
  const { role, setRole, setCameraMode } = useDemo();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Without a Supabase project the honest state on first paint is "warning",
  // not "idle": the notice is part of the page, not a reaction to a submit.
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'warning' | 'info'>(
    supabaseConfigured ? 'idle' : 'warning',
  );
  const [message, setMessage] = useState(supabaseConfigured ? '' : NOT_CONFIGURED_NOTICE);
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
      setStatus('warning');
      setMessage(NOT_CONFIGURED_ON_SUBMIT);
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
  const pending = status === 'loading';
  const hasFieldErrors = Object.keys(fieldError).length > 0;

  const noticeTitle =
    status === 'warning'
      ? 'Demo mode — no real sign-in configured'
      : status === 'error'
        ? hasFieldErrors
          ? 'Check the fields below'
          : isSignUp
            ? 'Could not create the account'
            : 'Could not sign in'
        : isSignUp
          ? 'Account status'
          : 'Sign-in status';

  const noticeIcon =
    status === 'error' ? (
      <AlertCircle className="size-5 text-[var(--danger)]" />
    ) : status === 'warning' ? (
      <AlertTriangle className="size-5 text-[var(--warning)]" />
    ) : (
      <Info className="size-5" />
    );

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Same frosted bar as the landing page and the signed-in topbar, so the
          front door reads as the same product. */}
      <header className="app-topbar sticky top-0 z-40">
        <div className="mx-auto flex h-16 w-full max-w-[34rem] items-center gap-2 px-4 sm:px-6">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 font-bold"
            aria-label="RehabLoop home"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HeartPulse className="size-5" aria-hidden="true" />
            </span>
            {/* Hidden below sm: the mark, picker and crossover link already
                fill a 320px bar. The link keeps its accessible name. */}
            <span className="hidden sm:inline" aria-hidden="true">
              RehabLoop
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemePicker />
            <Button variant="ghost" size="sm" asChild>
              <Link to={isSignUp ? '/sign-in' : '/sign-up'}>
                {isSignUp ? 'Sign in' : 'Create account'}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* One centred column at every width: the account form, then the demo
          path, then the standing safety statement. */}
      <main className="mx-auto w-full max-w-[34rem] px-4 pb-10 pt-8 sm:px-6">
        <section aria-labelledby="auth-title">
          <Card>
            <div className="card-chart-head">
              <span className="icon-chip icon-chip-lg" aria-hidden="true">
                {isSignUp ? <Users className="size-5" /> : <LockKeyhole className="size-5" />}
              </span>
              <div className="min-w-0">
                <p className="section-kicker">{isSignUp ? 'Get started' : 'Sign in'}</p>
                <h1 id="auth-title" className="text-xl font-bold tracking-tight sm:text-2xl">
                  {title}
                </h1>
              </div>
            </div>

            <p className="text-sm text-[var(--muted-foreground)]">
              {isSignUp
                ? 'Set up access to review clinician-prescribed movement sessions.'
                : 'Continue to your assigned protocols and recorded session measurements.'}
            </p>

            <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
              {message ? (
                <Alert
                  variant={
                    status === 'error' ? 'destructive' : status === 'warning' ? 'warning' : 'info'
                  }
                  icon={noticeIcon}
                >
                  <AlertTitle>{noticeTitle}</AlertTitle>
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              ) : null}

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
                  Email address
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                    aria-hidden="true"
                  />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-invalid={Boolean(fieldError.email)}
                    aria-describedby={describedBy(fieldError.email && 'email-error')}
                    placeholder="you@example.com"
                    className="h-11 pl-9"
                  />
                </div>
                {fieldError.email ? (
                  <FieldError id="email-error">{fieldError.email}</FieldError>
                ) : null}
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                    aria-hidden="true"
                  />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={Boolean(fieldError.password)}
                    aria-describedby={describedBy(
                      fieldError.password && 'password-error',
                      'password-hint',
                    )}
                    className="h-11 pl-9"
                  />
                </div>
                {fieldError.password ? (
                  <FieldError id="password-error">{fieldError.password}</FieldError>
                ) : null}
                <p id="password-hint" className="mt-1.5 text-xs text-[var(--muted-foreground)]">
                  At least 8 characters.
                </p>
              </div>

              {isSignUp ? (
                <div>
                  <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-semibold">
                    Confirm password
                  </label>
                  <div className="relative">
                    <LockKeyhole
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                      aria-hidden="true"
                    />
                    <Input
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      aria-invalid={Boolean(fieldError.confirm)}
                      aria-describedby={describedBy(fieldError.confirm && 'confirm-error')}
                      className="h-11 pl-9"
                    />
                  </div>
                  {fieldError.confirm ? (
                    <FieldError id="confirm-error">{fieldError.confirm}</FieldError>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2 pt-1">
                <Button type="submit" size="lg" disabled={pending} className="w-full">
                  {pending ? (
                    <>
                      <LoaderCircle className="animate-spin" aria-hidden="true" />
                      {isSignUp ? 'Creating account…' : 'Signing in…'}
                    </>
                  ) : (
                    <>
                      {isSignUp ? 'Create account' : 'Sign in'} <ArrowRight aria-hidden="true" />
                    </>
                  )}
                </Button>
                {/* Always rendered so the live region exists before it has
                    anything to say; empty, it takes no vertical space. */}
                <p role="status" className="text-center text-sm text-[var(--muted-foreground)]">
                  {pending
                    ? isSignUp
                      ? 'Creating your account…'
                      : 'Signing in… contacting the authentication service.'
                    : ''}
                </p>
              </div>
            </form>

            <div className="mt-5 border-t border-[var(--border)] pt-4 text-sm">
              <p>
                {isSignUp ? (
                  <>
                    Already have an account?{' '}
                    <Link to="/sign-in" className="font-semibold">
                      Sign in
                    </Link>
                  </>
                ) : (
                  <>
                    New to RehabLoop?{' '}
                    <Link to="/sign-up" className="font-semibold">
                      Create an account
                    </Link>
                  </>
                )}
              </p>
              <p className="mt-1 text-[var(--muted-foreground)]">
                <Link to="/">Back to home</Link>
              </p>
            </div>
          </Card>
        </section>

        <section aria-labelledby="demo-access-heading">
          <Card>
            <div className="card-chart-head flex-wrap">
              <span className="icon-chip icon-chip-lg" aria-hidden="true">
                <Users className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 id="demo-access-heading" className="m-0 text-base font-semibold">
                  Explore without an account
                </h2>
                <p className="card-chart-meta">Display-only role selection</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="simulated">SIMULATED</Badge>
                <Badge variant="outline">Demo access</Badge>
              </div>
            </div>

            <p className="text-sm text-[var(--muted-foreground)]">
              {supabaseConfigured
                ? 'Demo access signs nobody in — it only changes what this build displays, using labelled synthetic data. Viewing live data still needs a real account, because the backend verifies real roles and patient assignment.'
                : 'No Supabase project is configured in this build, so no real account is created and no user is signed in. Demo access only changes what is displayed; the backend verifies real roles and patient assignment.'}
            </p>

            <fieldset className="mt-4 p-3 sm:p-4">
              <legend className="px-1.5 text-sm font-semibold">View the demo as</legend>
              {/* One row per role, exactly one selectable: the native radio
                  carries the state as a shape, the tinted border only repeats
                  it. */}
              <div className="grid gap-2">
                {ROLE_OPTIONS.map(({ value, label, Icon }) => {
                  const selected = role === value;
                  return (
                    <label
                      key={value}
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-semibold transition-colors',
                        selected
                          ? 'border-[var(--primary)] bg-[var(--accent)] text-[var(--accent-foreground)]'
                          : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]',
                      )}
                    >
                      <input
                        type="radio"
                        name="demo-role"
                        value={value}
                        checked={selected}
                        onChange={() => setRole(value)}
                        className="size-[1.1rem] shrink-0 accent-[var(--primary)]"
                      />
                      <Icon className="size-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                      <span className="min-w-0">{label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <Button
              variant="outline"
              size="lg"
              className="mt-4 w-full"
              type="button"
              onClick={continueWithDemo}
            >
              Continue with demo access <ArrowRight aria-hidden="true" />
            </Button>
            <p className="meta">
              <SimulatedBadge source="simulated" /> Example metrics shown in demo mode are labelled
              simulated and are never presented as real inference.
            </p>
          </Card>
        </section>

        <Alert variant="info" icon={<ShieldCheck className="size-5" />}>
          <AlertTitle>Prototype, not a medical device</AlertTitle>
          <AlertDescription>
            Angles are projected 2D estimates from one camera view. RehabLoop does not diagnose,
            prescribe or advise, and raw video is not stored by default.
          </AlertDescription>
        </Alert>
      </main>
    </div>
  );
}
