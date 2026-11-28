import { Suspense, lazy, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDemo } from '../../app/demoStore';
import { PageHeader } from '../../components/PageHeader';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { loadProtocols } from '../../lib/data';
import { useAsync } from '../../lib/useAsync';
import { ClipboardCheck, ClipboardList, Gauge, ShieldAlert } from '@/components/icon';
import { Badge, Button, Card } from '@/components/base';

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
    <div className="screen-stack">
      <PageHeader
        eyebrow="Screen 3"
        title="Protocol detail"
        description="Read the plan your physiotherapist set for you. Take your time — nothing starts until you confirm you understand it."
        icon={<ClipboardList className="size-5" aria-hidden="true" />}
        badge={<SimulatedBadge source={source ?? 'simulated'} />}
      />
      {status === 'loading' ? <StateMessage kind="loading" title="Loading protocol…" /> : null}
      {status === 'error' ? (
        <StateMessage
          kind="error"
          title="Could not load protocol"
          action={
            <Button variant="outline" size="sm" onClick={reload}>
              Retry
            </Button>
          }
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
          {/* Record context, carried as labelled fields rather than a run of
              punctuation-separated text: which protocol, which reference, which
              version, and who configured it are never ambiguous on this page. */}
          <div className="patient-banner">
            <span className="patient-banner-name">{protocol.name}</span>
            <Badge variant="record">{protocol.id}</Badge>
            <span className="patient-banner-field">
              Version <strong>{protocol.version}</strong>
            </span>
          </div>

          <Card surface="paper" role="region" aria-labelledby="prescribed-heading">
            <div className="card-chart-head">
              <span className="icon-chip" aria-hidden="true">
                <Gauge className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 id="prescribed-heading" className="card-chart-title">
                  Prescribed parameters
                </h2>
                <p className="card-chart-meta">
                  Values your clinician configured for this version — not a measurement of you.
                </p>
              </div>
            </div>

            {/* The prescription read as an obs-chart strip: each parameter is a
                labelled field with its own value, so one can be checked without
                reading the others. */}
            <dl className="vitals-strip">
              <div className="min-w-0">
                <dt className="vitals-label">Target side</dt>
                <dd className="vitals-value capitalize">
                  {protocol.side ?? 'Not configured'}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="vitals-label">Target reps</dt>
                <dd className="vitals-value">
                  {protocol.target_reps ?? 'Not configured'}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="vitals-label">Target angle range</dt>
                <dd className="vitals-value">
                  {targetMin !== undefined && targetMax !== undefined
                    ? `${targetMin}–${targetMax}°`
                    : 'Not configured'}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="vitals-label">Version</dt>
                <dd className="vitals-value">{protocol.version}</dd>
              </div>
            </dl>
            <p className="meta">
              Projected estimate, not a medical threshold. One side per session (MVP).
            </p>

            <dl className="detail-list mt-4">
              <dt>Hold duration</dt>
              <dd>
                {protocol.hold_duration_seconds != null
                  ? `${protocol.hold_duration_seconds} s`
                  : 'Not configured'}
              </dd>
              <dt>Camera view</dt>
              <dd>
                {protocol.camera_view
                  ? `${protocol.camera_view} view; hip, knee and ankle visible`
                  : 'Not configured'}
              </dd>
              {protocol.notes ? (
                <>
                  <dt>Clinician notes</dt>
                  <dd>{protocol.notes}</dd>
                </>
              ) : null}
            </dl>

            {targetMax !== undefined ? (
              <div className="twin-preview mt-4">
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
          </Card>

          {protocol.instructions ? (
            <Card role="region" aria-labelledby="instructions-heading">
              <div className="card-chart-head">
                <span className="icon-chip" aria-hidden="true">
                  <ClipboardList className="size-4" />
                </span>
                <div className="min-w-0">
                  <h2 id="instructions-heading" className="card-chart-title">
                    Instructions
                  </h2>
                  <p className="card-chart-meta">How your clinician asked you to perform this.</p>
                </div>
              </div>
              <p className="max-w-[70ch] text-[0.95rem] leading-relaxed">{protocol.instructions}</p>
            </Card>
          ) : null}

          {/* The stop instruction is the one line on this screen that must not be
              skimmed past, so it gets its own panel with a caution spine — paired
              with the heading beside it, never carried by colour alone. */}
          <Card triage="caution" role="region" aria-labelledby="stop-heading">
            <div className="card-chart-head">
              <span className="icon-chip" aria-hidden="true">
                <ShieldAlert className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="section-kicker">Before you begin</p>
                <h2 id="stop-heading" className="card-chart-title">
                  Stop instruction
                </h2>
              </div>
            </div>
            <p className="max-w-[70ch] text-[0.95rem] font-semibold leading-relaxed">
              {protocol.stop_instructions ??
                'No stop instructions are recorded. Ask your physiotherapist before beginning.'}
            </p>
            <p className="meta max-w-[70ch]">
              The camera only measures estimated movement — it does not decide whether an exercise
              is safe for you.
            </p>
          </Card>

          <Card
            triage={protocol.approved ? 'stable' : 'critical'}
            role="region"
            aria-labelledby="gate-heading"
          >
            {/* flex-wrap so the approval pill drops below the title on a phone
                instead of squeezing it into a two-character column. */}
            <div className="card-chart-head flex-wrap">
              <span className="icon-chip" aria-hidden="true">
                {protocol.approved ? (
                  <ClipboardCheck className="size-4" />
                ) : (
                  <ShieldAlert className="size-4" />
                )}
              </span>
              <div className="min-w-0">
                <h2 id="gate-heading" className="card-chart-title">
                  Confirm and continue
                </h2>
                <p className="card-chart-meta">
                  Nothing starts until both the approval state and your confirmation are in place.
                </p>
              </div>
              {protocol.approved ? (
                <StatusPill tone="good">Clinician-approved protocol</StatusPill>
              ) : (
                <StatusPill tone="bad">Read-only demo — not clinician-approved</StatusPill>
              )}
            </div>
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
                size="lg"
                disabled={!confirmed || !protocol.approved}
                onClick={() => {
                  setSelectedProtocolId(protocol.id);
                  navigate('/setup');
                }}
              >
                Continue to camera setup
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/sessions/session-demo-1/result">
                  Review saved results without camera
                </Link>
              </Button>
            </div>
            {!protocol.approved ? (
              <p className="meta">
                <StatusPill tone="warn">Clinical gate</StatusPill> Because no clinician approved
                this protocol, the app stays read-only and suggests no exercise.
              </p>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
}
