import { Suspense, lazy, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useDemo } from '../../app/demoStore';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { loadProtocols } from '../../lib/data';
import { useAsync } from '../../lib/useAsync';

const TwinAvatar = lazy(() => import('../recovery-twin/TwinAvatar'));

/** Screen 3 — protocol detail with the clinician gate and confirm-understanding step. */
export function ProtocolDetailScreen() {
  const { id } = useParams();
  const { setSelectedProtocolId } = useDemo();
  const [confirmed, setConfirmed] = useState(false);
  const navigate = useNavigate();
  const { status, data, source, error, reload } = useAsync(() => loadProtocols(), []);
  const protocol = data?.find((p) => p.id === id);
  const targetMin = protocol?.target_angle_min_deg;
  const targetMax = protocol?.target_angle_max_deg;

  return (
    <section className="card" aria-labelledby="protocol-heading">
      <div className="screen-title-row">
        <h1 id="protocol-heading">3. Protocol detail</h1>
        <SimulatedBadge source={source ?? 'simulated'} />
      </div>
      <p className="screen-intro">
        Read the plan your physiotherapist set for you. Take your time — nothing starts until you
        confirm you understand it.
      </p>
      {status === 'loading' ? <StateMessage kind="loading" title="Loading protocol…" /> : null}
      {status === 'error' ? (
        <StateMessage
          kind="error"
          title="Could not load protocol"
          action={<button onClick={reload}>Retry</button>}
        >
          {error}
        </StateMessage>
      ) : null}
      {status === 'ready' && !protocol ? (
        <StateMessage kind="empty" title="Protocol not available">
          This protocol does not exist or is not assigned to you. No exercise is suggested.
        </StateMessage>
      ) : null}
      {status === 'ready' && protocol ? (
        <>
          {protocol.approved ? (
            <StatusPill tone="good">Clinician-approved protocol</StatusPill>
          ) : (
            <StatusPill tone="bad">Read-only demo — not clinician-approved</StatusPill>
          )}
          <dl className="detail-list">
            <dt>Protocol</dt>
            <dd>{protocol.name}</dd>
            <dt>Version</dt>
            <dd>{protocol.version}</dd>
            <dt>Target side</dt>
            <dd>
              {protocol.side
                ? `${protocol.side} side, one side per session (MVP)`
                : 'not configured'}
            </dd>
            <dt>Target repetitions</dt>
            <dd>
              {protocol.target_reps === undefined
                ? 'not configured'
                : `${protocol.target_reps} (clinician-configured)`}
            </dd>
            <dt>Target angle range</dt>
            <dd>
              {targetMin !== undefined && targetMax !== undefined
                ? `${targetMin}–${targetMax}° projected knee angle estimate, configured for this patient — not a universal medical threshold`
                : 'not configured'}
            </dd>
            <dt>Hold duration</dt>
            <dd>
              {protocol.hold_duration_seconds === undefined
                ? 'not configured'
                : `${protocol.hold_duration_seconds} s`}
            </dd>
            <dt>Camera view</dt>
            <dd>
              {protocol.camera_view
                ? `${protocol.camera_view} view; hip, knee and ankle visible`
                : 'not configured'}
            </dd>
            {protocol.instructions ? (
              <>
                <dt>Instructions</dt>
                <dd>{protocol.instructions}</dd>
              </>
            ) : null}
            {protocol.stop_instructions ? (
              <>
                <dt>Stop instruction</dt>
                <dd>{protocol.stop_instructions}</dd>
              </>
            ) : null}
            {protocol.notes ? (
              <>
                <dt>Notes</dt>
                <dd>{protocol.notes}</dd>
              </>
            ) : null}
          </dl>

          {targetMax !== undefined ? (
            <div className="twin-preview">
              <Suspense
                fallback={
                  <p className="meta" role="status">
                    Loading schematic preview…
                  </p>
                }
              >
                <TwinAvatar angle={targetMax} variant="primary" kind="target" />
              </Suspense>
              <div>
                <p className="meta" style={{ marginTop: 0 }}>
                  Preview of the far end of the target range above ({targetMax}°) — a goal your
                  clinician configured, not a measurement of you.
                </p>
              </div>
            </div>
          ) : null}

          <Alert variant="warning" icon={<ShieldAlert className="size-5" />}>
            <AlertTitle>Before you begin</AlertTitle>
            <AlertDescription>
              {protocol.stop_instructions
                ? `${protocol.stop_instructions} `
                : 'This protocol record carries no stop instructions — ask your physiotherapist before you begin. '}
              The camera only measures estimated movement — it does not decide whether an exercise
              is safe for you.
            </AlertDescription>
          </Alert>
          <label className="confirm-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={!protocol.approved}
            />
            I have read and understood this protocol and the stop instructions.
          </label>
          <div className="button-row">
            <Button
              type="button"
              disabled={!confirmed || !protocol.approved}
              onClick={() => {
                setSelectedProtocolId(protocol.id);
                navigate('/setup');
              }}
            >
              Continue to camera setup
            </Button>
            <Link className="button-link" to="/sessions/session-demo-1/result">
              Review saved results without camera
            </Link>
          </div>
          {!protocol.approved ? (
            <p className="meta">
              <StatusPill tone="warn">Clinical gate</StatusPill> Because no clinician approved this
              protocol, the app stays read-only and suggests no exercise.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
