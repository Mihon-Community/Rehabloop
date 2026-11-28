import { Link } from 'react-router-dom';
import { useDemo } from '../../app/demoStore';
import { MetricCard } from '../../components/MetricCard';
import { PageHeader } from '../../components/PageHeader';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { StepCards } from '../../components/StepCards';
import { TrendChart } from '../../components/TrendChart';
import { loadProtocols, loadSessions } from '../../lib/data';
import { useAsync } from '../../lib/useAsync';
import type { DemoProtocol } from '../../types';
import {
  Activity,
  ArrowRight,
  CalendarCheck2,
  ClipboardCheck,
  ClipboardList,
  GitBranch,
  ListChecks,
  Repeat,
  ShieldAlert,
} from '@/components/icon';
import { Badge, Button, Card } from '@/components/base';

/** Screen 2 — assigned protocol, next guidance, recent status and read-only mode. */
export function PatientHomeScreen() {
  const { cameraMode, setCameraMode, setSelectedProtocolId } = useDemo();
  const protocols = useAsync(() => loadProtocols(), []);
  const sessions = useAsync(async () => loadSessions(), []);
  const assigned: DemoProtocol[] = protocols.data ?? [];
  const approved = assigned.filter((p) => p.approved);
  const protocolsReady = protocols.status === 'ready';
  // One prescribed session is the point of this screen; everything below the
  // first card is supporting detail for it.
  const next = approved[0];
  const recent = sessions.status === 'ready' ? (sessions.data ?? []) : [];

  return (
    <div className="screen-stack">
      <PageHeader
        eyebrow="Patient workspace"
        title="Patient home"
        description="Your assigned protocol, what to do next, and a simple view of recent recorded sessions."
        icon={<Activity className="size-5" aria-hidden="true" />}
        badge={<SimulatedBadge source={protocols.source ?? 'simulated'} />}
      />

      {/* The clinical gate comes first, in both directions: either the one
          approved session to open, or the honest reason there isn't one. */}
      {protocolsReady && next ? (
        <Card triage="stable" className="card-interactive">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
            <span className="icon-chip icon-chip-lg" aria-hidden="true">
              <CalendarCheck2 className="size-5" />
            </span>
            <div className="min-w-[14rem] flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="section-kicker">Next prescribed session</p>
                <Badge variant="record">{next.id}</Badge>
              </div>
              <h2 className="mt-0 mb-1 text-lg">{next.name}</h2>
              <p className="meta">
                <ClipboardCheck className="mr-1 inline size-4" aria-hidden="true" />
                Review the protocol and stop instructions before you begin.
              </p>
            </div>
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to={`/protocols/${next.id}`} onClick={() => setSelectedProtocolId(next.id)}>
                Start with protocol review <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>

          {/* The prescription read as separate fields rather than one
              punctuation-separated run, so a value can be checked at a glance
              the way it would be off an obs chart. */}
          <dl className="vitals-strip mt-5">
            <div>
              <dt className="vitals-label">Side</dt>
              <dd className="vitals-value capitalize">{next.side ?? 'Not configured'}</dd>
            </div>
            <div>
              <dt className="vitals-label">Target range</dt>
              <dd className="vitals-value">
                {next.target_angle_min_deg !== undefined &&
                next.target_angle_max_deg !== undefined
                  ? `${next.target_angle_min_deg}–${next.target_angle_max_deg}°`
                  : 'Not configured'}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="vitals-label">Target repetitions</dt>
              <dd className="vitals-value">
                {next.target_reps !== undefined ? `${next.target_reps} reps` : 'Not configured'}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <StatusPill tone="good">Clinician-approved protocol present</StatusPill>
            <span className="text-sm text-[var(--muted-foreground)]">
              The physiotherapist sets the target range; this app only measures.
            </span>
          </div>
        </Card>
      ) : null}

      {protocolsReady && approved.length === 0 ? (
        /* role="status" keeps the behaviour the panel had as a StateMessage:
           the gate resolves after load, so it is announced rather than just
           appearing. */
        <Card triage="caution" role="status">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <span className="icon-chip icon-chip-lg" aria-hidden="true">
              <ShieldAlert className="size-5" />
            </span>
            <div className="min-w-[14rem] flex-1">
              <p className="section-kicker">Protocol status</p>
              <h2 className="mt-0 mb-0 text-lg">Read-only demo mode</h2>
            </div>
            <StatusPill tone="warn">
              {assigned.length > 0 ? 'Awaiting clinician approval' : 'No protocol assigned'}
            </StatusPill>
          </div>
          {/* Body colour, not muted: this is the clinical reason the screen
              offers nothing to start, and it should not read as fine print. */}
          <p className="mt-3 max-w-[66ch]">
            No clinician-approved protocol is assigned. No exercise is suggested and the camera
            session cannot start. You can still review saved information.
          </p>
          {assigned.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="text-sm text-[var(--muted-foreground)]">
                On file, not approved for use:
              </span>
              <Badge variant="record">{assigned[0].id}</Badge>
            </div>
          ) : null}
        </Card>
      ) : null}

      {protocolsReady && next ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3 motion-stagger">
          <MetricCard
            label="Target repetitions"
            value={next.target_reps ?? 'Not set'}
            unit={next.target_reps === undefined ? undefined : 'reps'}
            hint="Clinician-configured"
            icon={<Repeat className="size-4" aria-hidden="true" />}
          />
          <MetricCard
            label="Recent sessions"
            value={sessions.status === 'ready' ? recent.length : '—'}
            hint="Available to review"
            icon={<ListChecks className="size-4" aria-hidden="true" />}
          />
          <MetricCard
            label="Assigned protocol version"
            value={next.version}
            hint="Current plan"
            icon={<GitBranch className="size-4" aria-hidden="true" />}
          />
        </div>
      ) : null}

      {protocolsReady && next ? <StepCards protocolId={next.id} cameraMode={cameraMode} /> : null}

      {/* The plan itself as a record: the read-only state above already
          explains the empty case, so this panel only appears when there is
          something to load, fail, or read. */}
      {!protocolsReady || approved.length > 0 ? (
        <section className="card" aria-labelledby="assigned-heading">
          <div className="card-chart-head">
            <span className="icon-chip" aria-hidden="true">
              <ClipboardList className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 id="assigned-heading" className="card-chart-title">
                Your assigned protocol
              </h2>
              <p className="card-chart-meta">Prescribed records you can open and read</p>
            </div>
          </div>
          {protocols.status === 'loading' ? (
            <StateMessage kind="loading" title="Loading your assigned protocols…" />
          ) : null}
          {protocols.status === 'error' ? (
            <StateMessage
              kind="error"
              title="Could not load protocols"
              action={
                <Button variant="outline" size="sm" onClick={protocols.reload}>
                  Retry
                </Button>
              }
            >
              {protocols.error}
            </StateMessage>
          ) : null}
          {approved.length > 0 ? (
            <>
              <ul className="item-list motion-stagger">
                {approved.map((protocol) => (
                  <li key={protocol.id} className="list-card">
                    <div className="min-w-[12rem] flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <strong>{protocol.name}</strong>
                        <Badge variant="record">v{protocol.version}</Badge>
                      </div>
                      <p className="meta">
                        {protocol.side ? `${protocol.side} side` : 'Side not configured'} · target{' '}
                        {protocol.target_reps !== undefined
                          ? `${protocol.target_reps} reps`
                          : 'not configured'}
                      </p>
                    </div>
                    {/* Secondary by design: the filled button at the top of the
                        screen stays the only primary action. */}
                    <div className="button-row">
                      <Button asChild variant="outline">
                        <Link
                          to={`/protocols/${protocol.id}`}
                          onClick={() => setSelectedProtocolId(protocol.id)}
                        >
                          Review protocol
                        </Link>
                      </Button>
                      {cameraMode === 'camera' ? (
                        <Button asChild variant="outline">
                          <Link to="/setup">Set up camera</Link>
                        </Button>
                      ) : (
                        <Button asChild variant="outline">
                          <Link to="/sessions/session-demo-1/result">
                            Review saved report (no camera)
                          </Link>
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {/* Capture mode is the one setting this panel owns, so it sits
                  below a rule as the panel's footer rather than mixed in with
                  the protocol rows. */}
              <div className="mt-2 border-t border-[var(--border)] pt-4">
                {cameraMode === 'review' ? (
                  <Button variant="outline" onClick={() => setCameraMode('camera')}>
                    Enable camera mode (consent still required at setup)
                  </Button>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <StatusPill tone="neutral">Camera mode enabled</StatusPill>
                    <span className="text-sm text-[var(--muted-foreground)]">
                      Camera access is asked for on the setup screen and is optional.
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="card" aria-labelledby="recent-heading">
        <div className="card-chart-head">
          <span className="icon-chip" aria-hidden="true">
            <ListChecks className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 id="recent-heading" className="card-chart-title">
              Recent sessions
            </h2>
            {/* Says out loud that the grid below is a truncation, rather than
                silently showing three of five. */}
            <p className="card-chart-meta">
              Stored values from completed captures
              {recent.length > 3 ? ` · latest 3 of ${recent.length}` : ''}
            </p>
          </div>
        </div>
        {sessions.status === 'loading' ? (
          <StateMessage kind="loading" title="Loading recent sessions…" />
        ) : null}
        {sessions.status === 'error' ? (
          <StateMessage kind="error" title="Could not load sessions">
            {sessions.error}
          </StateMessage>
        ) : null}
        {recent.length > 0 ? (
          <div className="metric-grid motion-stagger">
            {recent.slice(0, 3).map((session) => (
              <MetricCard
                key={session.id}
                label={session.started_at.slice(0, 10)}
                value={session.completed_reps ?? '—'}
                unit={session.completed_reps !== undefined ? 'reps' : undefined}
                hint={`${session.status} · ${session.usable_frame_pct ?? '?'}% usable frames`}
              />
            ))}
          </div>
        ) : null}
        {sessions.status === 'ready' && recent.length === 0 ? (
          <StateMessage kind="empty" title="No sessions recorded yet" />
        ) : null}
      </section>

      {recent.length > 0 ? (
        <TrendChart sessions={recent} source={sessions.source ?? 'simulated'} />
      ) : null}
    </div>
  );
}
