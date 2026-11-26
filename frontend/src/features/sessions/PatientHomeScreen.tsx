import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck2, ClipboardCheck, GitBranch, ListChecks, Repeat } from 'lucide-react';
import { useDemo } from '../../app/demoStore';
import { MetricCard } from '../../components/MetricCard';
import { PageHeader } from '../../components/PageHeader';
import { SimulatedBadge } from '../../components/SimulatedBadge';
import { StateMessage } from '../../components/StateMessage';
import { StatusPill } from '../../components/StatusPill';
import { StepCards } from '../../components/StepCards';
import { TrendChart } from '../../components/TrendChart';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { loadProtocols, loadSessions } from '../../lib/data';
import { useAsync } from '../../lib/useAsync';
import type { Protocol } from '../../types';

/** Screen 2 — assigned protocol, next guidance, recent status and read-only mode. */
export function PatientHomeScreen() {
  const { cameraMode, setCameraMode, setSelectedProtocolId } = useDemo();
  const protocols = useAsync(() => loadProtocols(), []);
  const sessions = useAsync(async () => loadSessions(), []);
  const assigned: Protocol[] = protocols.data ?? [];
  const approved = assigned.filter((p) => p.approved);

  return (
    <div className="screen-stack">
      <PageHeader
        eyebrow="Patient workspace"
        title="Patient home"
        description="Your assigned protocol, what to do next, and a simple view of recent recorded sessions."
        badge={<SimulatedBadge source={protocols.source ?? 'simulated'} />}
      />

      {protocols.status === 'ready' && approved.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3 motion-stagger">
          <MetricCard
            label="Target repetitions"
            value={approved[0].target_reps}
            unit="reps"
            hint="Clinician-configured"
            icon={<Repeat className="size-4" aria-hidden="true" />}
          />
          <MetricCard
            label="Recent sessions"
            value={sessions.status === 'ready' ? (sessions.data?.length ?? 0) : '—'}
            hint="Available to review"
            icon={<ListChecks className="size-4" aria-hidden="true" />}
          />
          <MetricCard
            label="Assigned protocol version"
            value={approved[0].version}
            hint="Current plan"
            icon={<GitBranch className="size-4" aria-hidden="true" />}
          />
        </div>
      ) : null}

      {protocols.status === 'ready' && approved.length > 0 ? (
        <Card className="card-interactive flex flex-wrap items-center gap-5 card-accent-left">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
            <CalendarCheck2 className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-[16rem] flex-1">
            <p className="section-kicker">Next prescribed session</p>
            <h2 className="mt-0 text-lg">{approved[0].name}</h2>
            <p className="meta">
              {approved[0].side} side · {approved[0].target_reps} repetitions · configured by{' '}
              {approved[0].clinician_name}
            </p>
            <p className="meta">
              <ClipboardCheck className="mr-1 inline size-4" aria-hidden="true" />
              Review the protocol and stop instructions before you begin.
            </p>
          </div>
          <Button asChild size="lg">
            <Link
              to={`/protocols/${approved[0].id}`}
              onClick={() => setSelectedProtocolId(approved[0].id)}
            >
              Start with protocol review <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </Card>
      ) : null}

      {protocols.status === 'ready' && approved.length > 0 ? (
        <StepCards protocolId={approved[0].id} cameraMode={cameraMode} />
      ) : null}

      <section className="card">
        <p className="section-kicker">Assigned plan</p>
        <h2 className="mt-0">Your assigned protocol</h2>
        {protocols.status === 'loading' ? (
          <StateMessage kind="loading" title="Loading your assigned protocols…" />
        ) : null}
        {protocols.status === 'error' ? (
          <StateMessage
            kind="error"
            title="Could not load protocols"
            action={<button onClick={protocols.reload}>Retry</button>}
          >
            {protocols.error}
          </StateMessage>
        ) : null}
        {protocols.status === 'ready' && approved.length === 0 ? (
          <StateMessage kind="empty" title="Read-only demo mode">
            No clinician-approved protocol is assigned. No exercise is suggested and the camera
            session cannot start. You can still review saved information.
          </StateMessage>
        ) : null}
        {protocols.status === 'ready' && approved.length > 0 ? (
          <>
            <ul className="item-list motion-stagger">
              {approved.map((protocol) => (
                <li key={protocol.id} className="list-card">
                  <div>
                    <strong>{protocol.name}</strong>
                    <p className="meta">
                      Configured by {protocol.clinician_name} · version {protocol.version} ·{' '}
                      {protocol.side} side · target {protocol.target_reps} reps
                    </p>
                  </div>
                  <div className="button-row">
                    <Link
                      className="button-link"
                      to={`/protocols/${protocol.id}`}
                      onClick={() => setSelectedProtocolId(protocol.id)}
                    >
                      Review protocol
                    </Link>
                    {cameraMode === 'camera' ? (
                      <Link className="button-link primary" to="/setup">
                        Set up camera
                      </Link>
                    ) : (
                      <Link className="button-link" to="/sessions/session-demo-1/result">
                        Review saved report (no camera)
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="meta">
              <StatusPill tone="good">Clinician-approved protocol present</StatusPill> The
              physiotherapist sets the target range; this app only measures.
            </p>
            {cameraMode === 'review' ? (
              <div className="button-row">
                <button type="button" onClick={() => setCameraMode('camera')}>
                  Enable camera mode (consent still required at setup)
                </button>
              </div>
            ) : (
              <p className="meta">
                <StatusPill tone="neutral">Camera mode enabled</StatusPill> Camera access is asked
                for on the setup screen and is optional.
              </p>
            )}
          </>
        ) : null}
      </section>

      <section className="card" aria-labelledby="recent-heading">
        <h2 id="recent-heading">Recent sessions</h2>
        {sessions.status === 'loading' ? (
          <StateMessage kind="loading" title="Loading recent sessions…" />
        ) : null}
        {sessions.status === 'error' ? (
          <StateMessage kind="error" title="Could not load sessions">
            {sessions.error}
          </StateMessage>
        ) : null}
        {sessions.status === 'ready' && sessions.data?.length ? (
          <div className="metric-grid motion-stagger">
            {sessions.data.slice(0, 3).map((session) => (
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
        {sessions.status === 'ready' && !sessions.data?.length ? (
          <StateMessage kind="empty" title="No sessions recorded yet" />
        ) : null}
      </section>

      {sessions.status === 'ready' && sessions.data?.length ? (
        <TrendChart sessions={sessions.data} source={sessions.source ?? 'simulated'} />
      ) : null}
    </div>
  );
}
