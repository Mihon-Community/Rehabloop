import { Link, useNavigate } from 'react-router-dom';
import { useDemo } from '../../app/demoStore';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { loadMe } from '../../lib/data';
import { useAsync } from '../../lib/useAsync';

/** Screen 1 — sign-in / role-aware landing. Role here is display-only. */
export function AuthScreen() {
  const { role, setRole, setCameraMode } = useDemo();
  const navigate = useNavigate();
  const { status, data, source, error, reload } = useAsync(() => loadMe(), []);

  return (
    <section className="card" aria-labelledby="auth-heading">
      <div className="screen-title-row">
        <h1 id="auth-heading">1. Sign in / demo access</h1>
        <SimulatedBadge source={source ?? 'simulated'} />
      </div>
      <p>
        RehabLoop shows a patient their clinician-assigned exercise protocol and recorded movement
        measurements. A physiotherapist configures and reviews; the app does not diagnose or advise.
      </p>

      {status === 'loading' ? (
        <StateMessage kind="loading" title="Loading profile…">
          Checking the API for a signed-in user.
        </StateMessage>
      ) : null}
      {status === 'error' ? (
        <StateMessage
          kind="error"
          title="Could not load profile"
          action={<button onClick={reload}>Retry</button>}
        >
          {error}
        </StateMessage>
      ) : null}
      {status === 'ready' ? (
        <>
          <StateMessage kind="empty" title="Demo mode — no real sign-in configured">
            {data?.display_name ? `API profile: ${data.display_name}. ` : ''}
            Supabase values are empty in this build, so no real session is created. Choose a demo
            role below; the backend verifies the real role and patient assignment.
          </StateMessage>

          <fieldset className="role-picker">
            <legend>View the demo as</legend>
            <label>
              <input
                type="radio"
                name="demo-role"
                checked={role === 'patient'}
                onChange={() => setRole('patient')}
              />
              Patient
            </label>
            <label>
              <input
                type="radio"
                name="demo-role"
                checked={role === 'clinician'}
                onChange={() => setRole('clinician')}
              />
              Physiotherapist / clinician
            </label>
          </fieldset>
          <p className="meta">
            <StatusPill tone="warn">Display-only role</StatusPill> This choice changes what is
            shown. It is never an authorization control.
          </p>

          <div className="button-row">
            {role === 'patient' ? (
              <button className="primary" type="button" onClick={() => navigate('/home')}>
                Continue to patient home
              </button>
            ) : (
              <button className="primary" type="button" onClick={() => navigate('/clinician')}>
                Continue to clinician dashboard
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setCameraMode('review');
                navigate('/home');
              }}
            >
              Decline camera — non-camera review
            </button>
          </div>
          <p className="meta">
            Declining camera access never blocks protocol review or previously saved reports.
          </p>
        </>
      ) : null}
      <p className="meta">
        <Link to="/home">Open patient home</Link> ·{' '}
        <Link to="/clinician">Open clinician dashboard</Link>
      </p>
    </section>
  );
}
