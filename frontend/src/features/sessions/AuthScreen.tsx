import { Link, useNavigate } from 'react-router-dom';
import { useDemo } from '../../app/demoStore';
import { PageHeader } from '../../components/PageHeader';
import { SafetyBanner } from '../../components/SafetyBanner';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { loadMe } from '../../lib/data';
import { useAsync } from '../../lib/useAsync';
import { ThemePicker } from '@/components/layout/ThemePicker';
import {
  ArrowRight,
  HeartPulse,
  LockKeyhole,
  Stethoscope,
  Users,
  type IconComponent,
} from '@/components/icon';
import { Button, Card } from '@/components/base';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

const ROLE_OPTIONS: { value: Role; label: string; Icon: IconComponent }[] = [
  { value: 'patient', label: 'Patient', Icon: Users },
  { value: 'clinician', label: 'Physiotherapist / clinician', Icon: Stethoscope },
];

/** Screen 1 — sign-in / role-aware landing. Role here is display-only. */
export function AuthScreen() {
  const { role, setRole, setCameraMode } = useDemo();
  const navigate = useNavigate();
  const { status, data, source, error, reload } = useAsync(() => loadMe(), []);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* This route sits outside the app shell, so it carries the same public
          header as the sign-in pages rather than floating with no chrome. */}
      <header className="app-topbar sticky top-0 z-40">
        <div className="mx-auto flex h-16 w-full max-w-[40rem] items-center gap-2 px-4 sm:px-6">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 font-bold"
            aria-label="RehabLoop home"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HeartPulse className="size-5" aria-hidden="true" />
            </span>
            <span className="hidden sm:inline" aria-hidden="true">
              RehabLoop
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemePicker />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[40rem] px-4 pb-10 pt-6 sm:px-6">
        <SafetyBanner />

        <PageHeader
          eyebrow="Screen 1"
          title="Sign in / demo access"
          description="RehabLoop shows a patient their clinician-assigned exercise protocol and recorded movement measurements. A physiotherapist configures and reviews; the app does not diagnose or advise."
          icon={<LockKeyhole className="size-5" />}
          badge={<SimulatedBadge source={source ?? 'simulated'} />}
        />

        <Card>
          <div className="card-chart-head">
            <span className="icon-chip" aria-hidden="true">
              <Users className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="m-0 text-base font-semibold">Choose how to view the demo</h2>
              <p className="card-chart-meta">No account is created in this demo build.</p>
            </div>
          </div>

          {status === 'loading' ? (
            <StateMessage kind="loading" title="Loading profile…">
              Checking the API for a signed-in user.
            </StateMessage>
          ) : null}
          {status === 'error' ? (
            <StateMessage
              kind="error"
              title="Could not load profile"
              action={
                <Button variant="outline" size="sm" onClick={reload}>
                  Retry
                </Button>
              }
            >
              {error}
            </StateMessage>
          ) : null}
          {status === 'ready' ? (
            <>
              <StateMessage kind="empty" title="Demo mode — no real sign-in configured">
                {data?.display_name ? `API profile: ${data.display_name}. ` : ''}
                Supabase values are empty in this build, so no real session is created. Choose a
                demo role below; the backend verifies the real role and patient assignment.
              </StateMessage>

              {/* One row per role, exactly one selectable: the native radio
                  carries the state as a shape, the tinted border only repeats
                  it. */}
              <fieldset className="mt-4 p-3 sm:p-4">
                <legend className="px-1.5 text-sm font-semibold">View the demo as</legend>
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
                        <Icon
                          className="size-4 shrink-0 text-[var(--primary)]"
                          aria-hidden="true"
                        />
                        <span className="min-w-0">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <p className="meta">
                <StatusPill tone="warn">Display-only role</StatusPill> This choice changes what is
                shown. It is never an authorization control.
              </p>

              <div className="button-row">
                {role === 'patient' ? (
                  <Button size="lg" type="button" onClick={() => navigate('/home')}>
                    Continue to patient home <ArrowRight aria-hidden="true" />
                  </Button>
                ) : (
                  <Button size="lg" type="button" onClick={() => navigate('/clinician')}>
                    Continue to clinician dashboard <ArrowRight aria-hidden="true" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="lg"
                  type="button"
                  onClick={() => {
                    setCameraMode('review');
                    navigate('/home');
                  }}
                >
                  Decline camera — non-camera review
                </Button>
              </div>
              <p className="meta">
                Declining camera access never blocks protocol review or previously saved reports.
              </p>
            </>
          ) : null}

          <div className="mt-5 border-t border-[var(--border)] pt-4 text-sm text-[var(--muted-foreground)]">
            <p>
              <Link to="/home">Open patient home</Link> ·{' '}
              <Link to="/clinician">Open clinician dashboard</Link>
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}
